import { recortes as schemaRecortes } from "@erp/shared/contratos/ocorrencias";
import { describe, expect, it } from "vitest";

import {
  padroesDoFiltroDeTexto,
  rotuloDoPagador,
  saneTipos,
  termoCtrc,
  termoNf,
  tipoDocumentoDoFiltro,
} from "./busca";
import { codigosDoCard } from "./card";
import {
  classificar,
  type CodigoDoCatalogo,
  codigosDaTela,
  codigosDeBaixa,
  lerListaDeInteiros,
} from "./catalogo";
import { montarLista, type OcorrenciaDaLista } from "./lista";
import { calcularPainel, type CteDoPainel, type OcorrenciaDoPainel } from "./painel";
import { mesAnterior, periodoDoMesAnterior } from "./periodo";
import { faixaDoAtraso, situacaoDoCte } from "./situacao";

const HOJE = "2026-11-10";

function codigo(c: Partial<CodigoDoCatalogo> & { codigo: number }): CodigoDoCatalogo {
  return {
    descricao: `Código ${c.codigo}`,
    responsavel: "sistema",
    penaliza: false,
    pendenteClassificacao: false,
    pendenciaAcompanhada: true,
    tipoSsw: null,
    ...c,
  };
}

const CATALOGO = new Map(
  [
    codigo({ codigo: 13, descricao: "Devolução", responsavel: "FR", penaliza: true }),
    codigo({ codigo: 15, descricao: "Reagendada", responsavel: "sistema" }),
    codigo({ codigo: 30, descricao: "Destinatário ausente", responsavel: "destinatario" }),
    codigo({ codigo: 12, tipoSsw: "BAIXA", pendenciaAcompanhada: false }),
  ].map((c) => [c.codigo, c]),
);

describe("busca", () => {
  it("número do CT-e com sigla, dígito e zeros; sem dígito útil desliga o filtro", () => {
    expect(termoCtrc("CAS 150354-5")).toBe("150354");
    expect(termoCtrc("ABC0001234")).toBe("1234");
    expect(termoCtrc("000")).toBeNull();
    expect(termoCtrc("ABC")).toBeNull();
    expect(termoNf(" 00123 ")).toBe("123");
    expect(termoNf("0")).toBeNull();
  });

  it("filtro de texto com vários valores e curingas tratados como texto (Q10)", () => {
    expect(padroesDoFiltroDeTexto(" ACME ")).toEqual(["%ACME%"]);
    expect(padroesDoFiltroDeTexto("a | b")).toEqual(["%a%", "%b%"]);
    expect(padroesDoFiltroDeTexto("a||b")).toEqual(["%a%", "%%", "%b%"]);
    expect(padroesDoFiltroDeTexto("10%_x")).toEqual(["%10\\%\\_x%"]);
  });

  it("tipos e rótulos", () => {
    expect(saneTipos([" cte ", "CTE", "", "nfs"])).toEqual(["CTE", "NFS"]);
    expect(tipoDocumentoDoFiltro("  ", "normal")).toBe("NORMAL");
    expect(tipoDocumentoDoFiltro(null, null)).toBe("__SEM_TIPO__");
    expect(rotuloDoPagador("", "123")).toBe("123");
    expect(rotuloDoPagador(null, null)).toBe("—");
  });
});

describe("catálogo", () => {
  it("códigos da tela: pendência acompanhada menos os tirados da tela", () => {
    const catalogo = [
      codigo({ codigo: 8 }),
      codigo({ codigo: 3 }),
      codigo({ codigo: 40 }),
      codigo({ codigo: 1, pendenciaAcompanhada: false }),
    ];
    expect(codigosDaTela(catalogo, lerListaDeInteiros("3, 40,x,"))).toEqual([8]);
    expect(lerListaDeInteiros(null)).toEqual([]);
    expect([...codigosDeBaixa([...CATALOGO.values()])]).toEqual([12]);
  });

  it("código sem cadastro ou não classificado é pendente e não penaliza", () => {
    expect(classificar(77, "X", undefined)).toEqual({
      pendente: true,
      penaliza: false,
      responsavel: "pendente",
      descricao: "X",
    });
    expect(classificar(77, null, undefined).descricao).toBe("Código 77");
    const naoClassificado = codigo({ codigo: 5, penaliza: true, pendenteClassificacao: true });
    expect(classificar(5, null, naoClassificado)).toMatchObject({
      pendente: true,
      penaliza: false,
    });
  });
});

