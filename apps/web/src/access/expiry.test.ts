import { vencimentosParaAvisar } from "@erp/domain/access";
import { MODULOS } from "@erp/shared/access/modules";
import { somarDias } from "@erp/shared/dates";
import { describe, expect, it } from "vitest";

const HOJE = "2026-11-13";
const naoEssencial = MODULOS.find((m) => !m.essencial);
const essencial = MODULOS.find((m) => m.essencial);

describe("vencimentosParaAvisar (aviso 7, 5, 2 e 1 dia antes do fim)", () => {
  it("avisa só nos marcos, só módulo ligado e não essencial", () => {
    if (!naoEssencial || !essencial) throw new Error("catálogo sem módulos");
    const liberacao = (dias: number, ativo = true) => ({
      modulo: naoEssencial.chave,
      ativo,
      inicio: null,
      fim: somarDias(HOJE, dias),
    });
    for (const dias of [7, 5, 2, 1]) {
      expect(vencimentosParaAvisar(MODULOS, [liberacao(dias)], HOJE)).toEqual([
        {
          modulo: naoEssencial.chave,
          moduloNome: naoEssencial.nome,
          fim: somarDias(HOJE, dias),
          dias,
        },
      ]);
    }
    for (const dias of [8, 6, 3, 0, -1]) {
      expect(vencimentosParaAvisar(MODULOS, [liberacao(dias)], HOJE)).toEqual([]);
    }
    expect(vencimentosParaAvisar(MODULOS, [liberacao(5, false)], HOJE)).toEqual([]);
    expect(
      vencimentosParaAvisar(
        MODULOS,
        [{ modulo: essencial.chave, ativo: true, inicio: null, fim: somarDias(HOJE, 5) }],
        HOJE,
      ),
    ).toEqual([]);
  });
});
