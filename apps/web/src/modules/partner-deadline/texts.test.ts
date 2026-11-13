import { type NascidoAtrasado } from "@erp/shared/contracts/partner-deadline";
import { describe, expect, it } from "vitest";

import { destinoDe, opcoesDeTipo } from "./texts";

const nascido: NascidoAtrasado = {
  id: "00000000-0000-4000-8000-000000000001",
  sigla: "CPS",
  numero: "123",
  dataEmbarque: "2026-11-02",
  dataEmissao: "2026-11-02",
  dataPrevista: "2026-11-03",
  prazoPadraoData: "2026-11-04",
  diasAbaixoDoPadrao: 1,
  statusAtual: null,
  setor: null,
  unidadeNome: null,
  cidadeDestino: "Campinas",
  ufDestino: "SP",
};

describe("textos do Prazo do parceiro", () => {
  it("tipo vazio aparece como 'sem tipo'", () => {
    expect(opcoesDeTipo(["CTE", "__SEM_TIPO__"])).toEqual([
      { valor: "CTE", rotulo: "CTE" },
      { valor: "__SEM_TIPO__", rotulo: "sem tipo" },
    ]);
  });

  it("destino com a UF quando houver; sem cidade, nada", () => {
    expect(destinoDe(nascido)).toBe("Campinas/SP");
    expect(destinoDe({ ...nascido, ufDestino: null })).toBe("Campinas");
    expect(destinoDe({ ...nascido, cidadeDestino: null })).toBeNull();
  });
});
