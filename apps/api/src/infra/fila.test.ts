import { OPCOES_PADRAO_DO_JOB, PREFIXO_DAS_FILAS } from "@erp/shared/ingestao";
import { type Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";

const criadas = vi.hoisted(() => [] as { nome: string; opcoes: unknown }[]);
const adicionados = vi.hoisted(() => [] as { fila: string; job: string; opcoes: unknown }[]);
const fechadas = vi.hoisted(() => [] as string[]);

vi.mock("bullmq", () => ({
  Queue: class {
    constructor(
      private readonly nome: string,
      opcoes: unknown,
    ) {
      criadas.push({ nome, opcoes });
    }
    add(job: string, _dados: unknown, opcoes: unknown) {
      adicionados.push({ fila: this.nome, job, opcoes });
      return Promise.resolve({ id: "1" });
    }
    close() {
      fechadas.push(this.nome);
      return Promise.resolve();
    }
  },
}));

const { criarFilasBullmq } = await import("./fila");

describe("criarFilasBullmq", () => {
  it("jobs dos módulos, filas da ingestão e enfileirador dividem uma Queue por fila", async () => {
    const redis = {} as Redis;
    const filas = criarFilasBullmq(redis, () => Promise.resolve());
    await filas.jobs.enfileirar({ fila: "ingestao.sla-arquivos", nome: "x" }, { empresaId: "e1" });
    await filas.ingestao.enfileirar("sla-arquivos", { empresaId: "e1" }, { deduplicar: "d1" });
    await filas.enfileirador.enfileirar("ingestao.sla-arquivos", "y", {}, { deduplicacao: "d2" });
    await filas.enfileirador.enfileirar("outra", "z", {});

    expect(criadas).toEqual([
      {
        nome: "ingestao.sla-arquivos",
        opcoes: {
          connection: redis,
          prefix: PREFIXO_DAS_FILAS,
          defaultJobOptions: OPCOES_PADRAO_DO_JOB,
        },
      },
      expect.objectContaining({ nome: "outra" }),
    ]);
    expect(adicionados).toEqual([
      { fila: "ingestao.sla-arquivos", job: "x", opcoes: undefined },
      {
        fila: "ingestao.sla-arquivos",
        job: "sla-arquivos",
        opcoes: { deduplication: { id: "d1" } },
      },
      { fila: "ingestao.sla-arquivos", job: "y", opcoes: { deduplication: { id: "d2" } } },
      { fila: "outra", job: "z", opcoes: {} },
    ]);

    await filas.fechar();
    expect(fechadas).toEqual(["ingestao.sla-arquivos", "outra"]);
  });
});
