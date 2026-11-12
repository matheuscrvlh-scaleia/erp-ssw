import { describe, expect, it } from "vitest";

import { ehConfiguracaoDeEstado, MASCARA, mudancaParaAuditoria } from "./auditoria";

describe("mudancaParaAuditoria", () => {
  it("alterar guarda só os campos que mudaram, sem as colunas de controle", () => {
    expect(
      mudancaParaAuditoria({
        acao: "alterar",
        antes: { nome: "A", ativo: true, atualizado_em: "x" },
        depois: { nome: "B", ativo: true, atualizado_em: "y" },
      }),
    ).toEqual({ antes: { nome: "A" }, depois: { nome: "B" } });
  });

  it("alterar só coluna de controle não gera registro", () => {
    expect(
      mudancaParaAuditoria({
        acao: "alterar",
        antes: { nome: "A", atualizado_por: "u1" },
        depois: { nome: "A", atualizado_por: "u2" },
      }),
    ).toBeNull();
  });

  it("criar e excluir tiram as colunas de controle", () => {
    expect(
      mudancaParaAuditoria({ acao: "criar", antes: null, depois: { chave: "x", criado_em: "t" } }),
    ).toEqual({ antes: null, depois: { chave: "x" } });
  });

  it("mascara coluna com cara de segredo, sem esconder que estava vazia", () => {
    expect(
      mudancaParaAuditoria({
        acao: "alterar",
        antes: { token_publico: null, senha_hash: "abc" },
        depois: { token_publico: "t", senha_hash: "def" },
      }),
    ).toEqual({
      antes: { token_publico: null, senha_hash: MASCARA },
      depois: { token_publico: MASCARA, senha_hash: MASCARA },
    });
  });

  it("configuração com chave de segredo mascara o valor; estado de job não registra", () => {
    expect(
      mudancaParaAuditoria({
        acao: "alterar",
        antes: { valor: "a" },
        depois: { valor: "b" },
        chaveDeConfiguracao: "edge_apikey",
      }),
    ).toEqual({ antes: { valor: MASCARA }, depois: { valor: MASCARA } });
    expect(
      mudancaParaAuditoria({
        acao: "alterar",
        antes: { valor: "1" },
        depois: { valor: "2" },
        chaveDeConfiguracao: "bi2_cursor",
      }),
    ).toBeNull();
  });

  it("estado de job: bi2_, enriq_periodo_, backfill_ (menos o token) e os dois flags", () => {
    expect(ehConfiguracaoDeEstado("backfill_inicio")).toBe(true);
    expect(ehConfiguracaoDeEstado("backfill_cron_token")).toBe(false);
    expect(ehConfiguracaoDeEstado("ftp_sync_rodando")).toBe(true);
    expect(ehConfiguracaoDeEstado("sla_meta_pct")).toBe(false);
  });
});
