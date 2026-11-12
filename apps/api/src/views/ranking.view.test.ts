import { describe, expect, it } from "vitest";

import { type CalculoNoLote, type MembroGravado } from "../models/ranking/ranking.service";
import { apresentarRankingPublico, apresentarSimulacao } from "./ranking.view";

const membro = (nome: string, papel: "motorista" | "ajudante", posicao: number | null) =>
  ({
    id: `m-${nome}`,
    equipeId: "e1",
    nome,
    papel,
    cpf: "123",
    posicao,
    dataSaida: null,
  }) satisfies MembroGravado;

const calculo: CalculoNoLote = {
  equipeId: "e1",
  regraId: "r1",
  periodoInicio: "2026-11-01",
  periodoFim: "2026-11-10",
  totalEntregas: 10,
  entregasNoPrazo: 9,
  penalizantes: 1,
  performance: 90,
  pontos: 9,
  valorCalculado: 100,
  zeradoPorPiso: false,
  breakdown: [],
  nome: "Equipe 1",
  unidadeId: null,
  unidadeNome: null,
  membros: [
    membro("Zeca", "ajudante", 2),
    membro("Ana", "ajudante", 1),
    membro("Bia", "motorista", null),
  ],
};

describe("apresentarSimulacao", () => {
  it("membros na ordem da tela (motorista, depois ajudantes pela posição), só nome e papel", () => {
    const r = apresentarSimulacao({
      periodoInicio: "2026-11-01",
      periodoFim: "2026-11-10",
      regraId: "r1",
      equipes: [calculo],
    });
    expect(r.equipes[0]?.membros).toEqual([
      { nome: "Bia", papel: "motorista" },
      { nome: "Ana", papel: "ajudante" },
      { nome: "Zeca", papel: "ajudante" },
    ]);
    expect(r.equipes[0]).toMatchObject({ nome: "Equipe 1", valorCalculado: 100 });
  });
});

describe("apresentarRankingPublico", () => {
  it("da equipe só id e nome; o cálculo sem nome, unidade e membros", () => {
    const r = apresentarRankingPublico({
      equipe: {
        id: "e1",
        nome: "Equipe 1",
        unidadeId: null,
        ativo: true,
        tokenPublicoHash: "hash",
        tokenPublicoRevogado: false,
      },
      periodo: { inicio: "2026-11-01", fim: "2026-11-10" },
      calculo,
      posicao: 1,
      totalEquipes: 1,
      top3: [{ posicao: 1, nome: "Equipe 1" }],
    });
    expect(r.equipe).toEqual({ id: "e1", nome: "Equipe 1" });
    expect(r.calculo).not.toHaveProperty("membros");
    expect(r.calculo).not.toHaveProperty("nome");
    expect(r.calculo.valorCalculado).toBe(100);
  });
});
