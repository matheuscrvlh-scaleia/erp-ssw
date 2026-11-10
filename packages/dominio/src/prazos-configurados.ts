import { type DadosDoPrazo, type TipoDePrazo } from "@erp/shared/contratos/admin";
import { hojeNoFuso, somarDias } from "@erp/shared/datas";

import { ErroDeNegocio } from "./erros";

/*
 * Prazos configurados no Admin: regra por unidade (horas a partir da chegada), por parceiro (dias
 * a partir da emissão) ou por transbordo unidade → unidade (dias a partir da chegada no destino).
 * A regra sobrescreve a previsão do SSW; sem regra que valha, volta a previsão do SSW, guardada à
 * parte (decisão Q19 do dono: vale também para CT-e e chegada novos, não só quando se salva).
 * origem: aplicar_prazo_configurado, limpar_prazos_regras_orfas,
 *         recalcular_todos_prazos_configurados, prazos.functions.ts (sistema atual)
 */

const FUSO_DO_PRAZO = "America/Sao_Paulo";
/** Código da ocorrência de chegada na unidade. */
export const CODIGO_CHEGADA = 84;

export const FONTES_DE_REGRA = ["regra_unidade", "regra_transbordo", "regra_parceiro"] as const;
export type FonteDeRegra = (typeof FONTES_DE_REGRA)[number];

export interface RegraDePrazo {
  id: string;
  tipo: TipoDePrazo;
  unidadeCodigo: string | null;
  unidadeDestinoCodigo: string | null;
  parceiroCnpj: string | null;
  prazoHoras: number | null;
  prazoDias: number | null;
  ativo: boolean;
  criadoEm: Date;
}

const obrigatorio = (mensagem: string) => new ErroDeNegocio("ENTRADA_INVALIDA", mensagem);

/**
 * Confere os campos obrigatórios do tipo e limpa os que não são dele (uma regra de unidade não
 * guarda parceiro, por exemplo).
 */
export function normalizarRegra(dados: DadosDoPrazo): DadosDoPrazo {
  const vazia = {
    ...dados,
    unidadeCodigo: null,
    unidadeDestinoCodigo: null,
    parceiroCnpj: null,
    parceiroNome: null,
    prazoHoras: null,
    prazoDias: null,
  };
  if (dados.tipo === "unidade") {
    if (!dados.unidadeCodigo || !dados.prazoHoras) {
      throw obrigatorio("Unidade e horas são obrigatórias");
    }
    return { ...vazia, unidadeCodigo: dados.unidadeCodigo, prazoHoras: dados.prazoHoras };
  }
  if (dados.tipo === "parceiro") {
    if (!dados.parceiroCnpj || !dados.prazoDias) {
      throw obrigatorio("Parceiro e dias são obrigatórios");
    }
    return {
      ...vazia,
      parceiroCnpj: dados.parceiroCnpj,
      parceiroNome: dados.parceiroNome,
      prazoDias: dados.prazoDias,
    };
  }
  if (!dados.unidadeCodigo || !dados.unidadeDestinoCodigo || !dados.prazoDias) {
    throw obrigatorio("Origem, destino e dias são obrigatórios");
  }
  return {
    ...vazia,
    unidadeCodigo: dados.unidadeCodigo,
    unidadeDestinoCodigo: dados.unidadeDestinoCodigo,
    prazoDias: dados.prazoDias,
  };
}

/** Chave natural da regra: uma por unidade, por parceiro e por rota de transbordo. */
export function chaveDaRegra(
  r: Pick<RegraDePrazo, "tipo" | "unidadeCodigo" | "unidadeDestinoCodigo" | "parceiroCnpj">,
): string {
  if (r.tipo === "parceiro") return `parceiro:${r.parceiroCnpj ?? ""}`;
  if (r.tipo === "unidade") return `unidade:${r.unidadeCodigo ?? ""}`;
  return `transbordo:${r.unidadeCodigo ?? ""}>${r.unidadeDestinoCodigo ?? ""}`;
}

