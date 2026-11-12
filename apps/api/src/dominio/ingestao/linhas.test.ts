import { describe, expect, it } from "vitest";

import { identificarLinha } from "./linhas";

describe("identificarLinha", () => {
  it("mesma linha, mesmo hash; um campo do hash muda, o hash muda", () => {
    const a = identificarLinha("038", { ctrc: "CAP033214-5", atraso: 2 });
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(identificarLinha("038", { ctrc: "CAP033214-5", atraso: 2 }).hash).toBe(a.hash);
    expect(identificarLinha("038", { ctrc: "CAP033214-5", atraso: 3 }).hash).not.toBe(a.hash);
    // Campo fora da lista do hash não muda o hash.
    expect(identificarLinha("038", { ctrc: "CAP033214-5", atraso: 2, x: 1 }).hash).toBe(a.hash);
  });

  it("chave do CT-e: sigla e número juntos, ou nenhum", () => {
    expect(identificarLinha("038", { ctrc: "CAP033214-5" })).toMatchObject({
      sigla: "CAP",
      numero: "33214",
      dataReferencia: null,
    });
    expect(identificarLinha("038", { ctrc: "033214" })).toMatchObject({
      sigla: null,
      numero: null,
    });
    // 306: coleta pura não tem chave de CT-e.
    expect(
      identificarLinha("306", { ctrc_coleta: "123456", data: "2026-11-05" }).numero,
    ).toBeNull();
  });

  it("dia de referência em São Paulo: 930 pela ocorrência, 036 pela emissão do romaneio", () => {
    expect(
      identificarLinha("930", { ctrc: "CAP1-1", ocorrencia_em: "2026-11-05 09:30" }).dataReferencia,
    ).toEqual(new Date("2026-11-05T12:30:00Z"));
    expect(
      identificarLinha("036", { ctrc: "CAP1-1", data_emissao: "2026-11-05" }).dataReferencia,
    ).toEqual(new Date("2026-11-05T03:00:00Z"));
  });
});
