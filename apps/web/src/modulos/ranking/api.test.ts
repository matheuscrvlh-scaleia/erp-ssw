import { describe, expect, it } from "vitest";

import { consultaRankingPublico } from "./api";

describe("chaves de consulta do ranking", () => {
  it("o link público muda de cache quando muda o fim do período", () => {
    const novembro = consultaRankingPublico("t", "2026-11-01", "2026-11-30").queryKey;
    const parcial = consultaRankingPublico("t", "2026-11-01", "2026-11-15").queryKey;
    expect(novembro).not.toEqual(parcial);
    expect(novembro).toEqual(["ranking-publico", "t", "2026-11-01", "2026-11-30"]);
  });
});
