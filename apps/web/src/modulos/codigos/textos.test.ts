import { ACOES_EM_LOTE } from "@erp/shared/contratos/codigos-ocorrencia";
import { describe, expect, it } from "vitest";

import { ROTULO_DO_LOTE } from "./textos";

describe("textos de /admin/configuracoes › códigos", () => {
  it("cada ação em lote tem o rótulo do botão", () => {
    expect(ACOES_EM_LOTE.map((a) => ROTULO_DO_LOTE[a])).toEqual([
      "Ativar",
      "Desativar",
      "Marcar penaliza",
      "Desmarcar penaliza",
    ]);
  });
});
