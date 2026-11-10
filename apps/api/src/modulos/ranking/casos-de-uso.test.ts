import { describe, expect, it } from "vitest";

import { BancoEmMemoria } from "../../testes/banco-em-memoria";
import { rankingOperacional } from "./casos-de-uso";

// O driver do Postgres rejeita com Error + `code` (57014 = statement_timeout).
const TEMPO_ESGOTADO = Object.assign(new Error("canceling statement due to statement timeout"), {
  code: "57014",
});

function cenario(falhas: Error[]) {
  const banco = new BancoEmMemoria();
  banco.ranking.falhasDoRanking = falhas;
  const esperas: number[] = [];
  const executar = () =>
    rankingOperacional(
      (fn) => banco.executar({ empresaId: "e1", usuarioId: "u1", plataforma: false }, fn),
      { empresaId: "e1", fuso: "America/Sao_Paulo" },
      { grupo: "cidade", inicio: "2026-11-01", fim: "2026-11-10", baseData: "emissao" },
      {
        agora: new Date("2026-11-10T12:00:00Z"),
        esperar: (ms) => {
          esperas.push(ms);
          return Promise.resolve();
        },
        ehTempoEsgotado: (e) => e === TEMPO_ESGOTADO,
      },
    );
  return { banco, esperas, executar };
}

describe("rankingOperacional — tempo esgotado", () => {
  it("repete uma vez depois de 1,2 s", async () => {
    const { esperas, executar } = cenario([TEMPO_ESGOTADO]);
    await expect(executar()).resolves.toEqual([]);
    expect(esperas).toEqual([1200]);
  });

  it("estourou duas vezes: lista vazia, sem erro", async () => {
    const { banco, executar } = cenario([TEMPO_ESGOTADO, TEMPO_ESGOTADO]);
    await expect(executar()).resolves.toEqual([]);
    expect(banco.ranking.consultasRecebidas).toHaveLength(2);
  });

  it("outro erro sobe sem repetir", async () => {
    const erro = new Error("falhou");
    const { esperas, executar } = cenario([erro]);
    await expect(executar()).rejects.toBe(erro);
    expect(esperas).toEqual([]);
  });
});