describe("situação e período", () => {
  const baixas = new Set([12]);
  it("entrega gravada vence o código; baixa; atraso conta de hoje − previsão", () => {
    const base = { dataEntregaRealizada: null, codigoEfetivo: null, dataPrevistaEntrega: null };
    expect(
      situacaoDoCte({ ...base, dataEntregaRealizada: new Date(), codigoEfetivo: 12 }, baixas, HOJE)
        .entregue,
    ).toBe(true);
    expect(situacaoDoCte({ ...base, codigoEfetivo: 12 }, baixas, HOJE)).toMatchObject({
      baixado: true,
      emAberto: false,
    });
    expect(
      situacaoDoCte({ ...base, dataPrevistaEntrega: "2026-11-06" }, baixas, HOJE),
    ).toMatchObject({ emAtraso: true, atrasoDias: 4 });
    expect(situacaoDoCte({ ...base, dataPrevistaEntrega: HOJE }, baixas, HOJE).emAtraso).toBe(
      false,
    );
    expect(situacaoDoCte(base, baixas, HOJE).atrasoDias).toBeNull();
  });

  it("faixas de atraso", () => {
    expect([null, 1, 3, 4, 8, 9, 15, 16, 30, 31].map(faixaDoAtraso)).toEqual([
      null,
      "ate_3",
      "ate_3",
      "de_4_8",
      "de_4_8",
      "de_9_15",
      "de_9_15",
      "de_16_30",
      "de_16_30",
      "acima_30",
    ]);
  });

  it("mês anterior: dia inexistente vira o último do mês", () => {
    expect(mesAnterior("2026-11-05")).toBe("2026-10-05");
    expect(mesAnterior("2026-03-31")).toBe("2026-02-28");
    expect(mesAnterior("2024-03-29")).toBe("2024-02-29");
    expect(mesAnterior("2026-01-15")).toBe("2025-12-15");
    expect(periodoDoMesAnterior({ inicio: "2026-03-29", fim: "2026-03-31" })).toEqual({
      inicio: "2026-02-28",
      fim: "2026-02-28",
    });
  });
});

/** Exemplo numérico da spec (§2.8): período 01–05/11/2026 por emissão, hoje 10/11. */
function exemplo() {
  const baixas = new Set([12]);
  const cte = (
    id: string,
    dataBase: string,
    previsao: string,
    extra: { entregue?: boolean; noPrazo?: boolean | null } = {},
  ): CteDoPainel => ({
    id,
    dataBase,
    pagador: "ACME",
    unidadeResp: "RIO",
    noPrazo: extra.noPrazo ?? null,
    situacao: situacaoDoCte(
      {
        dataEntregaRealizada: extra.entregue ? new Date("2026-11-05T15:00:00Z") : null,
        codigoEfetivo: null,
        dataPrevistaEntrega: previsao,
      },
      baixas,
      HOJE,
    ),
  });
  const ctes = [
    cte("A", "2026-11-02", "2026-11-06"),
    cte("B", "2026-11-03", "2026-11-12"),
    cte("C", "2026-11-04", "2026-11-05", { entregue: true, noPrazo: true }),
    cte("D", "2026-10-02", "2026-10-05"),
    cte("E", "2026-11-01", "2026-11-08"),
  ];
  const oc = (cteId: string, c: number): OcorrenciaDoPainel => ({
    cteId,
    codigo: c,
    descricao: null,
  });
  const ocorrencias = [
    oc("A", 13),
    oc("A", 15),
    oc("B", 13),
    oc("B", 13),
    oc("C", 30),
    oc("D", 13),
  ];
  return { ctes, ocorrencias };
}

const SEM_RECORTES = schemaRecortes.parse({});
const atual = { inicio: "2026-11-01", fim: "2026-11-05" };
const anterior = periodoDoMesAnterior(atual);

