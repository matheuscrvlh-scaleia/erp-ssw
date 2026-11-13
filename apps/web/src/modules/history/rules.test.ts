import { type Feriado } from "@erp/shared/contracts/calendar";
import { type Anotacao } from "@erp/shared/contracts/history";
import { describe, expect, it } from "vitest";

import { lerFiltros } from "@/hooks/url-filters";

import { diasDoHistorico, intervaloDoPeriodo, podeAlterar } from "./rules";
import { esquemaDaBusca } from "./search";

const AUTOR = "11111111-1111-4111-8111-111111111111";
const anotacao = (id: string, data: string, extra: Partial<Anotacao> = {}): Anotacao => ({
  id,
  data,
  tipo: "clima",
  texto: "Chuva forte",
  autorId: AUTOR,
  autorNome: "Ana",
  unidadeId: null,
  unidadeNome: null,
  criadoEm: `${data}T12:00:00Z`,
  ...extra,
});
const feriado = (data: string): Feriado => ({
  id: `f-${data}`,
  data,
  tipo: "nacional",
  cidade: null,
  uf: null,
  descricao: "Feriado",
  geradoAutomaticamente: true,
});

describe("regras do Histórico", () => {
  const filtros = lerFiltros(esquemaDaBusca, {});

  it("período pelo dia de Brasília", () => {
    expect(intervaloDoPeriodo("7d", "2026-11-10")).toEqual({
      inicio: "2026-11-04",
      fim: "2026-11-10",
    });
    expect(intervaloDoPeriodo("mes", "2026-11-10").inicio).toBe("2026-11-01");
  });

  it("agrupa por dia, do mais recente, e filtra por presença, tipo e texto", () => {
    const anotacoes = [
      anotacao("a", "2026-11-05"),
      anotacao("b", "2026-11-07", { tipo: "operacional", texto: "Greve" }),
    ];
    const feriados = [feriado("2026-11-02"), feriado("2026-11-05")];
    expect(diasDoHistorico(anotacoes, feriados, filtros).map((d) => d.dia)).toEqual([
      "2026-11-07",
      "2026-11-05",
      "2026-11-02",
    ]);
    expect(
      diasDoHistorico(anotacoes, feriados, { ...filtros, presenca: "ambos" }).map((d) => d.dia),
    ).toEqual(["2026-11-05"]);
    expect(
      diasDoHistorico(anotacoes, [], { ...filtros, tipos: ["operacional"], q: "GREV" }).map(
        (d) => d.dia,
      ),
    ).toEqual(["2026-11-07"]);
  });

  it("Q09: só o autor ou um administrador altera", () => {
    const a = anotacao("a", "2026-11-05");
    expect(podeAlterar(a, AUTOR, false)).toBe(true);
    expect(podeAlterar(a, "outro", false)).toBe(false);
    expect(podeAlterar(a, "outro", true)).toBe(true);
  });
});
