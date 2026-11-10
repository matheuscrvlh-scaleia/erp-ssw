import { SEM_TIPO_DOCUMENTO } from "@erp/shared/contratos/performance";
import { describe, expect, it } from "vitest";

import { type CodigoDoCatalogo, codigosDePrejuizo, conjuntosDoCatalogo } from "./catalogo";
import { normalizarFiltro } from "./filtro";
import { arredondar, arredondarRazao, centavos } from "./numeros";
import { montarPontualidade } from "./pontualidade";
import { montarPrevistos } from "./previstos";
import {
  agregadosDeProducao,
  type ContagemDoGrupo,
  metaPonderada,
  totaisDoResumo,
  unidadesDoResumo,
} from "./resumo";

const UUID = "0b9c6f0e-2d1a-4f53-9a3e-6b1f0c2d3e4f";

function grupo(parcial: Partial<ContagemDoGrupo>): ContagemDoGrupo {
  return {
    sigla: "ARA",
    unidadeId: null,
    total: 0,
    entregues: 0,
    finalizados: 0,
    concluidos: 0,
    abertos: 0,
    penalizados: 0,
    penalizadosConcluidos: 0,
    penalizadosAbertos: 0,
    retornos: 0,
    retornosConcluidos: 0,
    ocorrenciasPenalizantes: 0,
    ocorrenciasPendentes: 0,
    emAtraso: 0,
    emAtrasoCliente: 0,
    semPrazo: 0,
    freteRomaneado: null,
    fretePerdido: null,
    ...parcial,
  };
}

describe("arredondamento (ROUND do Postgres)", () => {
  it("razões com 4 casas, meio para longe de zero", () => {
    expect(arredondarRazao(2, 3, 4)).toBe(0.6667);
    expect(arredondarRazao(1, 160, 4)).toBe(0.0063);
    expect(arredondarRazao(24_350 - 1_040, 24_350, 4)).toBe(0.9573);
    expect(arredondar(2.25, 1)).toBe(2.3);
    expect(arredondar(-2.25, 1)).toBe(-2.3);
  });

  it("dinheiro em centavos inteiros", () => {
    expect(centavos("100.10")).toBe(10_010);
    expect(centavos("0.1")).toBe(10);
    expect(centavos(null)).toBe(0);
    expect(centavos("-3.05")).toBe(-305);
  });
});

describe("filtro de texto com vários valores (T13)", () => {
  it("mesma regra da Listagem: vazios ignorados e curingas digitados viram letra", () => {
    const f = normalizarFiltro(
      {
        inicio: "2026-11-01",
        fim: "2026-11-10",
        baseData: "emissao",
        remetente: "são paulo | campinas",
        destino: "a||50%",
      },
      [],
    );
    expect(f.remetente).toEqual(["%são paulo%", "%campinas%"]);
    expect(f.destino).toEqual(["%a%", "%50\\%%"]);
  });
});

describe("normalizarFiltro", () => {
  const base = { inicio: "2026-11-01", fim: "2026-11-10", baseData: "emissao" as const };

  it("sigla em `unidades` vai para filiais; só ficam as próprias", () => {
    const f = normalizarFiltro({ ...base, unidades: [UUID, " ara"], filiais: ["CAP"] }, [
      "ARA",
      "CAP",
    ]);
    expect(f.unidades).toEqual([UUID]);
    expect(f.filiais).toEqual(["CAP", "ARA"]);
  });

  it("filial informada que não é própria: nada casa (Q10), em vez de cair para todas", () => {
    expect(normalizarFiltro({ ...base, filiais: ["XYZ"] }, ["ARA"]).filiais).toEqual([]);
    expect(normalizarFiltro({ ...base, filiais: [] }, ["ARA"]).filiais).toBeNull();
  });

  it("códigos pelos dígitos; sem dígito não casa nada", () => {
    expect(normalizarFiltro({ ...base, codigos: ["01", "85"] }, []).codigos).toEqual([1, 85]);
    expect(normalizarFiltro({ ...base, codigos: ["abc"] }, []).codigos).toEqual([]);
  });

  it("tipos em maiúsculas sem repetir; parceiros só dígitos; textos vazios somem", () => {
    const f = normalizarFiltro(
      {
        ...base,
        tipos: [" normal", "NORMAL", SEM_TIPO_DOCUMENTO],
        parceiros: ["12.345.678/0001-90"],
        remetente: "  ",
        destino: "x|y",
      },
      [],
    );
    expect(f.tipos).toEqual(["NORMAL", SEM_TIPO_DOCUMENTO]);
    expect(f.parceiros).toEqual(["12345678000190"]);
    expect(f.remetente).toBeNull();
    expect(f.destino).toEqual(["%x%", "%y%"]);
  });
});

