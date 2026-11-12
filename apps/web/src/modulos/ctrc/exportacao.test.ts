import { type DetalheCtrc } from "@erp/shared/contratos/ctrc";
import { describe, expect, it } from "vitest";

import { COLUNAS_DO_PDF, linhasDoPdf } from "./exportacao";

const VAZIO = {
  id: "00000000-0000-4000-8000-000000000001",
  sigla: "CAP",
  numero: "33214",
  numeroNf: null,
  chave: null,
  chaveNfe: null,
  dataEmissao: "2026-11-03",
  dataEmbarque: null,
  statusAtual: null,
  prazoContratadoDias: null,
  dataPrevista: null,
  prazoOrigem: null,
  prazoFonte: null,
  prazoPadraoDias: null,
  prazoPadraoData: null,
  dataEntrega: null,
  performanceDias: null,
  atrasoDias: null,
  noPrazo: null,
  responsabilidadeCliente: null,
  fontePerformance: null,
  unidadeOrigem: null,
  unidadeDestino: null,
  unidadeAtual: null,
  filial: null,
  unidadeCidade: null,
  unidadeUf: null,
  localizacao: null,
  remetente: null,
  destinatario: null,
  logradouroDestino: null,
  numeroEnderecoDestino: null,
  complementoDestino: null,
  bairroDestino: null,
  cidadeDestino: null,
  ufDestino: null,
  cepDestinatario: null,
  setor: null,
  setorDestino: null,
  peso: null,
  volumes: null,
  valorFrete: null,
  valorMercadoria: null,
  primeiroManifesto: null,
  ultimoManifesto: null,
  parceiroNome: null,
  parceiroCnpj: null,
  parceiro: null,
  placa: null,
  motorista: null,
  romaneio: null,
  efetiva: { codigo: null, descricao: null, dataHora: null, fonte: null },
  finalizacao: { entregue: false, baixa: null },
  codigosBaixa: [],
  ocorrencias: [],
  bi2: null,
  criadoEm: "2026-11-03T12:00:00Z",
  atualizadoEm: "2026-11-03T12:00:00Z",
} satisfies DetalheCtrc;

const valor = (ctrc: DetalheCtrc, secao: string, campo: string) =>
  linhasDoPdf(ctrc, "America/Sao_Paulo").find((l) => l.secao === secao && l.campo === campo)?.valor;

describe("PDF do CT-e", () => {
  it("três colunas e uma linha por campo de cada bloco", () => {
    expect(COLUNAS_DO_PDF.map((c) => c.chave)).toEqual(["secao", "campo", "valor"]);
    expect(linhasDoPdf(VAZIO, "America/Sao_Paulo")).toHaveLength(27);
    expect(linhasDoPdf(VAZIO, "America/Sao_Paulo")[0]).toEqual({
      secao: "Identificação",
      campo: "Número NF",
      valor: "—",
    });
  });

  it("valores formatados e os substitutos quando falta o dado", () => {
    expect(valor(VAZIO, "Identificação", "Número CTRC")).toBe("CAP 33214");
    expect(valor(VAZIO, "Identificação", "Emissão")).toBe("03/11/2026");
    expect(valor(VAZIO, "Prazos & Entrega", "Prazo contratado")).toBe("—");

    const cheio: DetalheCtrc = {
      ...VAZIO,
      numeroNf: 9988,
      prazoContratadoDias: 5,
      parceiro: {
        id: "00000000-0000-4000-8000-000000000002",
        nome: "Parceiro X",
        cnpj: "12345678000190",
      },
      setor: "Norte",
    };
    expect(valor(cheio, "Identificação", "Número NF")).toBe("9988");
    expect(valor(cheio, "Prazos & Entrega", "Prazo contratado")).toBe("5 dias");
    expect(valor(cheio, "Parceiro", "Nome")).toBe("Parceiro X");
    expect(valor(cheio, "Parceiro", "CNPJ")).toBe("12.345.678/0001-90");
    expect(valor(cheio, "Remetente / Destinatário", "Setor")).toBe("Norte");
  });
});
