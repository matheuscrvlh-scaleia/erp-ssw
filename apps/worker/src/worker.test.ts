import { randomUUID } from "node:crypto";

import { type ContextoBanco } from "@erp/db";
import { z } from "@erp/shared/zod";
import { UnrecoverableError } from "bullmq";
import { pino } from "pino";
import { describe, expect, it } from "vitest";

import {
  agendamentosDesejados,
  type FilaAgendavel,
  sincronizarAgendamentos,
} from "./agendamentos/agendamentos";
import { limparSessoes } from "./jobs/manutencao/job";
import { definirJob, type ExecutorDoWorker, type RepositoriosDoWorker } from "./jobs/registro";
import { criarProcessador } from "./processador";
import { BancoFalso } from "./testes/banco-falso";

const log = pino({ level: "silent" });
const EMPRESA = randomUUID();

function bancoFalso() {
  const contextos: ContextoBanco[] = [];
  const limites: Date[] = [];
  const banco = new BancoFalso();
  const executar: ExecutorDoWorker = (contexto, fn) => {
    contextos.push(contexto);
    return banco.executar(contexto, (repositorios: RepositoriosDoWorker) =>
      fn({
        ...repositorios,
        manutencao: {
          ...repositorios.manutencao,
          apagarSessoesEncerradas: (limite) => {
            limites.push(limite);
            return Promise.resolve(3);
          },
          apagarTokensDeSenhaVencidos: () => Promise.resolve(1),
        },
      }),
    );
  };
  return { executar, contextos, limites };
}

const porEmpresa = definirJob({
  nome: "conferir-empresa",
  fila: "manutencao",
  escopo: "empresa",
  dados: z.object({ empresaId: z.uuid() }),
  agendamento: "*/30 * * * *",
  processar: async ({ executar, empresaId }) => {
    await executar(() => Promise.resolve(empresaId));
  },
});

describe("processador", () => {
  it("roda job da Plataforma no contexto da Plataforma", async () => {
    const banco = bancoFalso();
    const agora = new Date("2026-11-10T06:00:00Z");
    const processar = criarProcessador({
      jobs: [limparSessoes],
      executar: banco.executar,
      log,
      agora: () => agora,
    });
    await processar({ name: "limpar-sessoes", data: {} });
    expect(banco.contextos).toEqual([{ empresaId: null, usuarioId: null, plataforma: true }]);
    expect(banco.limites).toEqual([new Date("2026-11-03T06:00:00Z")]);
  });

  it("roda job por empresa com o contexto da empresa (igual à API)", async () => {
    const banco = bancoFalso();
    const processar = criarProcessador({
      jobs: [porEmpresa],
      executar: banco.executar,
      log,
      agora: () => new Date(),
    });
    await processar({ name: "conferir-empresa", data: { empresaId: EMPRESA } });
    expect(banco.contextos).toEqual([{ empresaId: EMPRESA, usuarioId: null, plataforma: false }]);
  });

  it("job desconhecido ou dado inválido não é repetido", async () => {
    const banco = bancoFalso();
    const processar = criarProcessador({
      jobs: [porEmpresa],
      executar: banco.executar,
      log,
      agora: () => new Date(),
    });
    await expect(processar({ name: "nao-existe", data: {} })).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    await expect(
      processar({ name: "conferir-empresa", data: { empresaId: "x" } }),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(banco.contextos).toEqual([]);
  });
});

describe("agendamentos", () => {
  const empresas = [{ id: EMPRESA, fuso: "America/Manaus" }];

  it("um por job da Plataforma e um por empresa nos jobs por empresa, no fuso dela", () => {
    expect(agendamentosDesejados([limparSessoes, porEmpresa], empresas)).toEqual([
      {
        id: "limpar-sessoes",
        job: "limpar-sessoes",
        padrao: "0 3 * * *",
        fuso: "America/Sao_Paulo",
        dados: {},
      },
      {
        id: `conferir-empresa:${EMPRESA}`,
        job: "conferir-empresa",
        padrao: "*/30 * * * *",
        fuso: "America/Manaus",
        dados: { empresaId: EMPRESA },
      },
    ]);
  });

  function filaFalsa(existentes: string[]) {
    const chaves = new Set(existentes);
    const fila: FilaAgendavel = {
      getJobSchedulers: () => Promise.resolve([...chaves].map((key) => ({ key }))),
      upsertJobScheduler: (id) => Promise.resolve(chaves.add(id)),
      removeJobScheduler: (id) => Promise.resolve(chaves.delete(id)),
    };
    return { fila, chaves };
  }

  it("sincroniza: cria os que faltam e remove os que sobraram", async () => {
    const { fila, chaves } = filaFalsa(["conferir-empresa:empresa-desativada"]);
    const desejados = agendamentosDesejados([limparSessoes, porEmpresa], empresas);
    expect(await sincronizarAgendamentos(fila, desejados)).toEqual({ criados: 2, removidos: 1 });
    expect([...chaves].sort()).toEqual([`conferir-empresa:${EMPRESA}`, "limpar-sessoes"]);
  });

  it("desligados por env: nenhum agendamento fica na fila", async () => {
    const { fila, chaves } = filaFalsa(["limpar-sessoes"]);
    await sincronizarAgendamentos(fila, []);
    expect(chaves.size).toBe(0);
  });
});
