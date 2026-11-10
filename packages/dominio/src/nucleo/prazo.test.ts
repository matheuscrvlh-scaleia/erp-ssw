import { describe, expect, it } from "vitest";

import { domingoDePascoa, feriadosNacionaisDoAno } from "../calendario";
import { ocorrencia } from "./apoio-testes";
import { CONFIGURACAO_PADRAO } from "./configuracao";
import {
  type CteParaPrazo,
  definirPrevisao,
  diasUteisEntre,
  feriadosQueContamNosDiasUteis,
  nascidoEmAtraso,
  prazoPadraoData,
  prazoPadraoDias,
  type RegraDePrazo,
  trocaDePrevisao,
} from "./prazo";

const FERIADOS_2026 = feriadosQueContamNosDiasUteis(
  feriadosNacionaisDoAno(2026).map((f) => ({ data: f.data, tipo: "nacional" })),
);

describe("Páscoa e feriados móveis 2025–2027 (§6.2)", () => {
  it.each([
    [2025, "2025-04-20", "2025-03-03", "2025-03-04", "2025-04-18", "2025-06-19"],
    [2026, "2026-04-05", "2026-02-16", "2026-02-17", "2026-04-03", "2026-06-04"],
    [2027, "2027-03-28", "2027-02-08", "2027-02-09", "2027-03-26", "2027-05-27"],
  ])("%i", (ano, pascoa, carnavalSeg, carnavalTer, sexta, corpus) => {
    expect(domingoDePascoa(ano)).toBe(pascoa);
    const datas = feriadosNacionaisDoAno(ano).map((f) => f.data);
    expect(datas).toEqual(expect.arrayContaining([carnavalSeg, carnavalTer, sexta, corpus]));
    expect(datas).toHaveLength(13);
  });
});

describe("dias úteis (§6.1)", () => {
  it.each([
    ["2026-11-06", "2026-11-09", 1],
    ["2026-11-09", "2026-11-06", -1],
    ["2026-11-19", "2026-11-23", 1],
    ["2026-10-30", "2026-11-03", 1],
    ["2026-11-07", "2026-11-08", 0],
    ["2026-11-10", "2026-11-10", 0],
  ])("(%s, %s) → %i", (prev, ent, esperado) => {
    expect(diasUteisEntre(prev, ent, FERIADOS_2026)).toBe(esperado);
  });

  it("nulo em qualquer ponta → nulo", () => {
    expect(diasUteisEntre(null, "2026-11-10", FERIADOS_2026)).toBeNull();
    expect(diasUteisEntre("2026-11-10", null, FERIADOS_2026)).toBeNull();
  });

  it("só feriado nacional pula o dia (Q23)", () => {
    const feriados = feriadosQueContamNosDiasUteis([
      { data: "2026-11-10", tipo: "municipal" },
      { data: "2026-11-11", tipo: "nacional" },
    ]);
    expect([...feriados]).toEqual(["2026-11-11"]);
  });
});

describe("prazo padrão e nascido em atraso (§6.3)", () => {
  const PAGADOR = "11.222.333/0001-81";
  it.each<[string | null, string, number | null, string | null, boolean]>([
    ["2026-11-07", PAGADOR, 2, "2026-11-08", true],
    ["2026-11-08", PAGADOR, 2, "2026-11-08", false],
    ["2026-11-09", PAGADOR, 2, "2026-11-08", false],
    ["2026-11-06", PAGADOR, 2, "2026-11-08", true],
    ["2026-11-05", PAGADOR, 2, null, false],
    [null, PAGADOR, 2, "2026-11-08", false],
    ["2026-11-07", "00.193.687/0001-00", null, null, false],
  ])("emissão 06/11, previsão %j, pagador %s", (previsao, pagador, dias, data, nascido) => {
    const diasPadrao = prazoPadraoDias(pagador, null, CONFIGURACAO_PADRAO);
    expect(diasPadrao).toBe(dias);
    const padraoData = prazoPadraoData("2026-11-06", previsao, diasPadrao);
    expect(padraoData).toBe(data);
    expect(nascidoEmAtraso(previsao, padraoData)).toBe(nascido);
  });

  it("TROCA pelo parceiro também; raiz e dias vêm da configuração (Q48)", () => {
    expect(prazoPadraoDias(null, "00193687000155", CONFIGURACAO_PADRAO)).toBeNull();
    expect(
      prazoPadraoDias("00193687000155", null, { prazoPadraoDias: 3, raizCnpjTroca: null }),
    ).toBe(3);
  });
});

