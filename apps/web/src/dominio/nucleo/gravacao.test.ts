import { describe, expect, it } from "vitest";

import { CATALOGO_FR, ocorrencia } from "../testes/nucleo";
import {
  dataEmbarque,
  derivarResponsavelPeloTipo,
  efeitoDaAlteracaoDeCodigo,
  emissaoAncoradaNo80,
} from "./gravacao-ocorrencia";
import { abaixoDaDataMinima, canceladoMesmoDia, foraDoUniverso } from "./universo";

const d = (iso: string) => new Date(iso);
const CTE = { dataEmissao: "2026-11-05", criadoEm: d("2026-11-05T12:00Z") };

describe("universo (§7)", () => {
  it("data mínima: emissão anterior não entra; sem configuração, tudo entra", () => {
    expect(abaixoDaDataMinima("2026-08-31", "2026-09-01")).toBe(true);
    expect(abaixoDaDataMinima("2026-09-01", "2026-09-01")).toBe(false);
    expect(abaixoDaDataMinima("2020-01-01", null)).toBe(false);
  });

  it("cancelado no mesmo dia de Brasília", () => {
    expect(canceladoMesmoDia("2026-11-05", [ocorrencia(99, "2026-11-06T02:30Z")])).toBe(true);
    expect(canceladoMesmoDia("2026-11-05", [ocorrencia(99, "2026-11-06T13:00Z")])).toBe(false);
    expect(canceladoMesmoDia("2026-11-05", [ocorrencia(12, "2026-11-05T13:00Z")])).toBe(false);
  });

  it("99 em quarentena não cancela (Q21)", () => {
    const quarentena = ocorrencia(99, "2026-11-05T13:00Z", { quarentena: true });
    expect(canceladoMesmoDia("2026-11-05", [quarentena])).toBe(false);
  });

  it("fora do universo = cancelado no mesmo dia ou cópia", () => {
    expect(foraDoUniverso(false, null)).toBe(false);
    expect(foraDoUniverso(true, null)).toBe(true);
    expect(foraDoUniverso(false, "id-do-certo")).toBe(true);
  });
});

describe("catálogo de códigos (§8.4–8.6)", () => {
  it.each([
    [null, null, null],
    [
      "PENDENCIA_TRANSPORTADORA",
      null,
      { responsavel: "FR", letraResponsavel: "F", penaliza: true },
    ],
    [
      "PENDENCIA_CLIENTE",
      "ENTREGA",
      { responsavel: "destinatario", letraResponsavel: "D", penaliza: false },
    ],
    [
      "PENDENCIA_CLIENTE",
      "REENTREGA",
      { responsavel: "destinatario", letraResponsavel: "D", penaliza: false },
    ],
    [
      "PENDENCIA_CLIENTE",
      "COLETA",
      { responsavel: "cliente", letraResponsavel: "C", penaliza: false },
    ],
    ["BAIXA", null, { responsavel: "sistema", letraResponsavel: "S", penaliza: false }],
  ] as const)("tipo %j, processo %j", (tipo, processo, esperado) => {
    expect(derivarResponsavelPeloTipo(tipo, processo)).toEqual(esperado);
  });

  it("alteração de código: regrava responsável/penaliza; recalcula CT-e se mudou tipo ou descrição (Q20)", () => {
    const antes = CATALOGO_FR.get(85);
    expect(antes).toBeDefined();
    if (antes === undefined) return;
    expect(efeitoDaAlteracaoDeCodigo(antes, { ...antes, penaliza: true })).toEqual({
      regravarOcorrencias: { responsavel: "sistema", penaliza: true },
      recalcularCtes: false,
    });
    expect(efeitoDaAlteracaoDeCodigo(antes, { ...antes, tipoSsw: "INFORMATIVA" })).toEqual({
      regravarOcorrencias: null,
      recalcularCtes: true,
    });
    expect(efeitoDaAlteracaoDeCodigo(antes, { ...antes, descricao: "SAIU" }).recalcularCtes).toBe(
      true,
    );
  });
});

describe("efeitos da ocorrência no CT-e (§8.7–8.9)", () => {
  it("embarque = menor dia (Brasília) das 82/85, sem quarentena (Q21)", () => {
    expect(
      dataEmbarque([
        ocorrencia(85, "2026-11-07T12:00Z"),
        ocorrencia(82, "2026-11-06T02:00Z"),
        ocorrencia(82, "2026-11-04T12:00Z", { quarentena: true }),
        ocorrencia(88, "2026-11-01T12:00Z"),
      ]),
    ).toBe("2026-11-05");
    expect(dataEmbarque([])).toBeNull();
  });

  it("80 antecipa a emissão, nunca adia; quarentena e trackingdanfe antigo não valem", () => {
    expect(emissaoAncoradaNo80(CTE, [ocorrencia(80, "2026-11-03T12:00Z")])).toBe("2026-11-03");
    expect(emissaoAncoradaNo80(CTE, [ocorrencia(80, "2026-11-07T12:00Z")])).toBe("2026-11-05");
    expect(
      emissaoAncoradaNo80(CTE, [ocorrencia(80, "2026-11-03T12:00Z", { quarentena: true })]),
    ).toBe("2026-11-05");
    expect(
      emissaoAncoradaNo80(CTE, [
        ocorrencia(80, "2025-01-01T12:00Z", { origem: "trackingdanfe" }),
        ocorrencia(80, "2026-11-04T12:00Z", { origem: "trackingdanfe" }),
      ]),
    ).toBe("2026-11-04");
  });
});
