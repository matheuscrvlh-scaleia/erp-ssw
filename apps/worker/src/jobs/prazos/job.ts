import {
  filiaisDeChegada,
  FONTES_DE_REGRA,
  previsaoPelasRegras,
  type RegraDePrazo,
} from "@erp/dominio/prazos-configurados";
import { JOB_RECALCULAR_PRAZOS } from "@erp/shared/jobs";
import { z } from "@erp/shared/zod";

import { definirJob } from "../registro";

export interface CteDoRecalculo {
  id: string;
  parceiroCnpj: string | null;
  filial: string | null;
  dataEmissao: string;
  dataPrevistaEntrega: string | null;
  prazoFonte: string | null;
  dataBasePrazo: Date | null;
  previsaoSsw: string | null;
  previsaoSswFonte: string | null;
}

export interface NovaPrevisao {
  cteId: string;
  previsao: string | null;
  fonte: string | null;
  dataBase: Date | null;
  /** Previsão anterior, para o histórico (só quando havia uma e mudou). */
  anterior: string | null;
}

export interface RepositorioPrazosDoWorker {
  regras(empresaId: string): Promise<RegraDePrazo[]>;
  /**
   * CT-e que alguma regra pode tocar (parceiro ou filial de regra ativa) ou que estão com
   * previsão de regra (para voltar à do SSW), em ordem de id a partir de `aposId`.
   */
  candidatos(
    empresaId: string,
    filtro: { parceiros: string[]; filiais: string[]; fontesDeRegra: readonly string[] },
    aposId: string | null,
    limite: number,
  ): Promise<CteDoRecalculo[]>;
  /** Primeira chegada (84) por CT-e e filial, só das filiais pedidas. */
  chegadas(
    empresaId: string,
    cteIds: string[],
    filiais: string[],
  ): Promise<Map<string, Map<string, Date>>>;
  /** Grava a previsão nova e, quando a anterior existia e mudou, o histórico. */
  gravar(empresaId: string, novas: NovaPrevisao[]): Promise<void>;
}

export const LOTE_DO_RECALCULO = 1000;

function mesmoInstante(a: Date | null, b: Date | null): boolean {
  return (a?.getTime() ?? null) === (b?.getTime() ?? null);
}

/** O que muda num lote: só CT-e cuja previsão, fonte ou base saem diferentes. */
export function novasPrevisoes(
  ctes: readonly CteDoRecalculo[],
  regras: readonly RegraDePrazo[],
  chegadas: ReadonlyMap<string, ReadonlyMap<string, Date>>,
): NovaPrevisao[] {
  return ctes.flatMap((c) => {
    const p = previsaoPelasRegras({ ...c, chegadas: chegadas.get(c.id) ?? new Map() }, regras);
    const igual =
      p.previsao === c.dataPrevistaEntrega &&
      p.fonte === c.prazoFonte &&
      mesmoInstante(p.dataBase, c.dataBasePrazo);
    if (igual) return [];
    return [
      {
        cteId: c.id,
        previsao: p.previsao,
        fonte: p.fonte,
        dataBase: p.dataBase,
        anterior: c.dataPrevistaEntrega,
      },
    ];
  });
}

/**
 * Recalcula a previsão dos CT-e da empresa pelas regras de prazo configurado ativas (pedido pelo
 * Admin ao gravar, ligar, desligar ou apagar uma regra). Lotes de 1000, cada um numa transação.
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
      fontesDeRegra: FONTES_DE_REGRA,
    };
    const filiais = filiaisDeChegada(regras);
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
            filiais,
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
