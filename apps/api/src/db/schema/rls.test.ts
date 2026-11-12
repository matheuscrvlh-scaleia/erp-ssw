import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "./index";

const tabelas = Object.values(schema).filter((valor) => is(valor, PgTable));

describe("RLS", () => {
  it("toda tabela com empresa_id tem política de leitura para erp_app", () => {
    const semPolitica = tabelas
      .map((t) => getTableConfig(t))
      .filter((c) => c.columns.some((col) => col.name === "empresa_id"))
      .filter((c) => !c.policies.some((p) => p.for === "select"))
      .map((c) => c.name);
    expect(semPolitica).toEqual([]);
  });

  it("todas as tabelas ficam no schema erp", () => {
    expect(tabelas.map((t) => getTableConfig(t).schema)).toEqual(tabelas.map(() => "erp"));
  });

  it("auditoria não tem política de alteração nem de exclusão", () => {
    const { policies } = getTableConfig(schema.auditoria);
    expect(policies.map((p) => p.for).sort()).toEqual(["insert", "select"]);
  });
});
