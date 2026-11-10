import { type DadosDoPrazo } from "@erp/shared/contratos/admin";

import { ErroDeNegocio } from "./erros";
import { type RegraDePrazo } from "./nucleo";

/*
 * Cadastro dos prazos configurados no Admin: regra por unidade (horas a partir da chegada), por
 * parceiro (dias a partir da emissão) ou por transbordo unidade → unidade (dias a partir da
 * chegada no destino). O cálculo da previsão é do núcleo (`definirPrevisao`).
 * origem: prazos.functions.ts (sistema atual)
 */

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
