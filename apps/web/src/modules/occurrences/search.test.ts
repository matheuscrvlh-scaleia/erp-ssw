import { describe, expect, it } from "vitest";

import { lerFiltros } from "@/hooks/url-filters";
import { temFiltro } from "@/hooks/url-filters";

import {
  camposMantidosAoLimpar,
  esquemaDaBusca,
  etiquetasDaBusca,
  linkDaListagem,
  migrarBuscaAntiga,
  NAO_SAO_FILTRO,
} from "./search";

const ler = (bruta: Record<string, unknown>) =>
  lerFiltros(esquemaDaBusca, migrarBuscaAntiga(bruta));
const NOMES = {
  parceiro: (cnpj: string) => (cnpj === "11222333000144" ? "ACME" : undefined),
  unidade: () => undefined,
  codigo: (c: number) => (c === 13 ? "Devolução" : undefined),
  responsavel: (r: string) => r,
};

describe("busca de /ocorrencias", () => {
  it("lê os parâmetros de hoje e volta ao padrão no que vier inválido", () => {
    const b = ler({
      codigo: 13,
      responsaveis: ["FR", "marciano"],
      prazo: "talvez",
      size: 70,
      page: "3",
      ctrc: 150354,
    });
    expect(b).toMatchObject({
      codigos: [13],
      responsaveis: ["FR"],
      prazo: null,
      size: 50,
      page: 3,
      ctrc: "150354",
      periodo: "mes",
      campoData: "emissao",
    });
  });

  it("ordenação e paginação não contam como filtro; o período só quando é intervalo", () => {
    const b = ler({ ordem: "codigo", page: 2, periodo: "7d" });
    expect(temFiltro(["ordem", "page", "periodo"], b.periodo, NAO_SAO_FILTRO)).toBe(false);
    expect(camposMantidosAoLimpar(b)).toContain("periodo");
    const custom = ler({ periodo: "custom", de: "2026-11-01", ate: "2026-11-05" });
    expect(temFiltro(["periodo", "de", "ate"], custom.periodo, NAO_SAO_FILTRO)).toBe(true);
    expect(camposMantidosAoLimpar(custom)).not.toContain("periodo");
  });

  it("etiquetas com nomes, recortes dos blocos e unidade só pela quantidade", () => {
    const b = ler({
      parceiros: ["11222333000144"],
      unidades: ["u1", "u2"],
      codigos: [13, 40],
      remetente: "Natura|Avon",
      resp: "penalizantes",
      faixa: "de_4_8",
    });
    expect(etiquetasDaBusca(b, NOMES).map((e) => [e.rotulo, e.valor])).toEqual([
      ["Parceiros", "ACME"],
      ["Unidades", "2 selecionadas"],
      ["Remetente", "Natura · Avon"],
      ["Códigos", "#13 Devolução · #40"],
      ["Faixa de atraso", "4 a 8 dias"],
      ["Card", "Penalizantes"],
    ]);
  });

  it("atalho para a Listagem leva só o que ela entende", () => {
    const b = ler({ filiais: ["RIO"], conferentes: ["JOAO"], nf: "123", campoData: "prevista" });
    const link = linkDaListagem(b, { inicio: "2026-11-01", fim: "2026-11-05" }, "ocorr_em_atraso");
    expect(link).toBe(
      "/performance/lista?tipo=ocorr_em_atraso&periodo=custom&de=2026-11-01&ate=2026-11-05&base=prevista&filiais=RIO&nf=123",
    );
  });
});
