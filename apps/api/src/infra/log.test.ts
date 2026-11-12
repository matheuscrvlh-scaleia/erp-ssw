import { erroParaLog } from "@erp/db";
import { describe, expect, it } from "vitest";

import { ambienteDeTeste } from "../testes/cenario";
import { mascararUrl, opcoesDeLog } from "./log";

describe("mascararUrl", () => {
  it("esconde o segredo do webhook do SSW", () => {
    expect(mascararUrl("/api/public/ssw-webhook?secret=abc123&empresa=fr")).toBe(
      "/api/public/ssw-webhook?secret=[oculto]&empresa=fr",
    );
  });

  it("não mexe em URL sem query nem em parâmetros comuns", () => {
    expect(mascararUrl("/api/v1/calendario")).toBe("/api/v1/calendario");
    expect(mascararUrl("/api/v1/calendario?ano=2026")).toBe("/api/v1/calendario?ano=2026");
  });

  it("esconde o token do link público do ranking, que vai no caminho", () => {
    const token = "a".repeat(48);
    expect(mascararUrl(`/api/public/ranking/${token}?inicio=2026-11-01`)).toBe(
      "/api/public/ranking/[oculto]?inicio=2026-11-01",
    );
    expect(mascararUrl(`/ranking/publico/${token}`)).toBe("/ranking/publico/[oculto]");
    expect(mascararUrl("/api/v1/ranking/equipes")).toBe("/api/v1/ranking/equipes");
  });

  it("ignora caixa no nome do parâmetro", () => {
    expect(mascararUrl("/x?Secret=1")).toBe("/x?Secret=[oculto]");
  });
});

describe("opcoesDeLog", () => {
  it("erro passa pelo serializador que tira SQL e parâmetros", () => {
    const opcoes = opcoesDeLog({ ...ambienteDeTeste(), NODE_ENV: "production" });
    const serializadores = typeof opcoes === "object" ? opcoes.serializers : undefined;
    expect(serializadores?.err).toBe(erroParaLog);
  });
});
