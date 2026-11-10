import { describe, expect, it } from "vitest";

import {
  agruparPorPessoa,
  apurarBonificacao,
  type BaldeDaViagem,
  type EfeitoBonificacao,
  exitoDaViagem,
  type Falta,
  parametrosVigentes,
} from "./bonificacao-entrega";

/** Valores da FR (seed). */
const FR = {
  taxaTurbo: 1,
  taxaAcelerado: 0.8,
  taxaEmRotaGrande: 0.4,
  taxaEmRotaPequena: 0.6,
  metaRotaPequena: 0.9,
  metaRotaGrande: 0.95,
  metaEmRota: 0.8,
  limiteNfsRotaPequena: 15,
};

const EFEITOS = new Map<number, EfeitoBonificacao>([
  [1, "sac"],
  [5, "sac"],
  [10, "penaliza"],
  [42, "verificar"],
]);

function viagem(
  romaneio: string,
  data: string,
  codigos: [number | null, number][],
  pessoas: Partial<BaldeDaViagem> = {},
): BaldeDaViagem[] {
  return codigos.map(([codigo, ctes]) => ({
    romaneio,
    placa: "ABC1D23",
    data,
    codigo,
    ctes,
    motorista: "JOAO",
    ajudante: null,
    ajudante2: null,
    ajudante3: null,
    ...pessoas,
  }));
}

function apurar(baldes: BaldeDaViagem[], horaExtra: boolean | null, faltas: Falta[] = []) {
  return apurarBonificacao({
    baldes,
    efeitos: EFEITOS,
    parametros: FR,
    horasExtras:
      horaExtra === null
        ? []
        : [...new Set(baldes.map((b) => b.data))].map((data) => ({
            nome: "joao ",
            data,
            horaExtra,
          })),
    faltas,
  });
}

describe("apurarBonificacao — exemplos da spec (parâmetros da FR)", () => {
  it("A: 20 carregadas, 2 SAC, 1 retorno, 1 pendente → em rota, 17 × 0,40", () => {
    const [l] = apurar(
      viagem("CAP001", "2026-11-03", [
        [1, 16],
        [5, 2],
        [10, 1],
        [85, 1],
      ]),
      false,
    );
    expect(l).toMatchObject({
      nfsCarregadas: 20,
      sac: 2,
      retornos: 1,
      pendentes: 1,
      nfsEntregues: 17,
      exito: 0.94,
      rotaPequena: false,
      nivel: "em_rota",
      bonus: 6.8,
      unidade: "CAP",
    });
  });

  it("B: 12 entregues sem hora extra → turbo; B' sem ponto → acelerado", () => {
    const b = viagem("ARA002", "2026-11-03", [[1, 12]]);
    expect(apurar(b, false)[0]).toMatchObject({
      exito: 1,
      rotaPequena: true,
      nivel: "turbo",
      bonus: 12,
    });
    expect(apurar(b, null)[0]).toMatchObject({
      nivel: "acelerado",
      bonus: 9.6,
      horaExtra: null,
      semRegistroPonto: true,
    });
  });

  it("C: 15 carregadas, 4 retornos → êxito 0,73 → sem bônus", () => {
    const [l] = apurar(
      viagem("ARA003", "2026-11-03", [
        [1, 11],
        [10, 4],
      ]),
      true,
    );
    expect(l).toMatchObject({ exito: 0.73, rotaPequena: true, nivel: "sem_bonus", bonus: 0 });
  });

  it("código 42 (verificar) conta como entregue e não aparece em contador; sem ocorrência = pendente", () => {
    const [l] = apurar(
      viagem("ARA004", "2026-11-03", [
        [42, 2],
        [null, 1],
      ]),
      false,
    );
    expect(l).toMatchObject({ sac: 0, retornos: 0, pendentes: 1, nfsEntregues: 3 });
  });
});

describe("apurarBonificacao — pessoas e faltas", () => {
  it("uma linha por pessoa, motorista primeiro; nome vazio não entra", () => {
    const linhas = apurar(
      viagem("CAP001", "2026-11-03", [[1, 10]], {
        ajudante: "PEDRO",
        ajudante2: "  ",
        ajudante3: "ANA",
      }),
      false,
    );
    expect(linhas.map((l) => [l.colaborador, l.funcao])).toEqual([
      ["JOAO", "Motorista"],
      ["ANA", "Ajudante"],
      ["PEDRO", "Ajudante"],
    ]);
  });

  it("falta zera o último dia bonificado anterior a ela", () => {
    const baldes = [
      ...viagem("CAP001", "2026-11-03", [[1, 10]]),
      ...viagem("CAP002", "2026-11-04", [[10, 10]]),
      ...viagem("CAP003", "2026-11-06", [[1, 10]]),
    ];
    const linhas = apurar(baldes, false, [{ colaboradorNome: " joao", dataFalta: "2026-11-05" }]);
    expect(linhas.map((l) => [l.dataRomaneio, l.zeradoPorFalta, l.bonus])).toEqual([
      ["2026-11-03", true, 0],
      ["2026-11-04", false, 0],
      ["2026-11-06", false, 10],
    ]);
  });
});

describe("regras auxiliares", () => {
  it("êxito trunca em 2 casas", () => {
    expect(exitoDaViagem(17, 18)).toBe(0.94);
    expect(exitoDaViagem(57, 100)).toBe(0.57);
    expect(exitoDaViagem(0, 0)).toBe(0);
  });

  it("parâmetros vigentes: o mais recente que cobre o período; nenhum = erro para o operador", () => {
    const linhas = [
      { ...FR, vigenciaInicio: "2026-01-01", vigenciaFim: null },
      { ...FR, taxaTurbo: 2, vigenciaInicio: "2026-11-01", vigenciaFim: null },
    ];
    expect(parametrosVigentes(linhas, "2026-11-01", "2026-11-30").taxaTurbo).toBe(2);
    expect(parametrosVigentes(linhas, "2026-10-01", "2026-10-31").taxaTurbo).toBe(1);
    expect(() => parametrosVigentes([], "2026-10-01", "2026-10-31")).toThrow(
      "Não há parâmetros de bonificação vigentes",
    );
  });

  it("resumo por pessoa: êxito médio simples e total somado", () => {
    const linhas = apurar(
      [
        ...viagem("CAP001", "2026-11-03", [[1, 12]]),
        ...viagem("CAP002", "2026-11-04", [
          [1, 17],
          [5, 2],
          [10, 1],
        ]),
      ],
      false,
    );
    const [p] = agruparPorPessoa(linhas);
    expect(p).toMatchObject({
      colaborador: "JOAO",
      funcao: "Motorista",
      dias: 2,
      entregues: 29,
      retornos: 1,
    });
    expect(p?.exitoMedio).toBeCloseTo((1 + 0.94) / 2, 10);
    expect(p?.total).toBe(12 + 17 * 0.4);
  });
});
