import { type ResultadoDaImportacao050 } from "@erp/shared/contratos/coletas";
import { describe, expect, it } from "vitest";

import { lerFiltros } from "@/hooks/filtros-na-url";
import { temFiltro } from "@/hooks/filtros-na-url";

import { alternar, esquemaDaBusca, etiquetasDaBusca, filtrosDaBusca } from "./busca";
import { conferenciaDoResumo, lerArquivo050 } from "./Importador050";

const ler = (b: Record<string, unknown>) => lerFiltros(esquemaDaBusca, b);

const resultado = (lidas: number, quantidade: number | null): ResultadoDaImportacao050 => ({
  emitidoEm: "2026-11-03T15:01:00.000Z",
  periodoCadastro: null,
  periodoColeta: null,
  unidades: ["ARA"],
  lidas,
  gravadas: lidas,
  ignoradas: 0,
  resumoSsw:
    quantidade === null
      ? null
      : {
          quantidade,
          cadastradas: 0,
          comandadas: 0,
          coletadas: 0,
          canceladas: 0,
          noPrazo: 0,
          atrasadas: 0,
        },
  avisos: [],
});

describe("busca de /coletas", () => {
  it("padrão 30 dias; tipo vazio vira nulo na API; status inválido volta a todas", () => {
    const b = ler({ tipo: "", status: "xyz", unidades: "ARA" });
    expect(b).toMatchObject({ periodo: "30d", status: "todas", unidades: ["ARA"] });
    expect(filtrosDaBusca(b, { inicio: "2026-10-01", fim: "2026-10-31" }).tipo).toBeNull();
    expect(temFiltro(["periodo"], ler({ periodo: "7d" }).periodo)).toBe(false);
  });

  it("etiquetas e alternância de solicitante (vazio = sem solicitante)", () => {
    const b = ler({ solicitantes: [""], tipo: "REVERSA", status: "vencidas" });
    expect(etiquetasDaBusca(b).map((e) => [e.rotulo, e.valor])).toEqual([
      ["Solicitante", "(sem solicitante)"],
      ["Tipo", "Reversa"],
      ["Situação", "Vencidas"],
    ]);
    expect(alternar(["A", "B"], "A")).toEqual(["B"]);
    expect(alternar(["A"], "B")).toEqual(["A", "B"]);
  });
});

describe("importador do 050", () => {
  it("confere as lidas com o quadro RESUMO do SSW", () => {
    expect(conferenciaDoResumo(resultado(4, 4))).toEqual({
      ok: true,
      texto: "ok — 4 coletas no resumo",
    });
    expect(conferenciaDoResumo(resultado(3, 4)).ok).toBe(false);
    expect(conferenciaDoResumo(resultado(3, null)).texto).toBe("sem quadro de resumo");
  });

  it("lê o arquivo em ISO-8859-1 (acentos do SSW)", async () => {
    const latin1 = new Uint8Array([0x43, 0x4f, 0x4c, 0x45, 0x54, 0xc3]); // "COLETÃ"
    expect(await lerArquivo050({ arrayBuffer: () => Promise.resolve(latin1.buffer) })).toBe(
      "COLETÃ",
    );
  });
});
