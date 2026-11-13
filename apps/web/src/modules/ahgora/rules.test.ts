import { type FuncionarioApurado } from "@erp/shared/contracts/ahgora";
import { describe, expect, it } from "vitest";

import {
  entradaDaApuracao,
  filtrarFuncionarios,
  periodoDeBatidasValido,
  TODOS,
  totaisDaApuracao,
} from "./rules";

const apurado = (minutos: number, revisar: number, dias: number): FuncionarioApurado => ({
  register: "1",
  name: "Ana",
  department: "Entrega",
  demitido: false,
  diasComRegistro: dias,
  minutosApurados: minutos,
  diasARevisar: revisar,
  dias: [],
});

describe("regras do ponto (Ahgora)", () => {
  it("a apuração vai do dia 1 ao último dia do mês; 'todos' não manda departamento", () => {
    expect(entradaDaApuracao("2026-02", TODOS, false)).toEqual({
      inicio: "2026-02-01",
      fim: "2026-02-28",
      departamento: undefined,
      incluirDemitidos: "false",
    });
    expect(entradaDaApuracao("2026-12", "Entrega", true)).toEqual({
      inicio: "2026-12-01",
      fim: "2026-12-31",
      departamento: "Entrega",
      incluirDemitidos: "true",
    });
  });

  it("os cards somam minutos, dias a revisar e dias com registro de todos", () => {
    expect(totaisDaApuracao([apurado(500, 1, 20), apurado(40, 0, 3)])).toEqual({
      minutos: 540,
      revisar: 1,
      diasComRegistro: 23,
    });
    expect(totaisDaApuracao([])).toEqual({ minutos: 0, revisar: 0, diasComRegistro: 0 });
  });

  it("período das batidas: datas válidas, fim depois do início e até 30 dias", () => {
    expect(periodoDeBatidasValido("2026-11-01", "2026-11-01")).toBe(true);
    expect(periodoDeBatidasValido("2026-11-01", "2026-12-01")).toBe(true);
    expect(periodoDeBatidasValido("2026-11-01", "2026-12-02")).toBe(false);
    expect(periodoDeBatidasValido("2026-11-10", "2026-11-09")).toBe(false);
    expect(periodoDeBatidasValido("", "2026-11-09")).toBe(false);
  });

  it("a busca casa nome e matrícula sem caixa, e o CPF", () => {
    const lista = [
      { id: "a", register: "MAT-10", name: "Ana Souza", cpf: "12345678900" },
      { id: "b", register: "20", name: "Bruno Lima" },
    ];
    expect(filtrarFuncionarios(lista, "  ")).toBe(lista);
    expect(filtrarFuncionarios(lista, "ANA").map((f) => f.id)).toEqual(["a"]);
    expect(filtrarFuncionarios(lista, "mat-10").map((f) => f.id)).toEqual(["a"]);
    expect(filtrarFuncionarios(lista, "456").map((f) => f.id)).toEqual(["a"]);
    expect(filtrarFuncionarios(lista, "20").map((f) => f.id)).toEqual(["b"]);
  });
});
