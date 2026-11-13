import { describe, expect, it } from "vitest";

import { TODAS } from "./rules";
import { NIVEL, pct, ROTULO_DA_HORA_EXTRA } from "./texts";

describe("textos da bonificação de entrega", () => {
  it("rótulo e tom de cada nível", () => {
    expect(NIVEL.turbo).toMatchObject({ rotulo: "Turbo", tom: "sucesso" });
    expect(NIVEL.acelerado).toMatchObject({ rotulo: "Acelerado", tom: "info" });
    expect(NIVEL.em_rota).toMatchObject({ rotulo: "Em rota", tom: "alerta" });
    expect(NIVEL.sem_bonus).toMatchObject({ rotulo: "Sem bônus", tom: "erro" });
  });

  it("opções do filtro de hora extra, com Todas primeiro", () => {
    expect(Object.entries(ROTULO_DA_HORA_EXTRA)).toEqual([
      [TODAS, "Todas"],
      ["sim", "Fez hora extra"],
      ["nao", "Não fez"],
      ["sem_ponto", "Sem registro de ponto"],
    ]);
  });

  it("percentual arredondado", () => {
    expect(pct(0.954)).toBe("95%");
    expect(pct(0.956)).toBe("96%");
    expect(pct(1)).toBe("100%");
  });
});
