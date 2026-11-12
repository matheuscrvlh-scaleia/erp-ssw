import { describe, expect, it } from "vitest";

import {
  calcularPainelDeComprovantes,
  classificarComprovantes,
  type CteEntregue,
  diaCobertoPeloArquivo,
  listarComprovantes,
} from "./comprovantes";

const entregue = (id: string, dia: string, extra: Partial<CteEntregue> = {}): CteEntregue => ({
  id,
  unidade: "RIO",
  dia,
  dataEntrega: new Date(`${dia}T15:00:00Z`),
  criadoEm: new Date("2026-11-01T00:00:00Z"),
  tipoDocumento455: "NORMAL",
  tipoDocumento: null,
  comprovanteEscaneado: null,
  tem88: false,
  ...extra,
});

/** Exemplo da spec (§3.5): 930 importado para 04/11. */
const CTES = [
  entregue("X", "2026-11-04", { tem88: true }),
  entregue("Y", "2026-11-04", { comprovanteEscaneado: true }),
  entregue("Z", "2026-11-04"),
  entregue("W", "2026-11-03", { tipoDocumento455: null }),
];
const comprovantes = classificarComprovantes(CTES, new Set(["2026-11-04"]));

describe("comprovantes", () => {
  it("dia coberto sai do nome do arquivo 930", () => {
    expect(diaCobertoPeloArquivo("930_ocorrencias_2026-11-04_0730.csv")).toBe("2026-11-04");
    expect(diaCobertoPeloArquivo("038_pendentes_2026-11-04_0730.csv")).toBeNull();
  });

  it("totais: W entra em entregues mas não é coberto (fora de pendentes e do %)", () => {
    const p = calcularPainelDeComprovantes(comprovantes, []);
    expect(p.totais).toEqual({ entregues: 4, digitalizados: 2, pendentes: 1, pct: 0.6667 });
    expect(p.porDia).toEqual([
      {
        dia: "2026-11-03",
        coberto: false,
        entregues: 1,
        digitalizados: 0,
        pendentes: 0,
        pct: null,
      },
      {
        dia: "2026-11-04",
        coberto: true,
        entregues: 3,
        digitalizados: 2,
        pendentes: 1,
        pct: 0.6667,
      },
    ]);
    expect(p.porTipoDocumento.map((t) => [t.tipoDocumento, t.entregues])).toEqual([
      ["NORMAL", 3],
      ["NAO INFORMADO", 1],
    ]);
    expect(p.tiposContagem).toEqual([
      { tipo: "NORMAL", qtd: 3 },
      { tipo: "__SEM_TIPO__", qtd: 1 },
    ]);
  });

  it("coluna 'N' do 455 também cobre o CT-e", () => {
    const [n] = classificarComprovantes(
      [entregue("N", "2026-11-03", { comprovanteEscaneado: false })],
      new Set(),
    );
    expect(n).toMatchObject({ coberto: true, digitalizado: false });
  });

  it("filtro de tipo vale para os blocos mas não para a contagem do seletor", () => {
    const p = calcularPainelDeComprovantes(comprovantes, ["__SEM_TIPO__"]);
    expect(p.totais.entregues).toBe(1);
    expect(p.tiposContagem).toHaveLength(2);
  });

  it("lista por status, da entrega mais recente, com desempate fixo", () => {
    expect(listarComprovantes(comprovantes, [], "pendentes").map((c) => c.id)).toEqual(["Z"]);
    expect(listarComprovantes(comprovantes, [], "digitalizados").map((c) => c.id)).toEqual([
      "Y",
      "X",
    ]);
    expect(listarComprovantes(comprovantes, [], "todos").at(-1)!.id).toBe("W");
  });
});