describe("resumo (T1, T2, T3)", () => {
  it("T1: totais do exemplo da spec", () => {
    // A e B entregues, C baixado (12) com 13, D e E em aberto vencidos (E do cliente), F sem prazo.
    const t = totaisDoResumo([
      grupo({
        total: 6,
        entregues: 2,
        finalizados: 1,
        concluidos: 3,
        abertos: 3,
        penalizados: 2,
        penalizadosConcluidos: 1,
        penalizadosAbertos: 1,
        retornos: 1,
        retornosConcluidos: 1,
        emAtraso: 2,
        emAtrasoCliente: 1,
        semPrazo: 1,
      }),
    ]);
    expect(t.totalCtrcs).toBe(6);
    expect(t.ctrcsConcluidos).toBe(3);
    expect(arredondar(t.performance, 4)).toBe(0.6667);
    expect(t.ctrcsPenalizados).toBe(2);
    expect(t.taxaRetorno).toBeCloseTo(1 / 3);
    expect(t.ctrcsEmAberto).toBe(3);
    expect([t.ctrcsEmAtraso, t.ctrcsEmAtrasoFr, t.ctrcsEmAtrasoCliente]).toEqual([2, 1, 1]);
    expect(t.ctrcsSemPrazo).toBe(1);
  });

  it("T2 com a decisão Q16: retorno só entre os concluídos (não passa de 100%)", () => {
    const t = totaisDoResumo([
      grupo({ total: 2, concluidos: 1, retornos: 2, retornosConcluidos: 1 }),
    ]);
    expect(t.taxaRetorno).toBe(1);
  });

  it("período sem CT-e: performance 1, taxa 0, meta nula, sem unidades", () => {
    expect(totaisDoResumo([]).performance).toBe(1);
    expect(totaisDoResumo([]).taxaRetorno).toBe(0);
    expect(metaPonderada([], [])).toBeNull();
    expect(unidadesDoResumo([])).toEqual([]);
  });

  it("T3: meta ponderada por unidade (geral não casa; meta dupla conta duas vezes)", () => {
    const grupos = [grupo({ unidadeId: "X", total: 100 }), grupo({ unidadeId: "Y", total: 50 })];
    expect(metaPonderada(grupos, [{ unidadeId: "X", valor: 0.03 }])).toBeCloseTo(0.02);
    expect(metaPonderada(grupos, [])).toBe(0);
    expect(metaPonderada(grupos, [{ unidadeId: null, valor: 0.5 }])).toBe(0);
    expect(
      metaPonderada(grupos, [
        { unidadeId: "X", valor: 0.03 },
        { unidadeId: "X", valor: 0.05 },
      ]),
    ).toBeCloseTo(0.032);
  });

  it("por unidade: soma os grupos da sigla e ordena da pior performance", () => {
    const linhas = unidadesDoResumo([
      grupo({ sigla: "CAP", total: 4, concluidos: 2, penalizadosConcluidos: 0 }),
      grupo({ sigla: "ARA", unidadeId: "X", total: 3, concluidos: 2, penalizadosConcluidos: 1 }),
      grupo({ sigla: "ARA", unidadeId: "Y", total: 1, penalizadosAbertos: 1 }),
    ]);
    expect(linhas.map((l) => [l.sigla, l.total, l.performance, l.penalizadosAbertos])).toEqual([
      ["ARA", 4, 0.5, 1],
      ["CAP", 4, 1, 0],
    ]);
  });

  it("T5 com a decisão Q15: frete somado em centavos, uma vez por CT-e que saiu", () => {
    const a = agregadosDeProducao([
      grupo({ total: 1, freteRomaneado: "100.00", fretePerdido: "100.00" }),
      grupo({ sigla: "CAP", total: 1, freteRomaneado: "0.10", fretePerdido: null }),
    ]);
    expect(a.valorFreteTotal).toBe(100.1);
    expect(a.valorFretePerdido).toBe(100);
  });
});

