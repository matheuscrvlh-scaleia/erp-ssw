import { describe, expect, it } from "vitest";

import { linhasDaExportacao } from "./exportacao";

describe("exportação do Histórico", () => {
  it("uma linha por anotação e por feriado do dia", () => {
    expect(
      linhasDaExportacao([
        {
          dia: "2026-11-05",
          anotacoes: [
            {
              id: "a",
              data: "2026-11-05",
              tipo: "clima",
              texto: "Chuva forte",
              autorId: "11111111-1111-4111-8111-111111111111",
              autorNome: "Ana",
              unidadeId: null,
              unidadeNome: null,
              criadoEm: "2026-11-05T12:00:00Z",
            },
          ],
          feriados: [
            {
              id: "f",
              data: "2026-11-05",
              tipo: "municipal",
              cidade: "Campinas",
              uf: "SP",
              descricao: "Aniversário",
              geradoAutomaticamente: false,
            },
          ],
        },
      ]),
    ).toEqual([
      {
        data: "2026-11-05",
        tipo: "Clima",
        texto: "Chuva forte",
        local: "",
        autor: "Ana",
        origem: "Anotação",
      },
      {
        data: "2026-11-05",
        tipo: "Feriado municipal",
        texto: "Aniversário",
        local: "Campinas/SP",
        autor: "",
        origem: "Feriado",
      },
    ]);
  });
});
