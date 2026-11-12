import { contrato } from "@erp/shared/contrato";
import { z } from "@erp/shared/zod";

const texto = z.string().nullable();
const numero = z.number().nullable();
const inteiroOuNulo = z.number().int().nullable();

export const ocorrenciaDoCtrc = z.object({
  id: z.uuid(),
  codigo: z.number().int(),
  descricao: texto,
  /** Instante (ISO). */
  dataHora: z.string(),
  responsavel: texto,
  penaliza: z.boolean(),
});
export type OcorrenciaDoCtrc = z.infer<typeof ocorrenciaDoCtrc>;

export const FONTES_OCORRENCIA_EFETIVA = ["bi2_0174", "bi2_0013", "webhook", "ssw_036"] as const;

export const detalheCtrc = z.object({
  id: z.uuid(),
  sigla: z.string(),
  numero: z.string(),
  numeroNf: inteiroOuNulo,
  chave: texto,
  chaveNfe: texto,
  dataEmissao: z.string(),
  dataEmbarque: texto,
  statusAtual: texto,

  prazoContratadoDias: inteiroOuNulo,
  dataPrevista: texto,
  prazoOrigem: texto,
  prazoFonte: texto,
  prazoPadraoDias: inteiroOuNulo,
  prazoPadraoData: texto,
  /** Instante da entrega (ISO). */
  dataEntrega: texto,

  performanceDias: inteiroOuNulo,
  /** Atraso calculado hoje (não a foto do BI2). */
  atrasoDias: inteiroOuNulo,
  noPrazo: z.boolean().nullable(),
  responsabilidadeCliente: z.boolean().nullable(),
  fontePerformance: texto,

  unidadeOrigem: texto,
  unidadeDestino: texto,
  unidadeAtual: texto,
  filial: texto,
  unidadeCidade: texto,
  unidadeUf: texto,
  localizacao: texto,

  remetente: texto,
  destinatario: texto,
  logradouroDestino: texto,
  numeroEnderecoDestino: texto,
  complementoDestino: texto,
  bairroDestino: texto,
  cidadeDestino: texto,
  ufDestino: texto,
  cepDestinatario: texto,
  setor: texto,
  setorDestino: texto,

  peso: numero,
  volumes: inteiroOuNulo,
  valorFrete: numero,
  valorMercadoria: numero,
  primeiroManifesto: texto,
  ultimoManifesto: texto,

  parceiroNome: texto,
  parceiroCnpj: texto,
  parceiro: z.object({ id: z.uuid(), nome: z.string(), cnpj: texto }).nullable(),

  /** Romaneio atual do CT-e (placa, motorista e número). */
  placa: texto,
  motorista: texto,
  romaneio: texto,

  efetiva: z.object({
    codigo: inteiroOuNulo,
    descricao: texto,
    dataHora: texto,
    fonte: z.enum(FONTES_OCORRENCIA_EFETIVA).nullable(),
  }),
  finalizacao: z.object({
    entregue: z.boolean(),
    baixa: z.object({ codigo: z.number().int(), descricao: texto }).nullable(),
  }),
  /** Códigos de baixa do catálogo da empresa (o selo do prazo usa). */
  codigosBaixa: z.array(z.number().int()),
  ocorrencias: z.array(ocorrenciaDoCtrc),
  bi2: z
    .object({ codigoRelatorio: z.string(), dataAlvo: z.string(), atualizadoEm: z.string() })
    .nullable(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});
export type DetalheCtrc = z.infer<typeof detalheCtrc>;

export const opcaoDeCtrc = z.object({
  sigla: z.string(),
  numero: z.string(),
  dataEmissao: z.string(),
  destinatario: texto,
  cidadeDestino: texto,
});
export type OpcaoDeCtrc = z.infer<typeof opcaoDeCtrc>;

export const contratosCtrc = {
  /**
   * Detalhe pelo número, com a sigla quando houver (`?sigla=CAP` ou `CAP033214` no caminho).
   * Número repetido entre séries sem sigla: devolve as opções para a tela pedir a escolha.
   */
  detalhe: contrato({
    metodo: "GET",
    caminho: "/api/v1/ctrc/:numero",
    parametros: z.object({ numero: z.string().trim().min(1).max(40) }),
    entrada: z.object({ sigla: z.string().trim().max(10).optional() }),
    saida: z.discriminatedUnion("tipo", [
      z.object({ tipo: z.literal("encontrado"), ctrc: detalheCtrc }),
      z.object({ tipo: z.literal("varios"), opcoes: z.array(opcaoDeCtrc) }),
      z.object({ tipo: z.literal("nao_encontrado") }),
    ]),
  }),
} as const;