describe("prazos configurados aplicados a cada gravação (§6.4, Q19)", () => {
  const regra = (extra: Partial<RegraDePrazo>): RegraDePrazo => ({
    id: "r1",
    tipo: "unidade",
    unidadeCodigo: null,
    unidadeDestinoCodigo: null,
    parceiroCnpj: null,
    prazoHoras: null,
    prazoDias: null,
    ativo: true,
    criadoEm: new Date("2026-10-01T00:00:00Z"),
    ...extra,
  });
  const cte = (extra: Partial<CteParaPrazo> = {}): CteParaPrazo => ({
    dataEmissao: "2026-11-04",
    filial: "CAP",
    parceiroCnpj: "11.222.333/0001-81",
    dataPrevistaEntrega: "2026-11-09",
    prazoFonte: "ssw_038",
    dataBasePrazo: null,
    previsaoSswData: null,
    previsaoSswFonte: null,
    previsaoSswDataBase: null,
    ...extra,
  });
  const unidadeCap = regra({ tipo: "unidade", unidadeCodigo: "CAP", prazoHoras: 48 });
  const transbordo = regra({
    id: "r2",
    tipo: "transbordo",
    unidadeCodigo: "CAP",
    unidadeDestinoCodigo: "RIO",
    prazoDias: 1,
  });
  const parceiro = regra({
    id: "r3",
    tipo: "parceiro",
    parceiroCnpj: "11.222.333/0001-81",
    prazoDias: 5,
  });
  const chegadaCap = ocorrencia(84, "2026-11-05T22:30:00-03:00", { filial: "CAP" });
  const chegadaRio = ocorrencia(84, "2026-11-06T01:00:00Z", { filial: "RIO" });

  it("unidade: 22:30 de Brasília + 48 h → 07/11; guarda a previsão do SSW", () => {
    expect(definirPrevisao(cte(), [chegadaCap], [unidadeCap])).toEqual({
      dataPrevistaEntrega: "2026-11-07",
      prazoFonte: "regra_unidade",
      dataBasePrazo: chegadaCap.dataHora,
      previsaoSswData: "2026-11-09",
      previsaoSswFonte: "ssw_038",
      previsaoSswDataBase: null,
    });
  });

  it("transbordo: 84 no destino em 05/11 22:00 de Brasília + 1 dia → 06/11; vence a de unidade", () => {
    const previsao = definirPrevisao(cte(), [chegadaCap, chegadaRio], [unidadeCap, transbordo]);
    expect(previsao.dataPrevistaEntrega).toBe("2026-11-06");
    expect(previsao.prazoFonte).toBe("regra_transbordo");
    expect(previsao.dataBasePrazo).toEqual(chegadaRio.dataHora);
  });

  it("parceiro vence todas: emissão + dias, base = meia-noite de Brasília", () => {
    const previsao = definirPrevisao(
      cte(),
      [chegadaCap, chegadaRio],
      [unidadeCap, transbordo, parceiro],
    );
    expect(previsao).toMatchObject({
      dataPrevistaEntrega: "2026-11-09",
      prazoFonte: "regra_parceiro",
      dataBasePrazo: new Date("2026-11-04T03:00:00Z"),
    });
  });

  it("sem chegada (ou só 84 em quarentena) a regra de unidade não vale", () => {
    const emQuarentena = ocorrencia(84, "2026-11-05T12:00Z", { filial: "CAP", quarentena: true });
    expect(definirPrevisao(cte(), [emQuarentena], [unidadeCap]).prazoFonte).toBe("ssw_038");
  });

  it("regra inativa ou que saiu: volta para a previsão do SSW guardada", () => {
    const comRegra = cte({
      dataPrevistaEntrega: "2026-11-07",
      prazoFonte: "regra_unidade",
      dataBasePrazo: chegadaCap.dataHora,
      previsaoSswData: "2026-11-09",
      previsaoSswFonte: "ssw_038",
    });
    const inativa = { ...unidadeCap, ativo: false };
    expect(definirPrevisao(comRegra, [chegadaCap], [inativa])).toEqual({
      dataPrevistaEntrega: "2026-11-09",
      prazoFonte: "ssw_038",
      dataBasePrazo: null,
      previsaoSswData: "2026-11-09",
      previsaoSswFonte: "ssw_038",
      previsaoSswDataBase: null,
    });
  });

  it("previsão nova do SSW num CT-e com regra fica guardada e a regra continua valendo", () => {
    const comRegra = cte({
      dataPrevistaEntrega: "2026-11-12",
      prazoFonte: "ssw_038",
      previsaoSswData: "2026-11-09",
      previsaoSswFonte: "ssw_038",
    });
    const previsao = definirPrevisao(comRegra, [chegadaCap], [unidadeCap]);
    expect(previsao.dataPrevistaEntrega).toBe("2026-11-07");
    expect(previsao.previsaoSswData).toBe("2026-11-12");
  });

  it("duas regras do mesmo tipo: vale a criada por último", () => {
    const outra = { ...parceiro, id: "r4", prazoDias: 8, criadoEm: new Date("2026-10-02T00:00Z") };
    expect(definirPrevisao(cte(), [], [outra, parceiro]).dataPrevistaEntrega).toBe("2026-11-12");
  });
});

describe("histórico de previsão (§6.5)", () => {
  it("só quando muda e a anterior não era nula", () => {
    const nova = { dataPrevistaEntrega: "2026-11-10", prazoFonte: "ssw_038" as const };
    expect(trocaDePrevisao(null, nova)).toBeNull();
    expect(trocaDePrevisao("2026-11-10", nova)).toBeNull();
    expect(trocaDePrevisao("2026-11-08", nova)).toEqual({
      dataAnterior: "2026-11-08",
      dataNova: "2026-11-10",
      fonte: "ssw_038",
    });
  });
});
