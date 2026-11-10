import { describe, expect, it } from "vitest";

import { atrasoDias } from "../nucleo";
import {
  finalizacaoDoCtrc,
  lerIdentificacao,
  linkDoSsw,
  localizacaoExibida,
  ocorrenciasExibidas,
  statusDoPrazo,
} from "./detalhe";

const BAIXAS = new Set([12, 36, 61, 77, 92, 93, 94, 99]);

describe("identificação do CT-e (Q02)", () => {
  it("número sozinho, com zeros ou com a série no caminho", () => {
    expect(lerIdentificacao("33214")).toEqual({ sigla: null, numero: "33214" });
    expect(lerIdentificacao("033214")).toEqual({ sigla: null, numero: "33214" });
    expect(lerIdentificacao("CAP033214")).toEqual({ sigla: "CAP", numero: "33214" });
  });

  it("a série da query vale mais; sem dígitos não há o que buscar", () => {
    expect(lerIdentificacao("CAP033214", "cas")).toEqual({ sigla: "CAS", numero: "33214" });
    expect(lerIdentificacao("abc")).toBeNull();
  });
});

describe("ocorrências exibidas", () => {
  const o = (id: string, dataHora: string, criadoEm = dataHora) => ({
    id,
    dataHora: new Date(dataHora),
    criadoEm: new Date(criadoEm),
  });

  it("tira as de dia (Brasília) anterior à emissão e ordena da mais recente", () => {
    const lista = ocorrenciasExibidas(
      [
        o("antiga", "2026-11-05T02:00:00Z"), // 04/11 23:00 em SP: antes da emissão
        o("a", "2026-11-05T12:00:00Z"),
        o("b", "2026-11-06T12:00:00Z"),
        o("c", "2026-11-06T12:00:00Z", "2026-11-07T00:00:00Z"),
      ],
      "2026-11-05",
    );
    expect(lista.map((x) => x.id)).toEqual(["c", "b", "a"]);
  });
});

describe("localização", () => {
  it("rótulo truncado do 0013 cai para a instrução do 0174", () => {
    expect(localizacaoExibida("ROMANE", "EM ROTA")).toBe("EM ROTA");
    expect(localizacaoExibida("manifesto", "X")).toBe("X");
    expect(localizacaoExibida("CAMPINAS", "X")).toBe("CAMPINAS");
    expect(localizacaoExibida("", null)).toBeNull();
  });
});

describe("finalização", () => {
  it("entregue pela data ou pelo código; baixa só sem entrega", () => {
    const efetiva = (codigo: number) => ({ codigoTexto: String(codigo), codigo, descricao: "X" });
    expect(finalizacaoDoCtrc(null, efetiva(18), BAIXAS)).toEqual({ entregue: true, baixa: null });
    expect(finalizacaoDoCtrc(null, efetiva(12), BAIXAS)).toEqual({
      entregue: false,
      baixa: { codigo: 12, descricao: "X" },
    });
    expect(finalizacaoDoCtrc(new Date(), efetiva(12), BAIXAS).baixa).toBeNull();
  });
});

describe("link do SSW", () => {
  it("série, número com 6 dígitos e o dia da emissão", () => {
    expect(linkDoSsw("CAP", "3214", "2026-11-05")).toBe(
      "https://sistema.ssw.inf.br/bin/ssw0053?act=P1&t_ser_ctrc=CAP&t_nro_ctrc=003214&t_data_ini=051126&t_data_fin=051126",
    );
    expect(linkDoSsw(null, "3214", "2026-11-05")).toBeNull();
  });
});

describe("atraso do detalhe (núcleo, exemplos da spec 01 §5.1)", () => {
  const agora = new Date("2026-11-10T15:00:00Z");
  const cte = (
    prevista: string | null,
    entrega: string | null,
    codigo: string | null,
    perf: number | null = null,
  ) => ({
    dataPrevistaEntrega: prevista,
    dataEntregaRealizada: entrega ? new Date(entrega) : null,
    ocorrEfetivaCodigo: codigo,
    performanceDias: perf,
  });

  it("entrega pelo dia de Brasília, aberto por hoje, baixa vazio", () => {
    expect(atrasoDias(cte("2026-11-05", "2026-11-06T02:59:00Z", "1"), BAIXAS, agora)).toBe(0);
    expect(atrasoDias(cte("2026-11-05", "2026-11-07T15:00:00Z", "1"), BAIXAS, agora)).toBe(2);
    expect(atrasoDias(cte("2026-11-05", null, "85"), BAIXAS, agora)).toBe(5);
    expect(atrasoDias(cte("2026-11-12", null, "85"), BAIXAS, agora)).toBe(-2);
    expect(atrasoDias(cte("2026-11-05", null, "1", 2), BAIXAS, agora)).toBe(2);
    expect(atrasoDias(cte("2026-11-05", null, "18"), BAIXAS, agora)).toBeNull();
    expect(atrasoDias(cte("2026-11-05", null, "12"), BAIXAS, agora)).toBeNull();
    expect(atrasoDias(cte(null, null, "85"), BAIXAS, agora)).toBeNull();
  });
});

describe("status do prazo (T20, navegador em São Paulo)", () => {
  const base = {
    dataPrevista: "2026-11-08",
    dataEntrega: null,
    efetiva: { codigo: null, dataHora: null },
    ocorrencias: [],
    codigosBaixa: [...BAIXAS],
  };
  const agora = new Date("2026-11-10T15:00:00Z");
  const sp = "America/Sao_Paulo";

  it("entrega às 22h do dia previsto é no prazo; dois dias depois, atraso de 2", () => {
    expect(statusDoPrazo({ ...base, dataEntrega: "2026-11-09T01:00:00Z" }, agora, sp)).toEqual({
      tipo: "entregue_no_prazo",
    });
    expect(statusDoPrazo({ ...base, dataEntrega: "2026-11-10T15:00:00Z" }, agora, sp)).toEqual({
      tipo: "entregue_com_atraso",
      dias: 2,
    });
  });

  it("a ocorrência de entrega mais recente vale antes da data de entrega", () => {
    const ocorrencias = [{ codigo: 1, dataHora: "2026-11-08T12:00:00Z" }];
    expect(
      statusDoPrazo({ ...base, ocorrencias, dataEntrega: "2026-11-10T15:00:00Z" }, agora, sp).tipo,
    ).toBe("entregue_no_prazo");
  });

  it("sem previsão, baixado, no prazo e atrasado", () => {
    expect(statusDoPrazo({ ...base, dataPrevista: null }, agora, sp).tipo).toBe("sem_previsao");
    expect(
      statusDoPrazo({ ...base, efetiva: { codigo: 12, dataHora: null } }, agora, sp).tipo,
    ).toBe("baixado");
    expect(statusDoPrazo({ ...base, dataPrevista: "2026-11-10" }, agora, sp).tipo).toBe("no_prazo");
    expect(statusDoPrazo(base, agora, sp)).toEqual({ tipo: "atrasado", dias: 2 });
  });
});
