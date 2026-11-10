/**
 * Gravação de CT-e e ocorrência pela ingestão, sempre pelo núcleo (`@erp/dominio/nucleo`): o que
 * antes eram os gatilhos de `ctrcs`/`ocorrencias` (trava do BI2, data mínima, derivados,
 * histórico de previsão, "não regravar igual").
 */
import {
  type ContextoDoCte,
  type CteNucleo,
  type FonteDaEscrita,
  type MotivoDoDescarte,
  type OcorrenciaDoCte,
  prepararGravacaoDoCte,
  type TrocaDePrevisao,
} from "@erp/dominio/nucleo";

/** Linha de `ctes` como o núcleo a lê, mais a identidade e as colunas que a ingestão grava. */
export interface CteGravado extends CteNucleo {
  id: string;
  sigla: string;
  numero: string;
  prazoEntrega: string | null;
  chaveNfe: string | null;
  numeroNf: number | null;
  serieNf: string | null;
  cnpjRemetente: string | null;
}

/** CT-e novo, ainda sem id. */
export type CteNovo = Omit<CteGravado, "id">;

/** O que a empresa do CT-e tem e o núcleo consulta (sem as ocorrências, que são do CT-e). */
export type ContextoDaEmpresa = Omit<ContextoDoCte, "ocorrencias"> & {
  dominioSsw: string | null;
};

export interface RepositorioCteNucleo {
  contextoDaEmpresa(): Promise<ContextoDaEmpresa>;
  ocorrenciasDosCtes(ids: readonly string[]): Promise<Map<string, OcorrenciaDoCte[]>>;
  /** Grava todas as colunas do CT-e (o núcleo já recalculou) com `atualizado_em = agora`. */
  atualizarCte(cte: CteGravado, agora: Date): Promise<void>;
  inserirCte(cte: CteNovo): Promise<CteGravado>;
  registrarTrocaDePrevisao(cteId: string, troca: TrocaDePrevisao): Promise<void>;
}

export type ResultadoDaGravacao =
  | { tipo: "descartado"; motivo: MotivoDoDescarte }
  | { tipo: "igual"; cte: CteGravado }
  | { tipo: "gravado"; cte: CteGravado };

/**
 * Aplica `alteracao` sobre o CT-e gravado e grava pelo núcleo. Linha igual não é regravada; troca
 * de previsão vai para o histórico na mesma transação.
 */
export async function alterarCte(entrada: {
  repo: RepositorioCteNucleo;
  antigo: CteGravado;
  alteracao: Partial<CteGravado>;
  fonte: FonteDaEscrita;
  contexto: ContextoDaEmpresa;
  ocorrencias: readonly OcorrenciaDoCte[];
  agora: Date;
}): Promise<ResultadoDaGravacao> {
  const { repo, antigo, contexto, agora } = entrada;
  const gravacao = prepararGravacaoDoCte<CteGravado>({
    antigo,
    novo: { ...antigo, ...entrada.alteracao, id: antigo.id },
    fonte: entrada.fonte,
    contexto: { ...contexto, ocorrencias: entrada.ocorrencias },
  });
  if (gravacao.tipo === "descartar") return { tipo: "descartado", motivo: gravacao.motivo };
  if (!gravacao.mudou) return { tipo: "igual", cte: antigo };
  await repo.atualizarCte(gravacao.cte, agora);
  if (gravacao.trocaDePrevisao)
    await repo.registrarTrocaDePrevisao(antigo.id, gravacao.trocaDePrevisao);
  return { tipo: "gravado", cte: gravacao.cte };
}

/** Cria o CT-e pelo núcleo (a data mínima de emissão e "o BI2 não cria" valem aqui). */
export async function criarCte(entrada: {
  repo: RepositorioCteNucleo;
  novo: CteNovo;
  fonte: FonteDaEscrita;
  contexto: ContextoDaEmpresa;
}): Promise<ResultadoDaGravacao> {
  const gravacao = prepararGravacaoDoCte<CteNovo>({
    antigo: null,
    novo: entrada.novo,
    fonte: entrada.fonte,
    contexto: { ...entrada.contexto, ocorrencias: [] },
  });
  if (gravacao.tipo === "descartar") return { tipo: "descartado", motivo: gravacao.motivo };
  return { tipo: "gravado", cte: await entrada.repo.inserirCte(gravacao.cte) };
}

/** CT-e vazio (o que o banco poria por padrão), para a ingestão completar e o núcleo derivar. */
export function cteVazio(entrada: {
  sigla: string;
  numero: string;
  dataEmissao: string;
  criadoEm: Date;
}): CteNovo {
  return {
    ...entrada,
    prazoEntrega: null,
    chaveNfe: null,
    numeroNf: null,
    serieNf: null,
    cnpjRemetente: null,
    duplicadoDe: null,
    dataEntregaRealizada: null,
    pagadorCnpj: null,
    parceiroCnpj: null,
    filial: null,
    unidadeDestino: null,
    unidadeAtual: null,
    camposSsw: [],
    ultOcorrCodigo0174: null,
    ultOcorrDescricao0174: null,
    ultOcorrData0174: null,
    ultOcorrLocal0174: null,
    ultOcorrInstrucao0174: null,
    ultimaOcorrCodigo0013: null,
    ultimaOcorrData0013: null,
    ocorr036Codigo: null,
    ocorr036Descricao: null,
    ocorr036Data: null,
    ocorrEfetivaCodigo: null,
    ocorrEfetivaDescricao: null,
    ocorrEfetivaData: null,
    ocorrEfetivaFonte: null,
    ocorrEfetivaLocal: null,
    ocorrEfetivaCodigoNum: null,
    dataPrevistaEntrega: null,
    prazoFonte: null,
    dataBasePrazo: null,
    previsaoSswData: null,
    previsaoSswFonte: null,
    previsaoSswDataBase: null,
    dataEmbarque: null,
    dataConclusaoEfetiva: null,
    pagadorCnpjDigitos: null,
    filialEfetiva: null,
    unidadeCidade: null,
    unidadeUf: null,
    prazoPadraoDias: null,
    prazoPadraoData: null,
    statusAtual: null,
    canceladoMesmoDia: false,
    foraUniverso: false,
  };
}
