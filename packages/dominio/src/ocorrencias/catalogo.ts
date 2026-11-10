import { type Responsavel, type ResponsavelDoEvento } from "@erp/shared/contratos/ocorrencias";

/** O que as telas de ocorrências leem do catálogo de códigos da empresa. */
export interface CodigoDoCatalogo {
  codigo: number;
  descricao: string;
  responsavel: Responsavel;
  penaliza: boolean;
  pendenteClassificacao: boolean;
  pendenciaAcompanhada: boolean;
  /** Tipo SSW (`BAIXA` = finaliza sem entrega). */
  tipoSsw: string | null;
}

/** Configuração da empresa com os códigos de pendência que a tela Ocorrências não mostra. */
export const CONFIG_CODIGOS_FORA_DA_TELA = "ocorrencias_codigos_fora_da_tela";

/**
 * Lista "3, 40,55" de uma configuração: só os itens que são número inteiro; o resto é ignorado.
 * origem: parseListaInteiros (src/lib/config.server.ts, sistema atual)
 */
export function lerListaDeInteiros(valor: string | null): number[] {
  return (valor ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => /^\d+$/.test(item))
    .map(Number);
}

/**
 * Códigos acompanhados pela tela Ocorrências: pendências acompanhadas do catálogo, menos as que a
 * empresa tirou da tela. Código inativo continua (o sistema atual não olha `ativo`).
 * origem: _ocorrencias_codigos_tela (sistema atual)
 */
export function codigosDaTela(
  catalogo: readonly CodigoDoCatalogo[],
  foraDaTela: readonly number[],
): number[] {
  return catalogo
    .filter((c) => c.pendenciaAcompanhada && !foraDaTela.includes(c.codigo))
    .map((c) => c.codigo)
    .sort((a, b) => a - b);
}

/** Códigos que finalizam o CT-e sem entrega: tipo SSW "BAIXA" no catálogo da empresa (Q22). */
export function codigosDeBaixa(catalogo: readonly CodigoDoCatalogo[]): Set<number> {
  return new Set(catalogo.filter((c) => c.tipoSsw === "BAIXA").map((c) => c.codigo));
}

export interface Classificacao {
  pendente: boolean;
  penaliza: boolean;
  responsavel: ResponsavelDoEvento;
  descricao: string;
}

/**
 * Classificação de uma ocorrência na tela: sempre a do catálogo no momento da consulta. Código
 * sem cadastro ou ainda não classificado fica "pendente" e não penaliza.
 * origem: CTE ev/oc_all/base de ocorrencias_painel_v5 / lista_v5 / codigos_bucket_v3
 */
export function classificar(
  codigo: number,
  descricaoDaOcorrencia: string | null,
  doCatalogo: CodigoDoCatalogo | undefined,
): Classificacao {
  const pendente = doCatalogo === undefined || doCatalogo.pendenteClassificacao;
  return {
    pendente,
    penaliza: pendente ? false : doCatalogo.penaliza,
    responsavel: pendente ? "pendente" : doCatalogo.responsavel,
    descricao: doCatalogo?.descricao ?? descricaoDaOcorrencia ?? `Código ${codigo}`,
  };
}

/** A ocorrência pesa contra a operação: penaliza e não é responsabilidade do cliente. */
export function pesaContraAOperacao(c: Pick<Classificacao, "penaliza" | "responsavel">): boolean {
  return c.penaliza && c.responsavel !== "cliente";
}
