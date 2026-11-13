/**
 * Textos da Listagem: rótulos da base de data, selo do atraso e etiquetas "Filtrando por".
 * origem: CtrcsTable.tsx, performance.lista.tsx e FiltrandoPor.tsx (sistema atual)
 */
import { SEM_TIPO_DOCUMENTO } from "@erp/shared/contracts/filters";
import { type BaseData, type TipoRecorte } from "@erp/shared/contracts/listing";
import { lerFiltroTexto } from "@erp/shared/text-filter";

import { type EtiquetaDaBusca, resumirNomes } from "@/components/common/AdvancedFilters";

import { type BuscaDaLista } from "./search";

export const ROTULO_DA_BASE: Record<BaseData, string> = {
  emissao: "Emitidos",
  prevista: "Data Prevista",
  concluido: "Concluídos",
};
export const DATA_DA_BASE: Record<BaseData, string> = {
  emissao: "Emissão",
  prevista: "Prevista",
  concluido: "Concluído",
};
export const DICA_DA_BASE: Record<BaseData, string> = {
  emissao: "O período filtra pela data de emissão do CT-e.",
  prevista: "O período filtra pela data prevista de entrega.",
  concluido: "O período filtra pela data de entrega ou de baixa no sistema.",
};
export const BASE_CURTA: Record<BaseData, string> = {
  emissao: "por data de emissão",
  prevista: "por data prevista",
  concluido: "por data de conclusão",
};

const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

export interface Selo {
  texto: string;
  tom: "ruim_forte" | "ruim" | "atencao" | "bom";
  dica?: string;
}

/**
 * Selo da coluna Atraso: atrasado (vermelho cheio em aberto, claro se já entregue), "Vence hoje"
 * (em aberto com atraso 0) ou "No prazo". Sem atraso calculado = sem selo.
 */
export function selo(atraso: number | null, entregue: boolean): Selo | null {
  if (atraso === null) return null;
  if (atraso > 0) {
    return entregue
      ? { texto: `Atrasado ${dias(atraso)}`, tom: "ruim", dica: "Entregue com atraso" }
      : { texto: `Atrasado ${dias(atraso)}`, tom: "ruim_forte" };
  }
  if (atraso === 0 && !entregue) return { texto: "Vence hoje", tom: "atencao" };
  return { texto: "No prazo", tom: "bom" };
}

const numero = (n: number) => n.toLocaleString("pt-BR");

/** "10 a 20 kg", "a partir de 10 kg", "até 20 kg" ou vazio. */
export function textoDaFaixa(min: number | null, max: number | null, unidade: string): string {
  if (min !== null && max !== null) return `${numero(min)} a ${numero(max)} ${unidade}`;
  if (min !== null) return `a partir de ${numero(min)} ${unidade}`;
  if (max !== null) return `até ${numero(max)} ${unidade}`;
  return "";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sigla da unidade como veio; id do cadastro (UUID) vira "unidade selecionada". */
export function nomesDasUnidades(unidades: readonly string[]): string[] {
  return unidades.map((u) => (UUID.test(u) ? "unidade selecionada" : u));
}

/**
 * Etiquetas "Filtrando por" da Listagem, cada uma com os campos da busca que o "x" limpa.
 * "Penalizados em XXX" já leva a unidade no título: aí a etiqueta Unidade some.
 */
export function etiquetasDaLista(
  busca: BuscaDaLista,
  recortes: readonly TipoRecorte[],
  nomesDosParceiros: readonly string[],
  porCodigo: readonly { codigo: number; descricao: string | null }[],
): EtiquetaDaBusca<BuscaDaLista>[] {
  const unidadeNoTitulo =
    busca.unidades.length === 1 &&
    recortes.some((r) => r === "penalizados" || r === "penalizados_abertos");
  const nomesDosCodigos = busca.codigos.map((c) => {
    const descricao = porCodigo.find((a) => a.codigo === c)?.descricao;
    return descricao ? `${c} — ${descricao}` : String(c);
  });
  const nomesDosTipos = busca.tipos.map((t) => (t === SEM_TIPO_DOCUMENTO ? "sem tipo" : t));
  return [
    { rotulo: "CTRC", valor: busca.ctrc.trim(), limpar: { ctrc: "" } },
    { rotulo: "Nota fiscal", valor: busca.nf.trim(), limpar: { nf: "" } },
    { rotulo: "Busca", valor: busca.busca.trim(), limpar: { busca: "" } },
    {
      rotulo: "Unidade",
      ...resumirNomes(unidadeNoTitulo ? [] : nomesDasUnidades(busca.unidades)),
      limpar: { unidades: [] },
    },
    { rotulo: "Unidade responsável", ...resumirNomes(busca.filiais), limpar: { filiais: [] } },
    { rotulo: "Parceiros", ...resumirNomes(nomesDosParceiros), limpar: { parceiros: [] } },
    {
      rotulo: "Remetente",
      ...resumirNomes(lerFiltroTexto(busca.remetente)),
      limpar: { remetente: "" },
    },
    { rotulo: "Destino", ...resumirNomes(lerFiltroTexto(busca.destino)), limpar: { destino: "" } },
    { rotulo: "Ocorrência", ...resumirNomes(nomesDosCodigos), limpar: { codigos: [] } },
    { rotulo: "Tipo documento", ...resumirNomes(nomesDosTipos), limpar: { tipos: [] } },
    { rotulo: "Cidade destino", valor: busca.cidade.trim(), limpar: { cidade: "" } },
    {
      rotulo: "Peso",
      valor: textoDaFaixa(busca.peso_min, busca.peso_max, "kg"),
      limpar: { peso_min: null, peso_max: null },
    },
    {
      rotulo: "Atraso",
      valor: textoDaFaixa(busca.atraso_min, busca.atraso_max, "dias"),
      limpar: { atraso_min: null, atraso_max: null },
    },
  ];
}
