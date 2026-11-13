import { type CodigoDoRecorte } from "@erp/shared/contracts/listing";
import { describe, expect, it } from "vitest";

import { alternarRecorte, codigosDoGrupo, codigosEmAberto, mostraGraficoDeFaixa } from "./rules";

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

describe("códigos em aberto (abertos=1)", () => {
  const doRecorte: CodigoDoRecorte[] = [
    { codigo: 1, descricao: null, qtd: 4, tipo: "ENTREGA", penaliza: false },
    { codigo: 12, descricao: null, qtd: 2, tipo: "BAIXA", penaliza: false },
    { codigo: 35, descricao: null, qtd: 3, tipo: "PENDENCIA_CLIENTE", penaliza: true },
  ];
  it("sem marcados: os em aberto entre os do recorte", () => {
    expect(codigosEmAberto(["atrasados"], [], doRecorte)).toEqual([35]);
  });
  it("com marcados: só os marcados que estão em aberto", () => {
    expect(codigosEmAberto(["atrasados"], [12, 35, 85], doRecorte)).toEqual([35, 85]);
  });
  it("consulta com erro: nada a marcar além dos marcados em aberto", () => {
    expect(codigosEmAberto(["atrasados"], [], undefined)).toEqual([]);
  });
});

describe("gráfico Dias de Atraso", () => {
  it("só nos recortes de atraso", () => {
    expect(mostraGraficoDeFaixa(["emitidos"])).toBe(false);
    expect(mostraGraficoDeFaixa(["entregues", "sem_movimento"])).toBe(true);
  });
});
