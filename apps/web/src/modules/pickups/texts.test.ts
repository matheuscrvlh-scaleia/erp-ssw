import { type ResultadoDaImportacao050 } from "@erp/shared/contracts/pickups";
import { describe, expect, it } from "vitest";

import { conferenciaDoResumo } from "./texts";

const resultado = (lidas: number, quantidade: number | null): ResultadoDaImportacao050 => ({
  emitidoEm: "2026-11-03T15:01:00.000Z",
  periodoCadastro: null,
  periodoColeta: null,
  unidades: ["ARA"],
  lidas,
  gravadas: lidas,
  ignoradas: 0,
  resumoSsw:
    quantidade === null
      ? null
      : {
          quantidade,
          cadastradas: 0,
          comandadas: 0,
          coletadas: 0,
          canceladas: 0,
          noPrazo: 0,
          atrasadas: 0,
        },
  avisos: [],
});

describe("importador do 050", () => {
  it("confere as lidas com o quadro RESUMO do SSW", () => {
    expect(conferenciaDoResumo(resultado(4, 4))).toEqual({
      ok: true,
      texto: "ok — 4 coletas no resumo",
    });
    expect(conferenciaDoResumo(resultado(3, 4)).ok).toBe(false);
    expect(conferenciaDoResumo(resultado(3, null)).texto).toBe("sem quadro de resumo");
  });
});
