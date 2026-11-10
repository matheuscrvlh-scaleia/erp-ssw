import { describe, expect, it } from "vitest";

import {
  digitos,
  filialEfetiva,
  maiusculaAparada,
  normCodigoOcorr,
  numeroDoCte,
  numeroSsw,
  siglaDoCte,
  siglaDoSufixo,
  siglaSsw,
} from "./cte";
import {
  daLista,
  disparadoPor,
  etapaDaColeta,
  hashDoTokenPublico,
  sha256Hex,
  uuidDeterministico,
} from "./diversas";
import { ErroDeConversao } from "./erros";
import { jsonCanonico, lerJson, lerObjetoJson } from "./json";
import { codigoDeOcorrencia, decimal, dinheiro, peso, smallint } from "./numeros";
import { senhaLegada } from "./usuario";

describe("decimal (precisão: falha, nunca arredonda)", () => {
  it("fixa a escala do destino", () => {
    expect(dinheiro("10", "v")).toBe("10.00");
    expect(dinheiro("10.5", "v")).toBe("10.50");
    expect(peso("1.25", "p")).toBe("1.250");
    expect(decimal("0.95", "m", 8, 4)).toBe("0.9500");
  });

  it("aceita casas extras só se forem zeros", () => {
    expect(dinheiro("10.500", "v")).toBe("10.50");
    expect(() => dinheiro("10.555", "v")).toThrow(ErroDeConversao);
    expect(() => peso("0.0001", "p")).toThrow(/mais de 3 casas/);
  });

  it("recusa parte inteira que não cabe", () => {
    expect(dinheiro("999999999999.99", "v")).toBe("999999999999.99");
    expect(() => dinheiro("1000000000000", "v")).toThrow(/numeric\(14,2\)/);
  });

  it("mantém sinal, normaliza zero e zeros à esquerda", () => {
    expect(dinheiro("-3.1", "v")).toBe("-3.10");
    expect(dinheiro("-0.00", "v")).toBe("0.00");
    expect(dinheiro("0007.1", "v")).toBe("7.10");
  });

  it("nulo passa nulo; texto que não é número é erro", () => {
    expect(dinheiro(null, "v")).toBeNull();
    expect(() => dinheiro("NaN", "v")).toThrow(/não é um número/);
  });

  it("o erro carrega coluna e valor para o relatório", () => {
    try {
      dinheiro("1.234", "valor_frete");
      expect.unreachable();
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDeConversao);
      expect(erro).toMatchObject({ coluna: "valor_frete", valor: "1.234" });
    }
  });
});

describe("inteiros", () => {
  it("smallint recusa fora da faixa", () => {
    expect(smallint(32_767, "x")).toBe(32_767);
    expect(smallint(null, "x")).toBeNull();
    expect(() => smallint(32_768, "x")).toThrow(ErroDeConversao);
  });

  it("código de ocorrência só de 0 a 99", () => {
    expect(codigoDeOcorrencia(0, "codigo")).toBe(0);
    expect(codigoDeOcorrencia(99, "codigo")).toBe(99);
    expect(() => codigoDeOcorrencia(100, "codigo")).toThrow(/0–99/);
  });
});

describe("identidade do CT-e", () => {
  it("número: antes da barra e do traço, só dígitos, sem zero à esquerda", () => {
    expect(numeroDoCte("033214")).toBe("33214");
    expect(numeroDoCte("033214/CAP")).toBe("33214");
    expect(numeroDoCte("CAP033214-5")).toBe("33214");
    expect(numeroDoCte("abc")).toBeNull();
    expect(numeroDoCte("000")).toBe("0");
  });

  it("número e sigla do campo de relatório (ssw_num_ctrc / ssw_sigla_ctrc)", () => {
    expect(numeroSsw(" CAP033214-5 ")).toBe("33214");
    expect(siglaSsw(" cap033214-5")).toBe("CAP");
    expect(siglaSsw("033214")).toBeNull();
    expect(siglaSsw(null)).toBeNull();
  });

  it("sigla: a do CT-e, senão o sufixo do estacionado, senão a do 455", () => {
    expect(siglaDoCte(" cap ", "1", "CAS")).toBe("CAP");
    expect(siglaDoCte(null, "33214/cas", "CAP")).toBe("CAS");
    expect(siglaDoCte("  ", "33214", "CAR")).toBe("CAR");
    expect(siglaDoCte(null, "33214", null)).toBeNull();
    expect(siglaDoSufixo("33214")).toBeNull();
  });

  it("filial efetiva = coalesce(destino, atual, filial): vazio não é nulo", () => {
    expect(filialEfetiva(null, "RIO", "CAP")).toBe("RIO");
    expect(filialEfetiva(null, null, "CAP")).toBe("CAP");
    expect(filialEfetiva("", "RIO", "CAP")).toBe("");
  });

  it("dígitos do pagador e código numérico da ocorrência", () => {
    expect(digitos("12.345.678/0001-90")).toBe("12345678000190");
    expect(digitos("--")).toBeNull();
    expect(normCodigoOcorr("01")).toBe(1);
    expect(normCodigoOcorr("A-18")).toBe(18);
    expect(normCodigoOcorr("ABC")).toBeNull();
    expect(maiusculaAparada("  ")).toBeNull();
  });
});

