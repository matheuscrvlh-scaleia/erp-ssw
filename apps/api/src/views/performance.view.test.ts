import { describe, expect, it } from "vitest";

import { type CteExportado } from "../models/performance/performance.service";
import { apresentarExportacao } from "./performance.view";

const cte = (id: string): CteExportado => ({
  id,
  numeroNf: 10,
  numero: "123",
  sigla: "ARA",
  dataEmissao: "2026-11-05",
  filial: "ARA",
  remetente: null,
  destinatario: null,
  cidadeDestino: "Campinas",
  ufDestino: "SP",
  peso: "10.500",
  volumes: 1,
  valorFrete: "99.90",
  placaColeta: null,
  placaEntrega: null,
  siglaCte: "CT",
  numeroCte: 55,
  statusAtual: null,
});

describe("apresentarExportacao", () => {
  it("uma linha por ocorrência; CT-e sem ocorrência sai uma vez; repassa o corte", () => {
    const r = apresentarExportacao({
      ctes: [
        {
          cte: cte("c0"),
          ocorrencias: [
            { cteId: "c0", codigo: 85, descricao: "Saída", dataHora: "2026-11-05T12:00:00.000Z" },
            { cteId: "c0", codigo: 1, descricao: "Entrega", dataHora: "2026-11-06T12:00:00.000Z" },
          ],
        },
        { cte: cte("c1"), ocorrencias: [] },
      ],
      truncado: true,
    });
    expect(r.truncado).toBe(true);
    expect(r.linhas).toHaveLength(3);
    expect(r.linhas[0]).toMatchObject({
      codigo: 85,
      unidade: "ARA",
      cidadeDestino: "Campinas/SP",
      peso: 10.5,
      valorFrete: 99.9,
      cteVinculo: "CT55",
    });
    expect(r.linhas[2]).toMatchObject({ codigo: null, descricao: null, dataHora: null });
  });
});