export interface CteParaPrazo {
  parceiroCnpj: string | null;
  /** Filial do CT-e (a unidade da regra de unidade e a origem do transbordo). */
  filial: string | null;
  dataEmissao: string;
  /** Previsão e fonte que vieram do SSW, guardadas à parte. */
  previsaoSsw: string | null;
  previsaoSswFonte: string | null;
  /** Primeira chegada (ocorrência 84, com ou sem quarentena) por filial da ocorrência. */
  chegadas: ReadonlyMap<string, Date>;
}

export interface PrevisaoDoCte {
  previsao: string | null;
  fonte: string | null;
  /** Instante de onde o prazo foi contado (nulo quando vale a previsão do SSW). */
  dataBase: Date | null;
}

const meiaNoiteEmSaoPaulo = (dia: string) => new Date(`${dia}T00:00:00-03:00`);
const diaEmSaoPaulo = (instante: Date) => hojeNoFuso(FUSO_DO_PRAZO, instante);

/** Entre regras do mesmo tipo que valem, a criada por último vence (era a última a gravar). */
function ultima(regras: readonly RegraDePrazo[]): RegraDePrazo | undefined {
  return [...regras]
    .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime() || a.id.localeCompare(b.id))
    .at(-1);
}

/**
 * Previsão do CT-e pelas regras ativas da empresa. Precedência: parceiro (sempre, até em CT-e
 * entregue) > transbordo (se houve chegada no destino) > unidade (se houve chegada na unidade);
 * nenhuma vale ⇒ a previsão do SSW.
 */
export function previsaoPelasRegras(
  cte: CteParaPrazo,
  regras: readonly RegraDePrazo[],
): PrevisaoDoCte {
  const ativas = regras.filter((r) => r.ativo);

  const parceiro = ultima(
    ativas.filter((r) => r.tipo === "parceiro" && r.parceiroCnpj === cte.parceiroCnpj),
  );
  if (parceiro?.prazoDias && cte.parceiroCnpj !== null) {
    return {
      previsao: somarDias(cte.dataEmissao, parceiro.prazoDias),
      fonte: "regra_parceiro",
      dataBase: meiaNoiteEmSaoPaulo(cte.dataEmissao),
    };
  }

  const transbordo = ultima(
    ativas.filter(
      (r) =>
        r.tipo === "transbordo" &&
        r.unidadeCodigo === cte.filial &&
        r.unidadeDestinoCodigo !== null &&
        cte.chegadas.has(r.unidadeDestinoCodigo),
    ),
  );
  const chegadaNoDestino = transbordo?.unidadeDestinoCodigo
    ? cte.chegadas.get(transbordo.unidadeDestinoCodigo)
    : undefined;
  if (transbordo?.prazoDias && chegadaNoDestino) {
    return {
      previsao: somarDias(diaEmSaoPaulo(chegadaNoDestino), transbordo.prazoDias),
      fonte: "regra_transbordo",
      dataBase: chegadaNoDestino,
    };
  }

  const chegadaNaUnidade = cte.filial !== null ? cte.chegadas.get(cte.filial) : undefined;
  const unidade = ultima(
    ativas.filter((r) => r.tipo === "unidade" && r.unidadeCodigo === cte.filial),
  );
  if (unidade?.prazoHoras && chegadaNaUnidade) {
    const fim = new Date(chegadaNaUnidade.getTime() + unidade.prazoHoras * 3_600_000);
    return { previsao: diaEmSaoPaulo(fim), fonte: "regra_unidade", dataBase: chegadaNaUnidade };
  }

  return { previsao: cte.previsaoSsw, fonte: cte.previsaoSswFonte, dataBase: null };
}

/** Filiais cujas chegadas (84) interessam às regras: unidades e destinos de transbordo. */
export function filiaisDeChegada(regras: readonly RegraDePrazo[]): string[] {
  const filiais = new Set<string>();
  for (const r of regras) {
    if (!r.ativo) continue;
    if (r.tipo === "unidade" && r.unidadeCodigo) filiais.add(r.unidadeCodigo);
    if (r.tipo === "transbordo" && r.unidadeDestinoCodigo) filiais.add(r.unidadeDestinoCodigo);
  }
  return [...filiais];
}

export function ehFonteDeRegra(fonte: string | null): fonte is FonteDeRegra {
  return (FONTES_DE_REGRA as readonly (string | null)[]).includes(fonte);
}
