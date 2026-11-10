import { describe, expect, it } from "vitest";

import {
  alteracaoDoLote,
  classificacaoMudou,
  diferencas,
  estatisticasDoCatalogo,
  historicoDoCodigo,
  registroAuditavel,
} from "./codigos-admin";

const CODIGO = {
  descricao: "Devolução",
  responsavel: "FR" as const,
  penaliza: true,
  letraResponsavel: "F",
  ativo: true,
  pendenteClassificacao: false,
  notas: null,
};

describe("admin de códigos", () => {
  it("auditoria só com os campos que mudaram; sem mudança, nada", () => {
    const antes = registroAuditavel(CODIGO);
    expect(diferencas(antes, antes)).toBeNull();
    expect(diferencas(antes, registroAuditavel({ ...CODIGO, penaliza: false }))).toEqual({
      antes: { penaliza: true },
      depois: { penaliza: false },
    });
  });

  it("só penaliza e responsável pedem regravar as ocorrências", () => {
    expect(classificacaoMudou(CODIGO, { ...CODIGO })).toBe(false);
    expect(classificacaoMudou(CODIGO, { ...CODIGO, responsavel: "cliente" })).toBe(true);
    expect(alteracaoDoLote("penaliza_false")).toEqual({ penaliza: false });
    expect(alteracaoDoLote("desativar")).toEqual({ ativo: false });
  });

  it("estatísticas: pendentes incluem inativos; precisão sobre 30 dias", () => {
    const catalogo = [
      { codigo: 1, ativo: true, pendenteClassificacao: false },
      { codigo: 2, ativo: false, pendenteClassificacao: false },
      { codigo: 3, ativo: true, pendenteClassificacao: true },
    ];
    expect(
      estatisticasDoCatalogo(
        catalogo,
        new Map([
          [1, 75],
          [3, 25],
        ]),
      ),
    ).toEqual({
      total: 3,
      classificados: 1,
      pendentes: 2,
      ocorrenciasEmPendentes: 25,
      precisao: 0.75,
    });
    expect(estatisticasDoCatalogo(catalogo, new Map()).precisao).toBe(1);
  });

  it("histórico: uma linha por campo alterado, com as ações da tela", () => {
    const criadoEm = new Date("2026-11-10T12:00:00Z");
    const linhas = historicoDoCodigo([
      {
        id: "7",
        criadoEm,
        acao: "alterar",
        antes: { ativo: true, pendente_classificacao: true, descricao: "A" },
        depois: { ativo: false, pendente_classificacao: false, descricao: "B" },
        autorNome: "Ana",
      },
      { id: "6", criadoEm, acao: "criar", antes: null, depois: { codigo: 5 }, autorNome: null },
    ]);
    expect(linhas.map((l) => [l.acao, l.campo, l.valorAntigo, l.valorNovo])).toEqual([
      ["editou", "descricao", "A", "B"],
      ["desativou", "ativo", "true", "false"],
      ["classificou", "pendente_classificacao", "true", "false"],
      ["criou", null, null, '{"codigo":5}'],
    ]);
  });
});