describe("catálogo", () => {
  const cod = (codigo: number, extra: Partial<CodigoDoCatalogo>): CodigoDoCatalogo => ({
    codigo,
    descricao: `C${codigo}`,
    tipoSsw: null,
    penaliza: false,
    responsavel: "sistema",
    pendenteClassificacao: false,
    pendenciaAcompanhada: false,
    ...extra,
  });
  const catalogo = [
    cod(12, { tipoSsw: "BAIXA" }),
    cod(13, { penaliza: true, responsavel: "FR", pendenciaAcompanhada: true }),
    cod(20, { penaliza: true, responsavel: "FR", tipoSsw: "PENDENCIA_TRANSPORTADORA" }),
    cod(85, { penaliza: true, responsavel: "FR", tipoSsw: "PENDENCIA_CLIENTE" }),
    cod(99, { tipoSsw: "BAIXA", pendenteClassificacao: true }),
  ];

  it("conjuntos de códigos do cadastro da empresa", () => {
    expect(conjuntosDoCatalogo(catalogo)).toEqual({
      baixas: [12, 99],
      penalizantes: [13],
      pendentesClassificacao: [99],
      pendencias: [20, 85],
    });
  });

  it("prejuízo: código do filtro (ou 13) que penaliza e é da FR, nunca o 85", () => {
    expect(codigosDePrejuizo(catalogo, null)).toEqual([13]);
    expect(codigosDePrejuizo(catalogo, [20, 85, 12])).toEqual([20]);
  });
});

describe("pontualidade (T4)", () => {
  it("exemplo da seção 1.4", () => {
    const p = montarPontualidade([
      {
        sigla: "ARA",
        total: 10,
        noPrazo: 6,
        foraPrazo: 2,
        semInfoBi2: 1,
        excluidoCliente: 1,
        noPrazoCliente: 0,
        foraPrazoCliente: 1,
        nascidosAvaliados: 8,
        nascidosAtraso: 1,
      },
    ]);
    expect(p.totais).toMatchObject({
      total: 10,
      noPrazo: 6,
      foraPrazo: 2,
      semInfoBi2: 1,
      excluidoCliente: 1,
      performancePct: 0.8,
      slaClientePct: 0,
      nascidosPct: 0.125,
      totalCliente: 1,
      pendente: 0,
      semPrazo: 1,
    });
  });

  it("2 de 3 → 0.6667; sem CT-e → nulo; unidades por total e sigla", () => {
    const vazio = {
      noPrazo: 0,
      semInfoBi2: 0,
      excluidoCliente: 0,
      noPrazoCliente: 0,
      foraPrazoCliente: 0,
      nascidosAvaliados: 0,
      nascidosAtraso: 0,
    };
    const p = montarPontualidade([
      { sigla: "CAP", total: 3, foraPrazo: 1, ...vazio },
      { sigla: "ARA", total: 3, foraPrazo: 0, ...vazio },
      { sigla: "BAU", total: 0, foraPrazo: 0, ...vazio },
    ]);
    expect(p.porUnidade.map((u) => [u.sigla, u.performancePct])).toEqual([
      ["ARA", 1],
      ["CAP", 0.6667],
      ["BAU", null],
    ]);
  });
});

describe("previstos", () => {
  it("T10 com a decisão Q11: faixa pelo dia de Brasília (22:30 de 10/11 já é 11/11 em UTC)", () => {
    const p = montarPrevistos(
      [{ codigo: null, prevista: "2026-11-11", qtd: 1, peso: null, volumes: 0, frete: null }],
      [],
      new Date("2026-11-11T01:30:00Z"),
    );
    expect(p.faixa.map((f) => f.key)).toEqual(["d1"]);
  });

  it("soma por status, por faixa e no total sem erro de float", () => {
    const p = montarPrevistos(
      [
        { codigo: 85, prevista: "2026-11-09", qtd: 2, peso: "1000.500", volumes: 3, frete: "0.10" },
        { codigo: 20, prevista: "2026-11-09", qtd: 1, peso: "0.250", volumes: 1, frete: "0.20" },
        { codigo: null, prevista: null, qtd: 1, peso: null, volumes: 0, frete: null },
      ],
      [
        {
          codigo: 20,
          descricao: "Cliente ausente",
          tipoSsw: "PENDENCIA_CLIENTE",
          penaliza: false,
          responsavel: "cliente",
          pendenteClassificacao: false,
          pendenciaAcompanhada: false,
        },
      ],
      new Date("2026-11-10T15:00:00Z"),
    );
    expect(p.total).toEqual({ qtd: 4, peso: 1000.75, volumes: 4, frete: 0.3 });
    expect(p.status.map((s) => [s.key, s.qtd])).toEqual([
      ["rota", 2],
      ["pendencia", 1],
      ["programacao", 1],
    ]);
    expect(p.faixa.map((f) => [f.key, f.qtd])).toEqual([
      ["vencido", 3],
      ["sem_prev", 1],
    ]);
  });
});
