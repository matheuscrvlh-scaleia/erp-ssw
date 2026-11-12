import {
  type Alertas,
  type RelatorioPeriodo,
  type UnidadePontualidade,
  type UnidadeResumo,
} from "@erp/shared/contratos/performance";
import { describe, expect, it } from "vitest";

import {
  type CartaoDeAlerta,
  cartoesDeAlerta,
  extraDoAlerta,
  indicadoresDoRelatorio,
  linhasDasUnidades,
  nomesConhecidos,
} from "./regras";

const ALERTAS_VAZIOS: Alertas = {
  semMovimento: { count: 0 },
  quedaSla: { count: 0, items: [] },
  vencendo: { count: 0, topParceiros: [] },
  nascidoAtrasado: { count: 0, topUnidades: [] },
  finSistemaAnomalo: { count: 0, items: [] },
  semAtualizacao: { count: 0, topUnidades: [] },
  ocorrencia13: { count: 0, topUnidades: [] },
  ocorrencia13Multipla: { count: 0, topUnidades: [] },
  limites: {
    vermelhoPct: 90,
    diasSemMovimento: 3,
    quedaSlaPp: 10,
    janelaTendenciaDias: 7,
    janelaVencimentoH: 48,
    minVencimento: 20,
    nascidoAtrasadoMin: 1,
    desvioFinsistemaPp: 15,
    diasSemAtualizacao: 5,
  },
};

describe("alertas operacionais", () => {
  it("sem disparo, sem cartão", () => {
    expect(cartoesDeAlerta(ALERTAS_VAZIOS, [], "FR")).toEqual([]);
  });

  it("unidades abaixo da meta pelo SLA Op. por emissão, piores primeiro", () => {
    const [c] = cartoesDeAlerta(
      ALERTAS_VAZIOS,
      [
        { sigla: "CAP", performancePct: 0.85 },
        { sigla: "ARA", performancePct: 0.8 },
        { sigla: "BAU", performancePct: 0.95 },
        { sigla: "SJC", performancePct: null },
      ],
      "FR",
    );
    expect(c).toMatchObject({
      chave: "abaixo",
      titulo: "2 unidades abaixo da meta",
      subtitulo: "Piores: ARA (80,0%) · CAP (85,0%)",
      lista: "penalizados_abertos",
      unidades: ["ARA", "CAP"],
    });
  });

  it("vencendo só a partir do mínimo; queda com uma unidade leva a unidade", () => {
    const cartoes = cartoesDeAlerta(
      {
        ...ALERTAS_VAZIOS,
        vencendo: { count: 19, topParceiros: [] },
        quedaSla: {
          count: 1,
          items: [{ unidade: "ARA", slaAtual: 80, slaAnterior: 95, quedaPp: 15, totalAtual: 30 }],
        },
      },
      [],
      "FR",
    );
    expect(cartoes.map((c) => c.chave)).toEqual(["queda"]);
    expect(cartoes[0]).toMatchObject({ subtitulo: "ARA (-15pp)", unidades: ["ARA"] });
  });
});

describe("relatório de período (Q01)", () => {
  const bloco = {
    totalCtrcs: 200,
    entregues: 150,
    finalizadoSistema: 10,
    previstos: 40,
    devolvidos: 0,
    noPrazo: 140,
    foraPrazo: 10,
    pendentePrazo: 0,
    semPrazo: 50,
    valorFreteTotal: 1000,
    valorFretePerdido: 50,
    pctFretePerdido: 5,
    slaOperacionalPct: 97.5,
    slaPontualidadePct: 95,
    taxaRetornoPct: 2,
    totalCliente: 0,
    noPrazoCliente: 0,
    foraPrazoCliente: 0,
    slaClientePct: null,
  };
  const relatorio = {
    atual: bloco,
    comparativo: { atual: { ...bloco, slaPontualidadePct: 96.5 } },
    limites: { slaMetaPct: 95, taxaRetornoMetaPct: 3 },
  } as unknown as RelatorioPeriodo;

  it("SLA em 0–100 com uma casa e os nomes de hoje; delta em p.p.", () => {
    const porNome = new Map(indicadoresDoRelatorio(relatorio, []).map((i) => [i.rotulo, i]));
    expect(porNome.get("SLA de Pontualidade")?.valor).toBe("97,5%");
    expect(porNome.get("SLA Operacional")).toMatchObject({
      valor: "95,0%",
      tom: "bom",
      comparativo: { valor: "96,5%", delta: { tom: "ruim" } },
    });
    expect(porNome.get("% Produção")?.valor).toBe("75,0%");
    expect(porNome.get("Prejuízo")?.sub).toContain("código 13");
    expect(porNome.get("SLA Cliente")?.sub).toBe("Sem CTRCs de responsabilidade do cliente");
  });
});

describe("nomes dos filtros do relatório", () => {
  it("unidade ou parceiro sem nome conhecido fica de fora", () => {
    expect(
      nomesConhecidos(
        ["u1", "u2", "u3"],
        [
          { id: "u1", nome: "Campinas" },
          { id: "u3", nome: "Santos" },
        ],
      ),
    ).toEqual(["Campinas", "Santos"]);
    expect(nomesConhecidos(["u1"], undefined)).toEqual([]);
  });
});

describe("clique nos alertas", () => {
  const cartao = (lista: CartaoDeAlerta["lista"], unidades?: string[]): CartaoDeAlerta => ({
    chave: "abaixo",
    cor: "",
    titulo: "",
    subtitulo: "",
    explicacao: "",
    lista,
    unidades,
  });

  it("sempre pela emissão; unidades só quando o cartão leva", () => {
    expect(extraDoAlerta(cartao("penalizados_abertos", ["ARA"]))).toEqual({
      unidades: ["ARA"],
      base: "emissao",
    });
    expect(extraDoAlerta(cartao("vencimento_proximo"))).toEqual({
      ignorarPeriodo: true,
      base: "emissao",
    });
    expect(extraDoAlerta(cartao("sem_atualizacao"))).toMatchObject({ ignorarPeriodo: true });
    expect(extraDoAlerta(cartao("nascido_atrasado"))).toEqual({ abertos: true, base: "emissao" });
  });
});

describe("linhas da tabela de unidades", () => {
  const unidade = (sigla: string) => ({ sigla }) as UnidadeResumo;
  const sla = (sigla: string, performancePct: number | null) =>
    ({ sigla, performancePct, nascidosPct: 0.1 }) as UnidadePontualidade;
  const slaPorSigla = new Map([
    ["CAP", sla("CAP", 0.9)],
    ["ARA", sla("ARA", 0.8)],
  ]);

  it("pior SLA Op. primeiro e cada linha com o SLA Op. e os nascidos; sem SLA, nulo", () => {
    const linhas = linhasDasUnidades(
      [unidade("CAP"), unidade("ARA"), unidade("BAU")],
      slaPorSigla,
      "pior",
    );
    expect(linhas.slice(0, 2).map((l) => [l.sigla, l.slaOp, l.nascidosPct])).toEqual([
      ["ARA", 0.8, 0.1],
      ["CAP", 0.9, 0.1],
    ]);
    expect(linhas.find((l) => l.sigla === "BAU")).toMatchObject({ slaOp: null, nascidosPct: null });
  });

  it("melhor primeiro inverte", () => {
    const linhas = linhasDasUnidades([unidade("ARA"), unidade("CAP")], slaPorSigla, "melhor");
    expect(linhas.map((l) => l.sigla)).toEqual(["CAP", "ARA"]);
  });
});
