import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import { type Executor } from "../../repositorios";
import { BancoEmMemoria } from "../../testes/banco-em-memoria";
import { type Ator } from "../auditoria/auditoria";
import {
  type ContextoCalendario,
  criarFeriado,
  gerarNacionais,
  obterCalendario,
} from "./casos-de-uso";

const ator: Ator = {
  usuarioId: randomUUID(),
  email: "admin@fr.com.br",
  plataforma: false,
  ip: null,
  userAgent: null,
};

let banco: BancoEmMemoria;
let ctx: ContextoCalendario;
let db: Executor;

beforeEach(() => {
  banco = new BancoEmMemoria();
  ctx = { empresaId: banco.criarEmpresa().id, fuso: "America/Sao_Paulo", plataforma: false };
  db = (fn) =>
    banco.executar({ empresaId: ctx.empresaId, usuarioId: ator.usuarioId, plataforma: false }, fn);
});

describe("criarFeriado", () => {
  it("recorrente pula os anos em que o feriado já existe e limpa a cidade do estadual", async () => {
    const base = { tipo: "estadual" as const, uf: "SP" as const, descricao: "Data magna" };
    await criarFeriado(db, ctx, ator, {
      ...base,
      data: "2027-08-15",
      recorrente: false,
      anosAFrente: 5,
    });
    const r = await criarFeriado(db, ctx, ator, {
      ...base,
      cidade: "ignorada",
      data: "2026-08-15",
      recorrente: true,
      anosAFrente: 2,
    });
    expect(r).toEqual({ inseridos: 2, atualizados: 0 });
    expect(banco.feriados.map((f) => [f.data, f.cidade, f.uf])).toEqual([
      ["2027-08-15", null, "SP"],
      ["2026-08-15", null, "SP"],
      ["2028-08-15", null, "SP"],
    ]);
  });
});

describe("obterCalendario", () => {
  it("o próximo feriado usa o dia no fuso da empresa", async () => {
    await gerarNacionais(db, ctx, ator, 2026, 0);
    // 23h30 de 02/11 em São Paulo já é 03/11 em UTC: em SP, Finados ainda é hoje (o próximo).
    const r = await obterCalendario(db, ctx, 2026, new Date("2026-11-03T02:30:00Z"));
    expect(r.proximo?.descricao).toBe("Finados");
    expect(r.contagens.nacional).toBe(13);
  });
});
