import { decifrarSegredo } from "@erp/db/segredos";
import { describe, expect, it } from "vitest";

import { carregarAmbiente } from "./ambiente";
import { ErroDeUso, lerArgumentos } from "./argumentos";
import { chavesParaExecucao } from "./chaves";
import { apontaParaProducao, descreverConexao, verificarAlvos } from "./seguranca";

describe("argumentos", () => {
  it("padrões", () => {
    expect(lerArgumentos([])).toEqual({
      simulacao: false,
      tabelas: null,
      empresaId: null,
      tamanhoDoLote: 1000,
      recomecar: false,
      confirmarProducao: false,
      saida: ".migrador",
      ajuda: false,
    });
  });

  it("lê as opções", () => {
    const a = lerArgumentos([
      "--dry-run",
      "--tabelas",
      "ctes, ocorrencias",
      "--empresa",
      "F0000000-0000-4000-8000-000000000001",
      "--lote",
      "500",
      "--recomecar",
    ]);
    expect(a).toMatchObject({
      simulacao: true,
      tabelas: ["ctes", "ocorrencias"],
      empresaId: "f0000000-0000-4000-8000-000000000001",
      tamanhoDoLote: 500,
      recomecar: true,
    });
  });

  it("recusa opção desconhecida, empresa que não é uuid e lote fora da faixa", () => {
    expect(() => lerArgumentos(["--apagar"])).toThrow(ErroDeUso);
    expect(() => lerArgumentos(["--empresa", "fr"])).toThrow(/uuid/);
    expect(() => lerArgumentos(["--lote", "0"])).toThrow(/--lote/);
    expect(() => lerArgumentos(["--tabelas", " , "])).toThrow(/vazio/);
  });
});

describe("segurança", () => {
  const develop =
    "postgresql://erp_migracao:s3nh4@db.vyockehhhvomqcjqnuwb.supabase.co:5432/postgres";
  const producao = "postgresql://postgres:x@db.quyrhwmfbqikkpmiivuq.supabase.co:5432/postgres";
  const pooler =
    "postgresql://postgres.quyrhwmfbqikkpmiivuq:x@aws-0-sa-east-1.pooler.supabase.com:6543/postgres";

  it("reconhece produção pelo host, pelo usuário do pooler e em texto não-URL", () => {
    expect(apontaParaProducao(develop)).toBe(false);
    expect(apontaParaProducao(producao)).toBe(true);
    expect(apontaParaProducao(pooler)).toBe(true);
    expect(apontaParaProducao("host=db.QUYRHWMFBQIKKPMIIVUQ.supabase.co user=x")).toBe(true);
  });

  it("recusa produção sem --confirmar-producao", () => {
    expect(() => {
      verificarAlvos([develop, pooler], false);
    }).toThrow(/PRODUÇÃO/);
    expect(() => {
      verificarAlvos([develop, pooler], true);
    }).not.toThrow();
    expect(() => {
      verificarAlvos([develop, develop], false);
    }).not.toThrow();
  });

  it("descreve a conexão sem usuário nem senha", () => {
    const texto = descreverConexao(develop);
    expect(texto).toBe("db.vyockehhhvomqcjqnuwb.supabase.co:5432/postgres");
    expect(texto).not.toContain("s3nh4");
    expect(descreverConexao("host=x password=y")).not.toContain("y");
  });

  it("erro de configuração cita o campo, nunca o valor", () => {
    expect(() =>
      carregarAmbiente({ MIGRADOR_ORIGEM_URL: develop, SEGREDOS_CHAVE_ATUAL: "abc" }),
    ).toThrow(/MIGRADOR_DESTINO_URL, SEGREDOS_CHAVE_ATUAL/);
    try {
      carregarAmbiente({ MIGRADOR_ORIGEM_URL: develop });
    } catch (erro) {
      expect(String(erro)).not.toContain("s3nh4");
    }
  });
});

describe("chaves de segredo", () => {
  const chave = Buffer.alloc(32, 7).toString("base64");

  it("usa as chaves do ambiente", () => {
    const chaves = chavesParaExecucao(
      { SEGREDOS_CHAVES: `2:${chave}`, SEGREDOS_CHAVE_ATUAL: 2 },
      false,
    );
    expect(chaves.atual).toBe(2);
  });

  it("fora da simulação, sem chave é erro; na simulação, usa uma descartável", () => {
    expect(() => chavesParaExecucao({}, false)).toThrow(/SEGREDOS_CHAVES/);
    const chaves = chavesParaExecucao({}, true);
    expect(chaves.porVersao.size).toBe(1);
    expect(() => decifrarSegredo(chaves, { cifrado: "AAAA", versaoChave: 2 }, "x")).toThrow(
      /versão 2/,
    );
  });
});
