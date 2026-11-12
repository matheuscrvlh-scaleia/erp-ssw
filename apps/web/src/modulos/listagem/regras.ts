/**
 * Lógica pura da Listagem: seletor Recorte, atalhos do seletor Ocorrência, códigos em aberto e o
 * gráfico "Dias de Atraso".
 * origem: RecortePicker.tsx, OcorrenciaRecortePicker.tsx e performance.lista.tsx (sistema atual)
 */
import { codigoEmAbertoNoRecorte } from "@erp/dominio/listagem/faixas";
import {
  type CodigoDoRecorte,
  type TipoRecorte,
  TIPOS_RECORTE,
} from "@erp/shared/contratos/listagem";

/**
 * Próxima seleção do seletor Recorte: "CT-e emitidos" é o recorte sem condição — marcá-lo
 * desmarca os outros, e desmarcar tudo volta para ele. Ordem sempre a da lista.
 */
export function alternarRecorte(
  marcados: readonly TipoRecorte[],
  recorte: TipoRecorte,
): TipoRecorte[] {
  if (recorte === "emitidos") return ["emitidos"];
  const proximos = new Set(marcados);
  proximos.delete("emitidos");
  if (proximos.has(recorte)) proximos.delete(recorte);
  else proximos.add(recorte);
  const lista = TIPOS_RECORTE.filter((t) => proximos.has(t));
  return lista.length > 0 ? lista : ["emitidos"];
}

export const GRUPOS_DE_OCORRENCIA = ["aberto", "cliente", "empresa", "penaliza"] as const;
export type GrupoDeOcorrencia = (typeof GRUPOS_DE_OCORRENCIA)[number];

/**
 * Códigos do recorte (com CT-e) que formam o atalho. "Em aberto" de "Saíram para entrega com
 * prazo vencido" usa a lista de finalizadores própria.
 */
export function codigosDoGrupo(
  grupo: GrupoDeOcorrencia,
  codigos: readonly CodigoDoRecorte[],
  recorte: TipoRecorte,
): number[] {
  const entra = (c: CodigoDoRecorte) => {
    if (grupo === "aberto") return codigoEmAbertoNoRecorte(recorte, c);
    if (grupo === "cliente") return c.tipo === "PENDENCIA_CLIENTE";
    if (grupo === "empresa") return c.tipo === "PENDENCIA_TRANSPORTADORA";
    return c.penaliza;
  };
  return codigos
    .filter((c) => c.qtd > 0 && entra(c))
    .map((c) => c.codigo)
    .sort((a, b) => a - b);
}

/**
 * Códigos que o seletor Ocorrência marca com `abertos` (alerta ou "Saíram para entrega"): dos já
 * marcados, os em aberto em algum recorte; sem marcados, os em aberto entre os do recorte.
 */
export function codigosEmAberto(
  recortes: readonly TipoRecorte[],
  marcados: readonly number[],
  doRecorte: readonly CodigoDoRecorte[] | undefined,
): number[] {
  const emAberto = (codigo: number, tipo: string | null) =>
    recortes.some((r) => codigoEmAbertoNoRecorte(r, { codigo, tipo }));
  const tipoDe = (codigo: number) => doRecorte?.find((c) => c.codigo === codigo)?.tipo ?? null;
  return marcados.length > 0
    ? marcados.filter((c) => emAberto(c, tipoDe(c)))
    : (doRecorte ?? []).filter((c) => emAberto(c.codigo, c.tipo)).map((c) => c.codigo);
}

/** Recortes que mostram o gráfico "Dias de Atraso". */
const RECORTES_COM_FAIXA: readonly TipoRecorte[] = [
  "atrasados",
  "fora_prazo",
  "por_faixa_atraso",
  "previstos_por_faixa",
  "sem_movimento",
  "nascido_atrasado",
  "ocorr_em_atraso",
];

export function mostraGraficoDeFaixa(recortes: readonly TipoRecorte[]): boolean {
  return RECORTES_COM_FAIXA.some((r) => recortes.includes(r));
}
