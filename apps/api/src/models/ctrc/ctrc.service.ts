import { atrasoDias, normCodigoOcorr } from "@erp/domain/core";
import {
  finalizacaoDoCtrc,
  lerIdentificacao,
  localizacaoExibida,
  ocorrenciasExibidas,
} from "@erp/domain/ctrc/detail";
import { FONTES_OCORRENCIA_EFETIVA, type OpcaoDeCtrc } from "@erp/shared/contracts/ctrc";

import { type Executor } from "../repositories";

/** Código do catálogo da empresa, com o que as telas de CT-e usam. */
export interface CodigoCadastrado {
  codigo: number;
  descricao: string;
  tipoSsw: string | null;
  penaliza: boolean;
  pendenciaAcompanhada: boolean;
}

/** Colunas do CT-e lidas pelo detalhe (datas de negócio como texto, instantes como Date). */
export interface CtrcGravado {
  id: string;
  sigla: string;
  numero: string;
  numeroNf: number | null;
  chave: string | null;
  chaveNfe: string | null;
  dataEmissao: string;
  dataEmbarque: string | null;
  statusAtual: string | null;
  prazoContratadoDias: number | null;
  dataPrevistaEntrega: string | null;
  prazoOrigem: string | null;
  prazoFonte: string | null;
  prazoPadraoDias: number | null;
  prazoPadraoData: string | null;
  dataEntregaRealizada: Date | null;
  performanceDias: number | null;
  noPrazo: boolean | null;
  responsabilidadeCliente: boolean | null;
  fontePerformance: string | null;
  unidadeOrigem: string | null;
  unidadeDestino: string | null;
  unidadeAtual: string | null;
  filial: string | null;
  unidadeCidade: string | null;
  unidadeUf: string | null;
  localizacaoAtual: string | null;
  ultOcorrInstrucao0174: string | null;
  remetente: string | null;
  destinatario: string | null;
  logradouroDestino: string | null;
  numeroEnderecoDestino: string | null;
  complementoDestino: string | null;
  bairroDestino: string | null;
  cidadeDestino: string | null;
  ufDestino: string | null;
  cepDestinatario: string | null;
  setor: string | null;
  setorDestino: string | null;
  peso: number | null;
  volumes: number | null;
  valorFrete: number | null;
  valorMercadoria: number | null;
  primeiroManifesto: string | null;
  ultimoManifesto: string | null;
  parceiroNome: string | null;
  parceiroCnpj: string | null;
  parceiro: { id: string; nome: string; cnpj: string | null } | null;
  ocorrEfetivaCodigo: string | null;
  ocorrEfetivaDescricao: string | null;
  ocorrEfetivaData: Date | null;
  ocorrEfetivaFonte: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface OcorrenciaGravada {
  id: string;
  codigo: number;
  descricao: string | null;
  dataHora: Date;
  responsavel: string;
  penaliza: boolean;
  criadoEm: Date;
}

export interface RomaneioAtual {
  placa: string | null;
  motorista: string | null;
  romaneio: string | null;
}

export interface UltimoBi2 {
  codigoRelatorio: string;
  dataAlvo: string;
  atualizadoEm: Date;
}

/**
 * Leituras de CT-e compartilhadas pelas telas (universo, catálogo, configuração) e as do detalhe.
 */
export interface RepositorioCtrc {
  /** Siglas das filiais próprias (o universo das telas), em ordem. */
  filiaisProprias(empresaId: string): Promise<string[]>;
  catalogo(empresaId: string): Promise<CodigoCadastrado[]>;
  /** Valores de configuração da empresa (o da empresa vence o padrão da plataforma). */
  configuracoes(empresaId: string, chaves: readonly string[]): Promise<Map<string, string>>;
  /** CT-e (fora os cancelados e cópias) com o número, e com a série quando dada. */
  ctesPorNumero(empresaId: string, numero: string, sigla: string | null): Promise<OpcaoDeCtrc[]>;
  ctrc(empresaId: string, sigla: string, numero: string): Promise<CtrcGravado | null>;
  /** Ocorrências fora da quarentena. */
  ocorrencias(cteId: string): Promise<OcorrenciaGravada[]>;
  romaneioAtual(empresaId: string, sigla: string, numero: string): Promise<RomaneioAtual | null>;
  ultimoBi2(empresaId: string, numero: string): Promise<UltimoBi2 | null>;
}

interface ContextoCtrc {
  empresaId: string;
}

type FonteDaEfetiva = (typeof FONTES_OCORRENCIA_EFETIVA)[number];

const ehFonteConhecida = (fonte: string | null): fonte is FonteDaEfetiva =>
  FONTES_OCORRENCIA_EFETIVA.some((f) => f === fonte);

/** O CT-e gravado com o que o detalhe decide sobre ele (atraso, efetiva, finalização...). */
export interface DetalheDoCtrc {
  ctrc: CtrcGravado;
  atrasoDias: number | null;
  localizacao: string | null;
  efetiva: {
    codigo: number | null;
    descricao: string | null;
    dataHora: Date | null;
    fonte: FonteDaEfetiva | null;
  };
  finalizacao: ReturnType<typeof finalizacaoDoCtrc>;
  codigosBaixa: ReadonlySet<number>;
  /** Só as que a tela mostra, na ordem dela. */
  ocorrencias: OcorrenciaGravada[];
  romaneio: RomaneioAtual | null;
  bi2: UltimoBi2 | null;
}

export type BuscaDoCtrc =
  | { tipo: "encontrado"; detalhe: DetalheDoCtrc }
  | { tipo: "varios"; opcoes: OpcaoDeCtrc[] }
  | { tipo: "nao_encontrado" };

/**
 * Detalhe do CT-e pela série + número (Q02). Sem série e com o número em mais de uma série,
 * devolve as opções para a tela pedir a escolha (antes dava "Falha ao carregar CTRC.").
 * origem: getCtrcByNumero (src/features/ctrc/ctrc.functions.ts, sistema atual)
 */
export async function obterDetalheCtrc(
  db: Executor<"ctrc">,
  ctx: ContextoCtrc,
  numero: string,
  sigla: string | undefined,
  agora: Date,
): Promise<BuscaDoCtrc> {
  const id = lerIdentificacao(numero, sigla);
  if (!id) return { tipo: "nao_encontrado" };
  return db(async ({ ctrc: repo }) => {
    const candidatos = await repo.ctesPorNumero(ctx.empresaId, id.numero, id.sigla);
    const [unico, ...outros] = candidatos;
    if (!unico) return { tipo: "nao_encontrado" };
    if (outros.length > 0) return { tipo: "varios", opcoes: candidatos };

    const gravado = await repo.ctrc(ctx.empresaId, unico.sigla, unico.numero);
    if (!gravado) return { tipo: "nao_encontrado" };
    const [catalogo, ocorrencias, romaneio, bi2] = [
      await repo.catalogo(ctx.empresaId),
      await repo.ocorrencias(gravado.id),
      await repo.romaneioAtual(ctx.empresaId, gravado.sigla, gravado.numero),
      await repo.ultimoBi2(ctx.empresaId, gravado.numero),
    ];
    return {
      tipo: "encontrado",
      detalhe: montarDetalhe(gravado, { catalogo, ocorrencias, romaneio, bi2 }, agora),
    };
  });
}

function montarDetalhe(
  c: CtrcGravado,
  extra: {
    catalogo: CodigoCadastrado[];
    ocorrencias: OcorrenciaGravada[];
    romaneio: RomaneioAtual | null;
    bi2: UltimoBi2 | null;
  },
  agora: Date,
): DetalheDoCtrc {
  const baixas = new Set(extra.catalogo.filter((k) => k.tipoSsw === "BAIXA").map((k) => k.codigo));
  const codigo = normCodigoOcorr(c.ocorrEfetivaCodigo);
  const descricao =
    (c.ocorrEfetivaDescricao?.trim() ? c.ocorrEfetivaDescricao : null) ??
    extra.catalogo.find((k) => k.codigo === codigo)?.descricao ??
    null;
  return {
    ctrc: c,
    atrasoDias: atrasoDias(c, baixas, agora),
    localizacao: localizacaoExibida(c.localizacaoAtual, c.ultOcorrInstrucao0174),
    efetiva: {
      codigo,
      descricao,
      dataHora: c.ocorrEfetivaData,
      fonte: ehFonteConhecida(c.ocorrEfetivaFonte) ? c.ocorrEfetivaFonte : null,
    },
    finalizacao: finalizacaoDoCtrc(
      c.dataEntregaRealizada,
      { codigoTexto: c.ocorrEfetivaCodigo, codigo, descricao },
      baixas,
    ),
    codigosBaixa: baixas,
    ocorrencias: ocorrenciasExibidas(extra.ocorrencias, c.dataEmissao),
    romaneio: extra.romaneio,
    bi2: extra.bi2,
  };
}
