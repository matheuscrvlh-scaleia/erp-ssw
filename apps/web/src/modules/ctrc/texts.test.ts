import { formatarData, formatarPeso } from "@erp/shared/formatting";
import { describe, expect, it } from "vitest";

import {
  formatarCep,
  formatarChave,
  identificacao,
  nasceuEmAtraso,
  origemDaPrevisao,
  pontualidade,
  textoDaPerformance,
  textoDoAtraso,
  textoDoPrazoMinimo,
} from "./texts";

describe("detalhe do CT-e — textos", () => {
  it("título: NF quando houver, senão o CTRC", () => {
    expect(identificacao(9988, "33214")).toEqual({
      rotulo: "NF",
      principal: "9988",
      secundario: "33214",
    });
    expect(identificacao(null, "33214")).toEqual({
      rotulo: "CTRC",
      principal: "33214",
      secundario: null,
    });
  });

  it("peso em kg ou t, CEP e chave", () => {
    expect(formatarPeso(850, { tonelada: 3, quilo: 3, fixas: true })).toBe("850,000 kg");
    expect(formatarPeso(1500, { tonelada: 3, quilo: 3, fixas: true })).toBe("1,500 t");
    expect(formatarPeso(null, { tonelada: 3, quilo: 3, fixas: true })).toBe("—");
    expect(formatarCep("69000000")).toBe("69000-000");
    expect(formatarCep(" 123 ")).toBe("123");
    expect(formatarChave("1".repeat(44))).toBe(Array(11).fill("1111").join(" "));
  });

  it("origem da previsão (fora da malha depende de ter data)", () => {
    expect(origemDaPrevisao("bi2", null)).toContain("SSW BI2");
    expect(origemDaPrevisao("fora_malha", "2026-11-10")).toContain("dProg");
    expect(origemDaPrevisao("fora_malha", null)).toContain("não disponível");
    expect(origemDaPrevisao("outra", null)).toContain("não identificada");
  });

  it("prazo mínimo de 48 h", () => {
    expect(textoDoPrazoMinimo("2026-11-05", 2, formatarData)).toBe(
      "05/11/2026 (emissão + 48 horas corridas)",
    );
    expect(textoDoPrazoMinimo(null, 2, formatarData)).toBe(
      "não avaliado (previsão anterior à emissão)",
    );
    expect(textoDoPrazoMinimo(null, null, formatarData)).toBe("não avaliado (TROCA)");
  });

  it("performance e atraso", () => {
    expect(textoDaPerformance(2)).toBe("+2 dias");
    expect(textoDaPerformance(-1)).toBe("-1 dia");
    expect(textoDaPerformance(null)).toBe("—");
    expect(textoDoAtraso(0)).toBe("—");
    expect(textoDoAtraso(1)).toBe("1 dia");
  });

  it("nascido em atraso: previsão antes do prazo mínimo", () => {
    expect(nasceuEmAtraso("2026-11-04", "2026-11-05")).toBe(true);
    expect(nasceuEmAtraso("2026-11-05", "2026-11-05")).toBe(false);
    expect(nasceuEmAtraso(null, "2026-11-05")).toBe(false);
  });

  it("pontualidade", () => {
    const base = {
      noPrazo: null,
      responsabilidadeCliente: null,
      dataEntrega: null,
      baixado: false,
    };
    expect(pontualidade({ ...base, responsabilidadeCliente: true, noPrazo: false })).toBe(
      "responsabilidade_cliente",
    );
    expect(pontualidade({ ...base, baixado: true })).toBe("baixado");
    expect(pontualidade({ ...base, noPrazo: true })).toBe("no_prazo");
    expect(pontualidade({ ...base, noPrazo: false })).toBe("fora_do_prazo");
    expect(pontualidade(base)).toBe("em_transito");
    expect(pontualidade({ ...base, dataEntrega: "2026-11-09T10:00:00Z" })).toBe("em_apuracao");
  });
});
