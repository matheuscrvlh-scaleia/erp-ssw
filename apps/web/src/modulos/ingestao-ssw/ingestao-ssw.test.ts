import { describe, expect, it } from "vitest";

import { situacaoDoEvento } from "./Cartao";

describe("situacaoDoEvento", () => {
  it("segue a mesma classificação dos contadores do diagnóstico", () => {
    expect(situacaoDoEvento({ statusHttp: 200, autenticado: true })).toBe("processado");
    expect(situacaoDoEvento({ statusHttp: 202, autenticado: true })).toBe("sem_vinculo");
    expect(situacaoDoEvento({ statusHttp: 200, autenticado: false })).toBe("rejeitado");
    expect(situacaoDoEvento({ statusHttp: 401, autenticado: true })).toBe("rejeitado");
    expect(situacaoDoEvento({ statusHttp: 503, autenticado: true })).toBe("erro");
  });
});