describe("painel (exemplo da spec)", () => {
  const painel = (recortes = SEM_RECORTES) =>
    calcularPainel({
      ...exemplo(),
      catalogo: CATALOGO,
      atual,
      anterior,
      recortes,
      codigosAcompanhados: 3,
    });

  it("cards, finalização, prazo, faixas, onde atuar e impacto", () => {
    const p = painel();
    expect(p.metricas).toEqual({
      total: 5,
      pendentes: 0,
      ctrcs: 3,
      penalizantes: 1,
      naoPenalizantes: 2,
    });
    expect(p.topCodigos.map((c) => [c.codigo, c.count, c.countAnterior, c.delta])).toEqual([
      [13, 3, 1, 2],
      [15, 1, 0, 1],
      [30, 1, 0, 1],
    ]);
    expect(p.finalizacao).toEqual({
      ctrcs: 3,
      entregues: 1,
      baixados: 0,
      emAberto: 2,
      emAtraso: 1,
    });
    expect(p.prazo).toEqual({ noPrazo: 1, foraPrazo: 0, semPrazo: 2 });
    expect(p.faixasAtraso).toMatchObject({ de_4_8: 1, ate_3: 0 });
    expect(p.ondeAtuar).toEqual([
      { unidade: "RIO", ocorrencias: 5, penalizantes: 1, pendentes: 0, ctrcs: 3 },
    ]);
    expect(p.impacto.ctrcs).toBe(4);
    expect(p.impacto.ctrcsAnterior).toBe(1);
    expect(p.impacto.linhas[0]).toMatchObject({
      codigo: 13,
      ocorrencias: 3,
      ocorrenciasAnterior: 1,
    });
    expect(p.porPagador).toEqual([{ pagador: "ACME", ctrcs: 3 }]);
  });

  it("aba penalizantes: cards iguais, blocos só do CT-e penalizante", () => {
    const p = painel({ ...SEM_RECORTES, responsabilidade: "penalizantes" });
    expect(p.metricas.total).toBe(5);
    expect(p.topCodigos.map((c) => [c.codigo, c.count])).toEqual([
      [13, 1],
      [15, 1],
    ]);
  });

  it("filtro de código 15: A continua penalizante pelo 13", () => {
    const p = painel({ ...SEM_RECORTES, codigos: [15] });
    expect(p.metricas).toMatchObject({ total: 1, ctrcs: 1, penalizantes: 1 });
  });

  it("recorte de faixa tira do universo (e do impacto) quem não está na faixa", () => {
    const p = painel({ ...SEM_RECORTES, faixaAtraso: "de_4_8" });
    expect(p.metricas.ctrcs).toBe(1);
    expect(p.impacto.ctrcs).toBe(1);
  });
});

describe("lista e ver códigos", () => {
  const { ctes, ocorrencias } = exemplo();
  const dados = (id: string) => ({
    ...ctes.find((c) => c.id === id)!,
    numero: { A: "9", B: "10", C: "100", D: "1", E: "2" }[id]!,
    parceiroNome: null,
  });
  const daLista: OcorrenciaDaLista[] = ocorrencias
    .filter((o) => o.cteId !== "D")
    .map((o, i) => ({
      id: `00000000-0000-0000-0000-00000000000${i}`,
      dataHora: new Date(`2026-11-0${i + 1}T10:00:00Z`),
      codigo: o.codigo,
      descricao: null,
      cte: dados(o.cteId),
    }));
  const pedido = {
    recortes: SEM_RECORTES,
    ordem: "data_hora" as const,
    direcao: "desc" as const,
    pagina: 1,
    tamanho: 50,
  };

  it("ordena por data desc, pagina e mantém o total depois da última página", () => {
    const r = montarLista(daLista, CATALOGO, pedido);
    expect(r.total).toBe(5);
    expect(r.linhas[0]!.dataHora.toISOString()).toBe("2026-11-05T10:00:00.000Z");
    expect(montarLista(daLista, CATALOGO, { ...pedido, pagina: 3, tamanho: 2 })).toMatchObject({
      total: 5,
    });
    expect(montarLista(daLista, CATALOGO, { ...pedido, pagina: 9 }).linhas).toEqual([]);
  });

  it("número do CT-e como número e atraso com 'sem atraso' no fim (Q06)", () => {
    const porNumero = montarLista(daLista, CATALOGO, {
      ...pedido,
      ordem: "numero_ctrc",
      direcao: "asc",
    });
    expect(porNumero.linhas.map((l) => l.cte.numero)).toEqual(["9", "9", "10", "10", "100"]);
    for (const direcao of ["asc", "desc"] as const) {
      const porAtraso = montarLista(daLista, CATALOGO, {
        ...pedido,
        ordem: "atraso_dias",
        direcao,
      });
      expect(porAtraso.linhas.at(-1)!.cte.situacao.atrasoDias).toBeNull();
      expect(porAtraso.linhas[0]!.cte.situacao.atrasoDias).toBe(4);
    }
  });

  it("aba externas tira o CT-e penalizante", () => {
    const r = montarLista(daLista, CATALOGO, {
      ...pedido,
      recortes: { ...SEM_RECORTES, responsabilidade: "externas" },
    });
    expect(new Set(r.linhas.map((l) => l.cte.id))).toEqual(new Set(["B", "C"]));
  });

  it("ver códigos do card penalizantes traz todos os códigos do CT-e penalizante", () => {
    const doCard = codigosDoCard(
      ocorrencias
        .filter((o) => o.cteId !== "D")
        .map((o) => ({ ...o, cteEmAtraso: o.cteId === "A" })),
      CATALOGO,
      "penalizantes",
    );
    expect(doCard.map((c) => [c.codigo, c.total, c.ctrcs])).toEqual([
      [13, 1, 1],
      [15, 1, 1],
    ]);
  });
});
