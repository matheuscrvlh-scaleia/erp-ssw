import { OPCOES_PADRAO_DO_JOB, PREFIXO_DAS_FILAS } from "@erp/shared/ingestao";
import { type Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";

const criadas = vi.hoisted(() => [] as { nome: string; opcoes: unknown }[]);

vi.mock("bullmq", () => ({
  Queue: class {
    constructor(nome: string, opcoes: unknown) {
      criadas.push({ nome, opcoes });
    }
    add() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
  },
}));

const { criarEnfileirador } = await import("./enfileirador");

describe("criarEnfileirador", () => {
  it("usa o prefixo e a política de jobs do catálogo compartilhado (os mesmos do worker)", async () => {
    const redis = {} as Redis;
    const enfileirador = criarEnfileirador(redis);
    await enfileirador.enfileirar("ingestao", "ftp", { empresaId: "e1" });
    expect(criadas).toEqual([
      {
        nome: "ingestao",
        opcoes: {
          connection: redis,
          prefix: PREFIXO_DAS_FILAS,
          defaultJobOptions: OPCOES_PADRAO_DO_JOB,
        },
      },
    ]);
  });
});