describe("listas e valores derivados", () => {
  it("valor fora da lista fechada é erro", () => {
    expect(daLista("ativa", ["ativa", "suspensa"] as const, "status")).toBe("ativa");
    expect(() => daLista("x", ["ativa"] as const, "status")).toThrow(ErroDeConversao);
  });

  it("triggered_by: cron e nulo viram agendamento", () => {
    const lista = ["agendamento", "manual"] as const;
    expect(disparadoPor("cron", lista, "t")).toBe("agendamento");
    expect(disparadoPor(null, lista, "t")).toBe("agendamento");
    expect(disparadoPor("manual", lista, "t")).toBe("manual");
    expect(() => disparadoPor("api", lista, "t")).toThrow(ErroDeConversao);
  });

  it("etapa da coleta pela situação (vw_coletas)", () => {
    expect(etapaDaColeta("CANCELADA PELO CLIENTE")).toBe("cancelada");
    expect(etapaDaColeta("COLETADA")).toBe("coletada");
    expect(etapaDaColeta("COMANDADA")).toBe("comandada");
    expect(etapaDaColeta("coletada")).toBe("cadastrada");
    expect(etapaDaColeta(null)).toBe("cadastrada");
  });

  it("token público vira SHA-256 em hex (encode(sha256(token), 'hex'))", () => {
    expect(hashDoTokenPublico("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(hashDoTokenPublico(null)).toBeNull();
    expect(sha256Hex("abc")).toHaveLength(64);
  });

  it("uuid determinístico: estável, formato v5", () => {
    const a = uuidDeterministico("configuracoes", "", "chave");
    expect(a).toBe(uuidDeterministico("configuracoes", "", "chave"));
    expect(a).not.toBe(uuidDeterministico("configuracoes", "x", "chave"));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("JSON", () => {
  it("canônico ignora a ordem das chaves", () => {
    expect(jsonCanonico({ b: 1, a: [true, null, { d: "x", c: 2 }] })).toBe(
      jsonCanonico(lerJson('{"a": [true, null, {"c": 2, "d": "x"}], "b": 1}')),
    );
  });

  it("lerObjetoJson: nulo ou não-objeto vira objeto vazio", () => {
    expect(lerObjetoJson(null)).toEqual({});
    expect(lerObjetoJson("[1]")).toEqual({});
    expect(lerObjetoJson('{"a": 1}')).toEqual({ a: 1 });
  });
});

describe("senha do Supabase Auth", () => {
  const hash = `$2a$10$${"a".repeat(53)}`;

  it("leva o bcrypt de quem entra por senha hoje", () => {
    expect(senhaLegada(hash, "2026-01-01 00:00:00+00")).toEqual({ hash, algoritmo: "bcrypt" });
    expect(senhaLegada(hash.replace("$2a$", "$2b$"), "x").algoritmo).toBe("bcrypt");
  });

  it("sem senha, formato estranho ou e-mail não confirmado: sem hash, com motivo", () => {
    expect(senhaLegada("", "x")).toEqual({ hash: null, algoritmo: null, motivo: null });
    expect(senhaLegada(null, "x").hash).toBeNull();
    expect(senhaLegada("md5abc", "x")).toMatchObject({ hash: null, motivo: /formato/ });
    expect(senhaLegada(hash, null)).toMatchObject({ hash: null, motivo: /não confirmado/ });
  });
});
