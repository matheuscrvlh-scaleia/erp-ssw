import { describe, expect, it, vi } from "vitest";

import {
  alternarAcao,
  chaveDoNome,
  definirExcecao,
  gerarSenha,
  linhasDaTela,
  listaDasExcecoes,
  mapaDasExcecoes,
  permissoesEfetivas,
  resumoDoAcesso,
  ultimosDias,
} from "./regras";

describe("permissões por ação", () => {
  it("ligar Criar/Editar liga o Ver; desligar o Ver tira tudo da tela", () => {
    const comEditar = alternarAcao(new Set(), "calendario", "editar", true);
    expect([...comEditar].sort()).toEqual(["calendario.editar", "calendario.ver"]);
    const comExcluir = alternarAcao(comEditar, "calendario", "excluir", true);
    expect(alternarAcao(comExcluir, "calendario", "ver", false).size).toBe(0);
  });

  it("acessos tem uma linha por tela; permissões, uma por evento e os recursos", () => {
    expect(linhasDaTela("acessos", "historico")).toEqual([
      { tela: "historico", acao: "ver", rotulo: "Histórico" },
    ]);
    expect(linhasDaTela("permissoes", "historico").map((l) => l.rotulo)).toEqual([
      "Histórico · Criar/Editar",
      "Histórico · Excluir",
    ]);
    expect(linhasDaTela("permissoes", "romaneio")).toEqual([]);
    expect(linhasDaTela("acessos", "romaneio_placa")).toEqual([]);
    expect(linhasDaTela("permissoes", "romaneio_placa").map((l) => l.acao)).toEqual(["ver"]);
  });

  it("Ranking grava as duas chaves e a volta não duplica", () => {
    const mapa = definirExcecao(
      definirExcecao({}, "ranking", "ver", "nega"),
      "romaneio",
      "ver",
      "concede",
    );
    const lista = listaDasExcecoes(mapa);
    expect(lista).toEqual([
      { permissao: "ranking.ver", efeito: "nega" },
      { permissao: "ranking_novo.ver", efeito: "nega" },
      { permissao: "romaneio.ver", efeito: "concede" },
    ]);
    expect(listaDasExcecoes(mapaDasExcecoes(lista))).toEqual(lista);
    expect(definirExcecao(mapa, "ranking", "ver", undefined)).toEqual({
      "romaneio.ver": "concede",
    });
  });

  it("acesso efetivo = cargo + Sim − Não, e o resumo conta o Ranking uma vez", () => {
    const mapa = definirExcecao(
      definirExcecao({}, "ranking", "ver", "nega"),
      "romaneio",
      "ver",
      "concede",
    );
    const efetivas = permissoesEfetivas(
      "operador",
      ["ranking.ver", "ranking_novo.ver", "historico.ver"],
      mapa,
    );
    expect([...efetivas].sort()).toEqual(["historico.ver", "romaneio.ver"]);
    expect(resumoDoAcesso(mapa, efetivas)).toBe("2 exceções · 2 permissões ativas");
  });

  it("chave sugerida pelo nome e senha gerada sem caracteres ambíguos", () => {
    expect(chaveDoNome("Financeiro Jr. São Paulo")).toBe("financeiro_jr_sao_paulo");
    const senha = gerarSenha();
    expect(senha).toHaveLength(16);
    expect(senha).not.toMatch(/[0O1lI]/);
  });
});

describe("período dos logs", () => {
  it("os últimos N dias terminam hoje no fuso da empresa", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T02:00:00Z"));
    expect(ultimosDias(30, "America/Sao_Paulo")).toEqual({ de: "2026-01-29", ate: "2026-02-28" });
    vi.useRealTimers();
  });
});
