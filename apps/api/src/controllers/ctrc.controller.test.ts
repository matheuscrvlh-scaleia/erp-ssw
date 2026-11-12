import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type CtrcGravado } from "../models/ctrc/ctrc.service";
import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../testes/cenario";

let cenario: Cenario;
let app: FastifyInstance;
let headers: { authorization: string };

function cte(sigla: string, numero: string, dados: Partial<CtrcGravado> = {}): CtrcGravado {
  return {
    id: crypto.randomUUID(),
    sigla,
    numero,
    numeroNf: null,
    chave: null,
    chaveNfe: null,
    dataEmissao: "2026-11-05",
    dataEmbarque: null,
    statusAtual: null,
    prazoContratadoDias: null,
    dataPrevistaEntrega: "2026-11-08",
    prazoOrigem: null,
    prazoFonte: null,
    prazoPadraoDias: null,
    prazoPadraoData: null,
    dataEntregaRealizada: null,
    performanceDias: null,
    noPrazo: null,
    responsabilidadeCliente: null,
    fontePerformance: null,
    unidadeOrigem: null,
    unidadeDestino: null,
    unidadeAtual: null,
    filial: null,
    unidadeCidade: null,
    unidadeUf: null,
    localizacaoAtual: null,
    ultOcorrInstrucao0174: null,
    remetente: null,
    destinatario: `DEST ${sigla}`,
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
    ocorrEfetivaCodigo: null,
    ocorrEfetivaDescricao: null,
    ocorrEfetivaData: null,
    ocorrEfetivaFonte: null,
    criadoEm: new Date("2026-11-05T10:00:00Z"),
    atualizadoEm: new Date("2026-11-06T10:00:00Z"),
    ...dados,
  };
}

beforeEach(async () => {
  cenario = criarCenario();
  app = await construirAppDeTeste(cenario);
  const empresaId = cenario.banco.criarEmpresa().id;
  const usuario = cenario.banco.criarUsuario({ email: "op@fr.com.br" });
  cenario.banco.vincular(usuario.id, empresaId, { papel: "operador" });
  headers = await entrarComo(cenario, usuario.id, empresaId);
  cenario.banco.ctrc.codigos = [
    {
      codigo: 12,
      descricao: "DEVOLUÇÃO",
      tipoSsw: "BAIXA",
      penaliza: false,
      pendenciaAcompanhada: false,
    },
    {
      codigo: 85,
      descricao: "SAIU PARA ENTREGA",
      tipoSsw: "INFORMATIVA",
      penaliza: false,
      pendenciaAcompanhada: false,
    },
  ];
});
afterEach(() => app.close());

describe("GET /api/v1/ctrc/:numero", () => {
  it("401 sem sessão", async () => {
    expect((await app.inject({ url: "/api/v1/ctrc/33214" })).statusCode).toBe(401);
  });

  it("não encontrado (inclusive número sem dígitos)", async () => {
    for (const numero of ["33214", "abc"]) {
      const r = await app.inject({ url: `/api/v1/ctrc/${numero}`, headers });
      expect(r.statusCode).toBe(200);
      expect(r.json()).toEqual({ tipo: "nao_encontrado" });
    }
  });

  it("número em duas séries: pede a escolha; com a série abre o certo (Q02)", async () => {
    cenario.banco.ctrc.ctes = [cte("CAP", "33214"), cte("CAS", "33214")];
    const ambos = await app.inject({ url: "/api/v1/ctrc/033214", headers });
    expect(ambos.json()).toMatchObject({
      tipo: "varios",
      opcoes: [{ sigla: "CAP" }, { sigla: "CAS" }],
    });

    const pelaQuery = await app.inject({ url: "/api/v1/ctrc/33214?sigla=cas", headers });
    expect(pelaQuery.json()).toMatchObject({ tipo: "encontrado", ctrc: { sigla: "CAS" } });
    const peloCaminho = await app.inject({ url: "/api/v1/ctrc/CAP033214", headers });
    expect(peloCaminho.json()).toMatchObject({ tipo: "encontrado", ctrc: { sigla: "CAP" } });
  });

  it("detalhe: efetiva com descrição do catálogo, atraso de hoje, romaneio e ocorrências exibidas", async () => {
    const gravado = cte("CAP", "33214", {
      ocorrEfetivaCodigo: "085",
      ocorrEfetivaData: new Date("2026-11-07T12:00:00Z"),
      ocorrEfetivaFonte: "webhook",
      localizacaoAtual: "ROMANE",
      ultOcorrInstrucao0174: "EM ROTA DE ENTREGA",
    });
    cenario.banco.ctrc.ctes = [gravado];
    cenario.banco.ctrc.romaneios = [
      { sigla: "CAP", numero: "33214", placa: "ABC1D23", motorista: "JOÃO", romaneio: "R1" },
    ];
    const ocorrencia = (codigo: number, dataHora: string) => ({
      id: crypto.randomUUID(),
      cteId: gravado.id,
      codigo,
      descricao: null,
      dataHora: new Date(dataHora),
      responsavel: "sistema",
      penaliza: false,
      criadoEm: new Date(dataHora),
    });
    cenario.banco.ctrc.ocorrenciasGravadas = [
      ocorrencia(80, "2026-11-04T12:00:00Z"), // antes da emissão: some
      ocorrencia(82, "2026-11-06T12:00:00Z"),
      ocorrencia(85, "2026-11-07T12:00:00Z"),
    ];
    const r = await app.inject({ url: "/api/v1/ctrc/33214", headers });
    expect(r.json()).toMatchObject({
      tipo: "encontrado",
      ctrc: {
        efetiva: { codigo: 85, descricao: "SAIU PARA ENTREGA", fonte: "webhook" },
        finalizacao: { entregue: false, baixa: null },
        atrasoDias: 2, // hoje 10/11 − previsão 08/11
        localizacao: "EM ROTA DE ENTREGA",
        placa: "ABC1D23",
        romaneio: "R1",
        codigosBaixa: [12],
        bi2: null,
      },
    });
    const { ctrc } = r.json<{ ctrc: { ocorrencias: { codigo: number }[] } }>();
    expect(ctrc.ocorrencias.map((o) => o.codigo)).toEqual([85, 82]);
  });

  it("baixado sem entrega pela efetiva do cadastro", async () => {
    cenario.banco.ctrc.ctes = [cte("CAP", "1", { ocorrEfetivaCodigo: "12" })];
    const r = await app.inject({ url: "/api/v1/ctrc/1", headers });
    expect(r.json()).toMatchObject({
      ctrc: {
        finalizacao: { entregue: false, baixa: { codigo: 12, descricao: "DEVOLUÇÃO" } },
        atrasoDias: null,
      },
    });
  });
});
