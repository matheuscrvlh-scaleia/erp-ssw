import { erroParaLog } from "@erp/db";
import { describe, expect, it } from "vitest";

import { ambienteDeTeste } from "../testes/cenario";
import { mascararUrl, opcoesDeLog } from "./log";

describe("mascararUrl", () => {
  it("esconde o segredo do webhook do SSW e o code do OAuth", () => {
    expect(mascararUrl("/api/public/ssw-webhook?secret=abc123&empresa=fr")).toBe(
      "/api/public/ssw-webhook?secret=[oculto]&empresa=fr",
    );
    expect(mascararUrl("/api/v1/auth/google/retorno?code=xyz&state=s1")).toBe(
      "/api/v1/auth/google/retorno?code=[oculto]&state=[oculto]",
    );
  });

  it("não mexe em URL sem query nem em parâmetros comuns", () => {
    expect(mascararUrl("/api/v1/calendario")).toBe("/api/v1/calendario");
    expect(mascararUrl("/api/v1/calendario?ano=2026")).toBe("/api/v1/calendario?ano=2026");
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
