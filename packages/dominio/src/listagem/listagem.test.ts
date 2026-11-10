import { filtroLista } from "@erp/shared/contratos/listagem";
import { describe, expect, it } from "vitest";

import {
  agruparPorFaixaDeAtraso,
  codigoEmAbertoNoRecorte,
  faixaDeAtraso,
  pedeFaixaDeAtraso,
} from "./faixas";
import { type ContextoDoFiltro, lerConfiguracoesDaListagem, montarFiltroLista } from "./filtro";
import { lerCtrcProcurado, lerNotaProcurada, padroesDeTexto } from "./texto";

/** Casa como o ILIKE do Postgres, com `\` escapando `%` e `_` (só para conferir os padrões). */
function ilike(valor: string, padrao: string): boolean {
  let re = "";
  for (let i = 0; i < padrao.length; i++) {
    const ch = padrao[i] ?? "";
    if (ch === "\\") re += (padrao[++i] ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (ch === "%") re += ".*";
    else if (ch === "_") re += ".";
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "is").test(valor);
}
const casa = (valor: string, filtro: string) =>
  (padroesDeTexto(filtro) ?? []).some((p) => ilike(valor, p));

describe("texto com vários valores (T13)", () => {
  it('"são paulo | campinas" casa as duas cidades, sem acento não casa com acento', () => {
    expect(casa("SÃO PAULO - SP", "são paulo | campinas")).toBe(true);
    expect(casa("Campinas", "são paulo | campinas")).toBe(true);
    expect(casa("SÃO", "sao")).toBe(false);
    expect(casa("qualquer", "a||b")).toBe(true);
  });

  it("espaço nas pontas sai; vazio é sem filtro", () => {
    expect(padroesDeTexto(" ara ")).toEqual(["%ara%"]);
    expect(padroesDeTexto("   ")).toBeNull();
    expect(padroesDeTexto(undefined)).toBeNull();
  });

  it("% e _ digitados são letras, não curinga (Q10)", () => {
    expect(padroesDeTexto("10%")).toEqual(["%10\\%%"]);
    expect(casa("1050", "10%")).toBe(false);
    expect(casa("DESCONTO 10%", "10%")).toBe(true);
    expect(casa("AXB", "a_b")).toBe(false);
  });
});

describe("busca de CT-e e nota (T12)", () => {
  it("série + número sem zeros; dígito verificador sai", () => {
    expect(lerCtrcProcurado("ARA000123-4")).toEqual({ sigla: "ARA", numero: "123" });
    expect(lerCtrcProcurado("000123")).toEqual({ sigla: null, numero: "123" });
    expect(lerCtrcProcurado(" cap033214 ")).toEqual({ sigla: "CAP", numero: "33214" });
    expect(lerCtrcProcurado("ARA-123")).toEqual({ sigla: "ARA", numero: "" });
  });

  it('nota sem zeros; "0" vira vazio (casa nota nula)', () => {
    expect(lerNotaProcurada("00456")).toBe("456");
    expect(lerNotaProcurada("0")).toBe("");
  });
});

describe("faixas de atraso (T11)", () => {
  it("limites das faixas; 0 e vazio ficam fora", () => {
    expect(faixaDeAtraso(1)?.faixa).toBe("Até 3 dias");
    expect(faixaDeAtraso(3)?.faixa).toBe("Até 3 dias");
    expect(faixaDeAtraso(4)?.faixa).toBe("4–5 dias");
    expect(faixaDeAtraso(30)?.faixa).toBe("16–30 dias");
    expect(faixaDeAtraso(31)?.faixa).toBe("+30 dias");
    expect(faixaDeAtraso(0)).toBeNull();
    expect(faixaDeAtraso(null)).toBeNull();
  });

  it("agrupa contagens por dia na ordem fixa e sem faixas vazias", () => {
    expect(
      agruparPorFaixaDeAtraso([
        { atraso: 40, qtd: 1 },
        { atraso: 2, qtd: 5 },
        { atraso: 1, qtd: 2 },
        { atraso: -3, qtd: 9 },
      ]),
    ).toEqual([
      { faixa: "Até 3 dias", ordem: 1, min: 1, max: 3, qtd: 7 },
      { faixa: "+30 dias", ordem: 6, min: 31, max: null, qtd: 1 },
    ]);
  });

  it("gráfico de atraso só para os recortes de atraso", () => {
    expect(pedeFaixaDeAtraso(["atrasados"])).toBe(true);
    expect(pedeFaixaDeAtraso(["nascido_atrasado", "entregues"])).toBe(false);
  });
});

describe("código em aberto no recorte", () => {
  it("regra geral: sem entrega e sem baixa do cadastro", () => {
    expect(codigoEmAbertoNoRecorte("emitidos", { codigo: 85, tipo: "INFORMATIVA" })).toBe(true);
    expect(codigoEmAbertoNoRecorte("emitidos", { codigo: 18, tipo: "ENTREGA" })).toBe(false);
    expect(codigoEmAbertoNoRecorte("emitidos", { codigo: 12, tipo: "BAIXA" })).toBe(false);
  });

  it("saíram com prazo vencido: 18 e 67 contam como aberto, 59 finaliza", () => {
    expect(codigoEmAbertoNoRecorte("nascido_atrasado", { codigo: 18, tipo: "ENTREGA" })).toBe(true);
    expect(codigoEmAbertoNoRecorte("nascido_atrasado", { codigo: 59, tipo: null })).toBe(false);
  });
});

const UNIDADE = "6f1c2a3b-0000-4000-8000-000000000001";

const contexto: ContextoDoFiltro = {
  filiaisProprias: ["CAP", "CAS", "ARA"],
  catalogo: [
    { codigo: 12, tipoSsw: "BAIXA", pendenciaAcompanhada: false },
    { codigo: 13, tipoSsw: "PENDENCIA_TRANSPORTADORA", pendenciaAcompanhada: true },
    { codigo: 20, tipoSsw: "PENDENCIA_CLIENTE", pendenciaAcompanhada: true },
    { codigo: 40, tipoSsw: "PENDENCIA_CLIENTE", pendenciaAcompanhada: true },
    { codigo: 85, tipoSsw: "INFORMATIVA", pendenciaAcompanhada: false },
  ],
  codigosForaDaTela: [40],
  limiteSemMovimento: 3,
  agora: new Date("2026-11-11T01:30:00Z"), // 10/11 22:30 em Brasília
};

const filtro = (entrada: Record<string, unknown>) =>
  montarFiltroLista(filtroLista.parse(entrada), contexto);

describe("filtro único da Listagem", () => {
  it("hoje e vencimento pelo dia de Brasília, não o UTC (Q11, T9/T10)", () => {
    const f = filtro({ inicio: "2026-11-01", fim: "2026-11-10" });
    expect(f?.hoje).toBe("2026-11-10");
    expect(f?.ultimoDiaDeVencimento).toBe("2026-11-12");
  });

  it("unidade por sigla estreita o universo; por id vira filtro de cadastro (Q13)", () => {
    const f = filtro({ unidades: ["cap", UNIDADE] });
    expect(f?.siglas).toEqual(["CAP"]);
    expect(f?.unidadesIds).toEqual([UNIDADE]);
    expect(filtro({})?.siglas).toEqual(["CAP", "CAS", "ARA"]);
  });

  it("unidade e filial se cruzam", () => {
    expect(filtro({ unidades: ["CAP", "CAS"], filiais: ["CAS", "ARA"] })?.siglas).toEqual(["CAS"]);
  });

  it("filial que não é própria dá lista vazia em vez de ignorar o filtro (Q10)", () => {
    expect(filtro({ filiais: ["XYZ"] })).toBeNull();
    expect(
      montarFiltroLista(filtroLista.parse({}), { ...contexto, filiaisProprias: [] }),
    ).toBeNull();
  });

  it("busca, CT-e e nota ignoram o período; ignorar_periodo também", () => {
    const comPeriodo = { inicio: "2026-11-01", fim: "2026-11-10" };
    expect(filtro(comPeriodo)?.periodo).toEqual({
      base: "emissao",
      inicio: "2026-11-01",
      fim: "2026-11-10",
    });
    expect(filtro({ ...comPeriodo, ctrc: "CAP33214" })?.periodo).toBeNull();
    expect(filtro({ ...comPeriodo, nf: "0" })?.nf).toBe("");
    expect(filtro({ ...comPeriodo, busca: " 123 " })?.periodo).toBeNull();
    expect(filtro({ ...comPeriodo, ignorarPeriodo: "1" })?.periodo).toBeNull();
    expect(filtro({ ...comPeriodo, ctrc: "  " })?.periodo).not.toBeNull();
  });

  it("recortes: emitidos é neutro e a ordem é a do seletor (T16)", () => {
    expect(filtro({ tipo: "emitidos", recortes: ["entregues"] })?.recortes).toEqual(["entregues"]);
    expect(filtro({ tipo: "finalizado_sistema", recortes: "entregues" })?.recortes).toEqual([
      "entregues",
      "finalizado_sistema",
    ]);
    expect(filtro({})?.recortes).toEqual([]);
  });

  it("códigos do catálogo: baixas, acompanhados, os da tela e as pendências", () => {
    expect(filtro({})?.codigosDoCatalogo).toEqual({
      baixas: [12],
      acompanhados: [13, 20, 40],
      daTela: [13, 20],
      pendencias: [13, 20, 40],
    });
  });

  it("tipos em maiúsculas sem repetir; sem tipo passa igual", () => {
    expect(filtro({ tipos: ["normal", "NORMAL", "__SEM_TIPO__"] })?.tipos).toEqual([
      "NORMAL",
      "__SEM_TIPO__",
    ]);
  });
});

describe("configurações da Listagem", () => {
  it("lê os valores da empresa e cai no padrão quando falta", () => {
    expect(
      lerConfiguracoesDaListagem(
        new Map([
          ["alerta_dias_sem_movimento", "5"],
          ["ocorrencias_codigos_fora_da_tela", "3, 40,55,x"],
        ]),
      ),
    ).toEqual({ limiteSemMovimento: 5, codigosForaDaTela: [3, 40, 55] });
    expect(lerConfiguracoesDaListagem(new Map())).toEqual({
      limiteSemMovimento: 3,
      codigosForaDaTela: [],
    });
  });
});
