import {
  type PainelDeComprovantes,
  type StatusDeComprovante,
  TIPO_NAO_INFORMADO,
} from "@erp/shared/contratos/comprovantes";
import { SEM_TIPO_DOCUMENTO } from "@erp/shared/contratos/ocorrencias";

import { agrupar } from "../colecoes";
import { tipoDocumentoDoFiltro } from "../ocorrencias/busca";
import { compararTexto } from "../ordem";

/** CT-e entregue no período, já com os filtros (menos o de tipo). */
export interface CteEntregue {
  id: string;
  unidade: string | null;
  /** Dia da entrega em America/Sao_Paulo (Q11 do dono). */
  dia: string;
  dataEntrega: Date;
  /** Quando o CT-e foi gravado: desempate da lista (Q07 do dono). */
  criadoEm: Date;
  tipoDocumento455: string | null;
  tipoDocumento: string | null;
  /** Coluna "Compr. de Entrega Escaneado" do 455: `S`, `N` ou ausente. */
  comprovanteEscaneado: boolean | null;
  /** Tem ocorrência 88 (comprovante digitalizado), fora as de quarentena (Q21 do dono). */
  tem88: boolean;
}

export interface Comprovante extends CteEntregue {
  tipoEfetivo: string;
  digitalizado: boolean;
  /** Dia com o 930 importado ou CT-e com a coluna do 455: só esses entram em pendentes e no %. */
  coberto: boolean;
}

/** Nome do arquivo 930 diário → dia que ele cobre (`930_ocorrencias_2026-11-04_...`). */
export function diaCobertoPeloArquivo(nomeArquivo: string): string | null {
  return /^930_ocorrencias_(\d{4}-\d{2}-\d{2})_/.exec(nomeArquivo)?.[1] ?? null;
}

/**
 * Digitalizado = ocorrência 88 ou "escaneado" no 455 (decisões de 27/10 e 05/11/2026).
 * origem: comprovantes_metricas_v2 / comprovantes_lista_v2 (sistema atual)
 */
export function classificarComprovantes(
  ctes: readonly CteEntregue[],
  diasCobertos: ReadonlySet<string>,
): Comprovante[] {
  return ctes.map((c) => ({
    ...c,
    tipoEfetivo: tipoDocumentoDoFiltro(c.tipoDocumento455, c.tipoDocumento),
    digitalizado: c.comprovanteEscaneado === true || c.tem88,
    coberto: diasCobertos.has(c.dia) || c.comprovanteEscaneado !== null,
  }));
}

function casaTipos(c: Comprovante, tipos: readonly string[]): boolean {
  return tipos.length === 0 || tipos.includes(c.tipoEfetivo);
}

/** `ROUND(x, 4)` do Postgres: metade para longe do zero. */
const arredondar4 = (parte: number, total: number) => Math.round((parte * 10_000) / total) / 10_000;

function contar(itens: readonly Comprovante[]) {
  const cobertos = itens.filter((c) => c.coberto);
  return {
    entregues: itens.length,
    digitalizados: itens.filter((c) => c.digitalizado).length,
    pendentes: cobertos.filter((c) => !c.digitalizado).length,
    pct:
      cobertos.length > 0
        ? arredondar4(cobertos.filter((c) => c.digitalizado).length, cobertos.length)
        : null,
  };
}

/**
 * Cards, gráfico por dia e tabelas por unidade e por tipo de documento.
 * origem: comprovantes_metricas_v2 (sistema atual)
 */
export function calcularPainelDeComprovantes(
  todos: readonly Comprovante[],
  tipos: readonly string[],
): PainelDeComprovantes {
  const base = todos.filter((c) => casaTipos(c, tipos));
  const nomeDoTipo = (c: Comprovante) =>
    c.tipoEfetivo === SEM_TIPO_DOCUMENTO ? TIPO_NAO_INFORMADO : c.tipoEfetivo;
  return {
    totais: contar(base),
    porUnidade: [...agrupar(base, (c) => c.unidade ?? "—")]
      .map(([unidade, itens]) => ({ unidade, ...contar(itens) }))
      .sort((a, b) => compararTexto(a.unidade, b.unidade)),
    porDia: [...agrupar(base, (c) => c.dia)]
      .map(([dia, itens]) => ({ dia, coberto: itens.some((c) => c.coberto), ...contar(itens) }))
      .sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0)),
    // Desempate pelo nome do tipo (Q07 do dono): não muda nenhuma contagem.
    porTipoDocumento: [...agrupar(base, nomeDoTipo)]
      .map(([tipoDocumento, itens]) => ({ tipoDocumento, ...contar(itens) }))
      .sort((a, b) => b.entregues - a.entregues || compararTexto(a.tipoDocumento, b.tipoDocumento)),
    tiposContagem: [...agrupar(todos, (c) => c.tipoEfetivo)]
      .map(([tipo, itens]) => ({ tipo, qtd: itens.length }))
      .sort((a, b) => b.qtd - a.qtd || compararTexto(a.tipo, b.tipo)),
  };
}

/**
 * Lista do card: todos, só digitalizados ou só pendentes (sem comprovante num dia coberto), da
 * entrega mais recente para a mais antiga; empate pelo CT-e gravado por último (Q07 do dono).
 * origem: comprovantes_lista_v2 (sistema atual)
 */
export function listarComprovantes(
  todos: readonly Comprovante[],
  tipos: readonly string[],
  status: StatusDeComprovante,
): Comprovante[] {
  return todos
    .filter((c) => casaTipos(c, tipos))
    .filter((c) =>
      status === "digitalizados"
        ? c.digitalizado
        : status === "pendentes"
          ? !c.digitalizado && c.coberto
          : true,
    )
    .sort(
      (a, b) =>
        b.dataEntrega.getTime() - a.dataEntrega.getTime() ||
        b.criadoEm.getTime() - a.criadoEm.getTime() ||
        (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
    );
}
