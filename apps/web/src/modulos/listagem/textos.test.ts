import { type CodigoDoRecorte, type LinhaLista } from "@erp/shared/contratos/listagem";
import { describe, expect, it } from "vitest";

import { COLUNAS_DA_EXPORTACAO, linhaExportada } from "./exportacao";
import { codigosDoGrupo } from "./SeletorDeOcorrencia";
import { alternarRecorte } from "./SeletorDeRecorte";
import { selo, textoDaFaixa } from "./textos";

describe("selo do atraso", () => {
  it.each([
    [null, false, null],
    [3, false, { texto: "Atrasado 3 dias", tom: "ruim_forte" }],
    [1, true, { texto: "Atrasado 1 dia", tom: "ruim", dica: "Entregue com atraso" }],
    [0, false, { texto: "Vence hoje", tom: "atencao" }],
    [0, true, { texto: "No prazo", tom: "bom" }],
    [-2, false, { texto: "No prazo", tom: "bom" }],
  ] as const)("atraso %s, entregue %s", (atraso, entregue, esperado) => {
    expect(selo(atraso, entregue)).toEqual(esperado);
  });
});

describe("textos das etiquetas", () => {
  it("faixa de peso/atraso", () => {
    expect(textoDaFaixa(10, 2000, "kg")).toBe("10 a 2.000 kg");
    expect(textoDaFaixa(3, null, "dias")).toBe("a partir de 3 dias");
    expect(textoDaFaixa(null, 5, "dias")).toBe("até 5 dias");
    expect(textoDaFaixa(null, null, "kg")).toBe("");
  });
});

describe("seletor Recorte", () => {
  it("emitidos é exclusivo e desmarcar tudo volta para ele", () => {
    expect(alternarRecorte(["atrasados"], "emitidos")).toEqual(["emitidos"]);
    expect(alternarRecorte(["emitidos"], "atrasados")).toEqual(["atrasados"]);
    expect(alternarRecorte(["atrasados"], "atrasados")).toEqual(["emitidos"]);
  });
  it("mantém a ordem da lista de recortes", () => {
    expect(alternarRecorte(["sem_movimento"], "entregues")).toEqual(["entregues", "sem_movimento"]);
  });
});

describe("atalhos do seletor Ocorrência", () => {
  const codigo = (c: number, tipo: string | null, qtd = 1, penaliza = false): CodigoDoRecorte => ({
    codigo: c,
    descricao: null,
    qtd,
    tipo,
    penaliza,
  });
  const codigos = [
    codigo(1, "ENTREGA"),
    codigo(12, "BAIXA"),
    codigo(35, "PENDENCIA_CLIENTE", 3, true),
    codigo(85, "INFORMATIVA"),
    codigo(40, "PENDENCIA_TRANSPORTADORA", 0),
  ];
  it("em aberto: sem entrega nem baixa, só códigos com CT-e no recorte", () => {
    expect(codigosDoGrupo("aberto", codigos, "atrasados")).toEqual([35, 85]);
  });
  it("pendências e penalizam", () => {
    expect(codigosDoGrupo("cliente", codigos, "atrasados")).toEqual([35]);
    expect(codigosDoGrupo("empresa", codigos, "atrasados")).toEqual([]);
    expect(codigosDoGrupo("penaliza", codigos, "atrasados")).toEqual([35]);
  });
});

describe("exportação", () => {
  const linha: LinhaLista = {
    id: "8f1d2c3b-0000-4000-8000-000000000001",
    sigla: "CAP",
    numero: "33214",
    numeroNf: 9988,
    destinatario: 'LOJA "CENTRO"; FILIAL',
    cidadeDestino: "MANAUS",
    bairroDestino: null,
    setor: null,
    setorDestino: "S2",
    unidadeDestino: "MAO",
    codigo: 35,
    descricao: "AGENDAMENTO",
    dataOcorrencia: "2026-11-09T13:00:00.000Z",
    placa: null,
    dataEmissao: "2026-11-03",
    dataPrevista: "2026-11-08",
    dataEntrega: null,
    dataEmbarque: null,
    parceiroNome: null,
    pagadorNome: "ACME",
    remetente: null,
    tipoDocumento: "NORMAL",
    peso: 1234.5,
    valorFrete: 10,
    volumes: 2,
    localizacao: null,
    primeiroManifesto: null,
    ultimoManifesto: null,
    valorMercadoria: null,
    atrasoDias: 2,
    performanceDias: null,
    noPrazo: null,
    responsabilidadeCliente: null,
    tde: 0,
  };

  it("linha achatada: setor do destino na falta do setor e TDE zero vazio", () => {
    const l = linhaExportada(linha);
    expect(l.setor).toBe("S2");
    expect(l.tde).toBeNull();
    expect(l.origem).toBe("CAP");
    expect(l.linkSsw).toContain("ssw0053");
  });

  it("28 colunas no arquivo, com o link do SSW no fim", () => {
    expect(COLUNAS_DA_EXPORTACAO).toHaveLength(28);
    expect(COLUNAS_DA_EXPORTACAO.at(-1)?.titulo).toBe("Link SSW");
  });
});
