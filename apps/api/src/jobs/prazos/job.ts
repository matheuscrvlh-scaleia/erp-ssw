import {
  type CteParaPrazo,
  definirPrevisao,
  ehFonteDeRegra,
  FONTES_DE_PRAZO,
  type OcorrenciaDoCte,
  type PrevisaoComMemoria,
  type RegraDePrazo,
  type TrocaDePrevisao,
  trocaDePrevisao,
} from "@erp/dominio/nucleo";
import { JOB_RECALCULAR_PRAZOS } from "@erp/shared/jobs";
import { z } from "@erp/shared/zod";

import { definirJob } from "../registro";

export type CteDoRecalculo = CteParaPrazo & { id: string };

export interface NovaPrevisao extends PrevisaoComMemoria {
  cteId: string;
  /** Linha do histórico de previsão, quando a anterior existia e mudou. */
  troca: TrocaDePrevisao | null;
}

export interface RepositorioPrazosDoJob {
  regras(empresaId: string): Promise<RegraDePrazo[]>;
  /**
   * CT-e que alguma regra pode tocar (parceiro ou filial de regra ativa) ou que estão com
   * previsão de regra (para voltar à do SSW), em ordem de id a partir de `aposId`.
   */
  candidatos(
    empresaId: string,
    filtro: { parceiros: string[]; filiais: string[] },
    aposId: string | null,
    limite: number,
  ): Promise<CteDoRecalculo[]>;
  /** Chegadas (84) de cada CT-e pedido; a quarentena é tirada pelo núcleo. */
  chegadas(empresaId: string, cteIds: string[]): Promise<Map<string, OcorrenciaDoCte[]>>;
  /** Grava a previsão nova (e a memória do SSW) e as linhas de histórico. */
  gravar(empresaId: string, novas: NovaPrevisao[]): Promise<void>;
}

export const LOTE_DO_RECALCULO = 1000;
export const FONTES_DE_REGRA = FONTES_DE_PRAZO.filter(ehFonteDeRegra);

const mesmoInstante = (a: Date | null, b: Date | null) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

function igual(a: PrevisaoComMemoria, b: PrevisaoComMemoria): boolean {
  return (
    a.dataPrevistaEntrega === b.dataPrevistaEntrega &&
    a.prazoFonte === b.prazoFonte &&
    mesmoInstante(a.dataBasePrazo, b.dataBasePrazo) &&
    a.previsaoSswData === b.previsaoSswData &&
    a.previsaoSswFonte === b.previsaoSswFonte &&
    mesmoInstante(a.previsaoSswDataBase, b.previsaoSswDataBase)
  );
}

/** O que muda num lote: só CT-e cuja previsão (ou memória do SSW) sai diferente. */
export function novasPrevisoes(
  ctes: readonly CteDoRecalculo[],
  regras: readonly RegraDePrazo[],
  chegadas: ReadonlyMap<string, readonly OcorrenciaDoCte[]>,
): NovaPrevisao[] {
  return ctes.flatMap((c) => {
    const p = definirPrevisao(c, chegadas.get(c.id) ?? [], regras);
    if (igual(p, c)) return [];
    return [{ ...p, cteId: c.id, troca: trocaDePrevisao(c.dataPrevistaEntrega, p) }];
  });
}

/**
 * Recalcula a previsão dos CT-e da empresa pelas regras de prazo configurado ativas (pedido pelo
 * Admin ao gravar, ligar, desligar ou apagar uma regra). CT-e e chegadas novos já saem com a regra
 * pela gravação do núcleo (Q19). Lotes de 1000, cada um numa transação.
 * origem: recalcular_todos_prazos_configurados + limpar_prazos_regras_orfas (sistema atual)
 */
export const recalcularPrazos = definirJob({
  nome: JOB_RECALCULAR_PRAZOS.nome,
  fila: JOB_RECALCULAR_PRAZOS.fila,
  escopo: "empresa",
  dados: z.object({ empresaId: z.uuid() }),
  agendamento: null,
  async processar({ executar, log }, { empresaId }) {
    const regras = await executar(({ prazos }) => prazos.regras(empresaId));
    const ativas = regras.filter((r) => r.ativo);
    const filtro = {
      parceiros: ativas.flatMap((r) =>
        r.tipo === "parceiro" && r.parceiroCnpj ? [r.parceiroCnpj] : [],
      ),
      filiais: ativas.flatMap((r) =>
        r.tipo !== "parceiro" && r.unidadeCodigo ? [r.unidadeCodigo] : [],
      ),
    };
    let aposId: string | null = null;
    let alterados = 0;
    for (;;) {
      const lote: { ultimo: string | null; alterados: number } = await executar(
        async ({ prazos }) => {
          const ctes = await prazos.candidatos(empresaId, filtro, aposId, LOTE_DO_RECALCULO);
          if (ctes.length === 0) return { ultimo: null, alterados: 0 };
          const chegadas = await prazos.chegadas(
            empresaId,
            ctes.map((c) => c.id),
          );
          const novas = novasPrevisoes(ctes, regras, chegadas);
          await prazos.gravar(empresaId, novas);
          return { ultimo: ctes.at(-1)?.id ?? null, alterados: novas.length };
        },
      );
      alterados += lote.alterados;
      if (!lote.ultimo) break;
      aposId = lote.ultimo;
    }
    log.info(
      { alterados, regras: ativas.length },
      "previsões recalculadas pelos prazos configurados",
    );
  },
});
