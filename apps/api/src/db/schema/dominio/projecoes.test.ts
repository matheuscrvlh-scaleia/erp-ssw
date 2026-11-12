import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { romaneioConferenteCte } from "./projecoes";

describe("romaneio_conferente_cte", () => {
  it("guarda a chave de ordem da linha 036 vencedora, nulável (o worker-ssw compara com ela)", () => {
    const colunas = new Map(
      getTableConfig(romaneioConferenteCte).columns.map((c) => [c.name, c] as const),
    );
    const chave = [
      "data_ocorr_ctrc",
      "hora_ocorr_ctrc",
      "situacao",
      "data_emissao",
      "importado_em",
    ];
    expect(chave.map((nome) => [nome, colunas.get(nome)?.notNull])).toEqual(
      chave.map((nome) => [nome, false]),
    );
    expect(colunas.get("data_ocorr_ctrc")?.getSQLType()).toBe("date");
    expect(colunas.get("importado_em")?.getSQLType()).toBe("timestamp with time zone");
  });
});
