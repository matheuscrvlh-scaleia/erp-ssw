import { type Alertas, type RelatorioPeriodo } from "@erp/shared/contratos/performance";
import { describe, expect, it } from "vitest";

import { cartoesDeAlerta } from "./alertas";
import { enderecoDaLista, limparFiltros, validarBusca } from "./busca";
import { abaSlaPorUnidade, indicadoresDoRelatorio } from "./relatorio";

describe("busca da URL", () => {
  it("data impossível (2026-02-30) e código numérico do link", () => {
    const b = validarBusca({
      periodo: "custom",
      de: "2026-02-30",
      ate: "2026-03-01",
      codigos: [13],
    });
    expect(b.de).toBe("");
    expect(b.ate).toBe("2026-03-01");
    expect(b.codigos).toEqual(["13"]);
  });

  it("mesmos padrões de hoje e valor solto vira lista", () => {
    expect(
      validarBusca({ periodo: "x", unidades: "ARA", de: "10/11/2026", ordem: "melhor" }),
    ).toEqual({
      periodo: "mes",
      base: "emissao",
      unidades: ["ARA"],
      parceiros: [],
      ordem: "melhor",
      remetente: "",
      destino: "",
      filiais: [],
      codigos: [],
      tipos: [],
      de: "",
      ate: "",
    });
  });

  it("limpar mantém unidades e parceiros e tira o intervalo livre", () => {
    const b = validarBusca({
      periodo: "custom",
      de: "2026-11-01",
      ate: "2026-11-05",
      unidades: ["u1"],
      codigos: ["13"],
    });
    expect(limparFiltros(b)).toMatchObject({
      periodo: "mes",
      de: "",
      ate: "",
      codigos: [],
      unidades: ["u1"],
    });
  });

  it("endereço da lista leva os filtros da tela; códigos como número; vazios fora", () => {
    const b = validarBusca({
      periodo: "7d",
      base: "prevista",
      codigos: ["13", "x"],
      filiais: ["ARA"],
    });
    const href = enderecoDaLista(b, "previstos_por_faixa", {
      faixaPrev: "d1",
      ignorarPeriodo: true,
      base: "emissao",
    });
    expect(href.startsWith("/performance/lista?")).toBe(true);
    const q = new URLSearchParams(href.split("?")[1]);
    expect(q.get("tipo")).toBe("previstos_por_faixa");
    expect(q.get("faixa_prev")).toBe("d1");
    expect(q.get("ignorar_periodo")).toBe('"1"'); // o roteador guarda "1" como texto JSON, como hoje
    expect(q.get("base")).toBe("emissao");
    expect(q.get("codigos")).toBe("[13]");
    expect(q.has("remetente")).toBe(false);
    expect(q.has("parceiros")).toBe(false);
  });
});

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

describe("aba SLA por unidade do Excel", () => {
  const unidade = (sigla: string, slaOperacionalPct: number | null) => ({
    sigla,
    cidade: sigla === "CAP" ? "Campinas" : null,
    uf: sigla === "CAP" ? "SP" : null,
    total: 100,
    entregues: 80,
    producaoPct: 80,
    slaOperacionalPct,
    slaPontualidadePct: 92.25,
  });
  const base = {
    porUnidade: [unidade("CAP", 96), unidade("SOR", 91), unidade("RIB", 89), unidade("BAU", null)],
    comparativo: null,
    limites: { slaMetaPct: 95, taxaRetornoMetaPct: 3 },
  } as unknown as RelatorioPeriodo;

  it("colunas de hoje e status pelo SLA de Pontualidade contra a meta", () => {
    const aba = abaSlaPorUnidade(base);
    expect(aba.nome).toBe("SLA por unidade");
    expect(aba.titulo).toBe("SLA por unidade");
    expect(aba.colunas.map((c) => c.titulo)).toEqual([
      "Unidade",
      "Cidade/UF",
      "Emitidos",
      "Entregues",
      "% Produção",
      "SLA de Pontualidade",
      "SLA Operacional",
      "Status",
    ]);
    expect(aba.linhas[0]).toMatchObject({
      unidade: "CAP",
      cidadeUf: "Campinas/SP",
      emitidos: 100,
      entregues: 80,
      producao: "80,0%",
      slaPont: "96,0%",
      slaOp: "92,3%",
      status: "Verde",
    });
    expect(aba.linhas.map((l) => (l as { status: string }).status)).toEqual([
      "Verde",
      "Amarelo",
      "Vermelho",
      "—",
    ]);
    expect(aba.linhas[3]).toMatchObject({ cidadeUf: "", slaPont: "—" });
  });

  it("comparativo: pares P/C, vazio onde a unidade não teve movimento, Status (P)", () => {
    const aba = abaSlaPorUnidade({
      ...base,
      comparativo: { porUnidade: [{ ...unidade("CAP", 90), total: 70 }] },
    } as unknown as RelatorioPeriodo);
    expect(aba.colunas.map((c) => c.titulo)).toEqual([
      "Unidade",
      "Cidade/UF",
      "Emitidos (P)",
      "Emitidos (C)",
      "Entregues (P)",
      "Entregues (C)",
      "% Produção (P)",
      "% Produção (C)",
      "SLA Pont. (P)",
      "SLA Pont. (C)",
      "SLA Op. (P)",
      "SLA Op. (C)",
      "Status (P)",
    ]);
    expect(aba.linhas[0]).toMatchObject({
      emitidos: 100,
      emitidosC: 70,
      slaPont: "96,0%",
      slaPontC: "90,0%",
      status: "Verde",
    });
    expect(aba.linhas[1]).toMatchObject({ emitidosC: "", slaPontC: "", slaOpC: "" });
  });
});
