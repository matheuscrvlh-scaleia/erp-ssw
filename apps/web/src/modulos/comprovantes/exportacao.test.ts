import { type LinhaDeComprovante } from "@erp/shared/contratos/comprovantes";
import { describe, expect, it } from "vitest";

import { colunasDaExportacao, linhaDaExportacao } from "./exportacao";

const linha: LinhaDeComprovante = {
  id: "0b6f3c1e-7d4a-4f2b-9a8e-1c2d3e4f5a6b",
  numeroCtrc: "1234",
  siglaCtrc: "RIO",
  numeroNf: 55,
  dataEntrega: "2026-11-10",
  dataEmissao: "2026-11-05",
  unidade: "RIO",
  setor: null,
  pagadorNome: "NATURA",
  remetente: null,
  destinatario: null,
  cidadeDestino: null,
  tipoDocumento: "NF",
  digitalizado: false,
};

describe("exportação de /comprovantes", () => {
  it("colunas da lista, só chave, título e formato", () => {
    expect(
      colunasDaExportacao([
        { chave: "dataEntrega", titulo: "Data de entrega", formato: "data", classe: "font-mono" },
      ]),
    ).toEqual([{ chave: "dataEntrega", titulo: "Data de entrega", formato: "data" }]);
  });

  it("comprovante por extenso e link do CT-e no SSW", () => {
    const l = linhaDaExportacao(linha);
    expect(l.digitalizado).toBe("Pendente");
    expect(linhaDaExportacao({ ...linha, digitalizado: true }).digitalizado).toBe("Digitalizado");
    expect(l.linkSsw).toContain("t_nro_ctrc=001234&t_data_ini=051126");
  });
});
