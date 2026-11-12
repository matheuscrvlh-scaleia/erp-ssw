import { randomUUID } from "node:crypto";

import { type CodigoCadastrado } from "@erp/dominio/romaneio/situacao";
import { fato, linha036, ocorrencia } from "@erp/dominio/testes/romaneio";
import { contratosRomaneio as c } from "@erp/shared/contratos/romaneio";
import { beforeEach, describe, expect, it } from "vitest";

import { type Executor } from "../../infra/repositorios";
import { RomaneioEmMemoria } from "../../testes/romaneio-em-memoria";
import {
  exportarLista,
  type FatoDaLista,
  normalizarFiltros,
  obterHoje,
  obterLista,
  obterTotais,
} from "./casos-de-uso";

const CODIGOS: CodigoCadastrado[] = [
  {
    codigo: 1,
    descricao: "ENTREGA REALIZADA",
    tipoSsw: "ENTREGA",
    penaliza: false,
    responsavel: "sistema",
  },
  { codigo: 12, descricao: "DEVOLUCAO", tipoSsw: "BAIXA", penaliza: false, responsavel: "sistema" },
  {
    codigo: 85,
    descricao: "SAIDA PARA ENTREGA",
    tipoSsw: "INFORMATIVA",
    penaliza: false,
    responsavel: "sistema",
  },
];

const AGORA = new Date("2026-10-28T15:00:00Z"); // 12:00 em SP
const CTX = { fuso: "America/Sao_Paulo", verPlaca: false };
const FILTROS = { campo: "emissao", inicio: "2026-10-01", fim: "2026-10-31" } as const;

let mem: RomaneioEmMemoria;
let db: Executor<"romaneio">;

beforeEach(() => {
  mem = new RomaneioEmMemoria();
  mem.codigos = CODIGOS;
  db = (fn) => fn({ romaneio: mem.repositorio() });
});

function cte(extra: Partial<FatoDaLista> = {}): FatoDaLista {
  return {
    ...fato(),
    id: randomUUID(),
    numeroNf: null,
    dataEmbarque: null,
    parceiroId: null,
    parceiroNome: null,
    unidadeId: null,
    filial: "SPO",
    remetente: null,
    ufDestino: "SP",
    setor: null,
    statusAtual: null,
    ...extra,
  };
}

const lista = (e: object = {}) => c.lista.entrada.parse({ filtros: FILTROS, ...e });

describe("normalizarFiltros", () => {
  it("filial que não é própria não casa nada (Q10) e sem filiais próprias também não", () => {
    expect(normalizarFiltros({ ...FILTROS, filiais: ["XYZ"] }, ["SPO"])).toBeNull();
    expect(normalizarFiltros(FILTROS, [])).toBeNull();
  });

  it("recorta as siglas às próprias, CNPJ só com dígitos e tipos em maiúsculas", () => {
    const f = normalizarFiltros(
      { ...FILTROS, filiais: ["spo", "XYZ"], parceiros: ["12.345.678/0001-90"], tipos: [" nfe "] },
      ["SPO"],
    );
    expect(f).toMatchObject({ filiais: ["SPO"], pagadores: ["12345678000190"], tipos: ["NFE"] });
  });
});

describe("obterLista", () => {
  it("o recorte da lista é a regra do card (Q13): em rota = saiu e não entregue", async () => {
    const emRota = cte({ ocorrEfetivaCodigo: "85" });
    const entregue = cte({ ocorrEfetivaCodigo: "1", dataEntregaRealizada: AGORA });
    const parado = cte();
    mem.ctes = [emRota, entregue, parado];

    const r = await obterLista(db, CTX, lista({ recorte: "em_rota" }), AGORA);
    const t = await obterTotais(
      db,
      CTX,
      c.totais.entrada.parse({ filtros: FILTROS, universo: "todos" }),
      AGORA,
    );

    expect(r.linhas.map((l) => l.id)).toEqual([emRota.id]);
    expect(r.total).toBe(t.totais.emRota);
  });

  it("ordena pela coluna clicada (Q03) e, sem coluna, pela previsão crescente", async () => {
    const a = cte({ valorFrete: 50, dataPrevista: "2026-10-30" });
    const b = cte({ valorFrete: 300, dataPrevista: null });
    const d = cte({ valorFrete: 120, dataPrevista: "2026-10-29" });
    mem.ctes = [a, b, d];

    const porFrete = await obterLista(
      db,
      CTX,
      lista({ ordem: "valor_frete", direcao: "desc" }),
      AGORA,
    );
    expect(porFrete.linhas.map((l) => l.valorFrete)).toEqual([300, 120, 50]);

    const padrao = await obterLista(db, CTX, lista(), AGORA);
    expect(padrao.linhas.map((l) => l.id)).toEqual([d.id, a.id, b.id]);
  });

  it("pagina sem agrupamento; agrupada vem inteira com os grupos somados", async () => {
    mem.ctes = Array.from({ length: 30 }, (_, i) =>
      cte({ cidadeDestino: i < 20 ? "CAMPINAS" : "SANTOS", valorFrete: 10 }),
    );

    const pagina2 = await obterLista(db, CTX, lista({ tamanho: 25, pagina: 2 }), AGORA);
    expect(pagina2.linhas).toHaveLength(5);
    expect(pagina2.total).toBe(30);

    const agrupada = await obterLista(db, CTX, lista({ agrupar: "cidade", tamanho: 25 }), AGORA);
    expect(agrupada.linhas).toHaveLength(30);
    expect(agrupada.grupos.map((g) => [g.rotulo, g.ctes, g.frete])).toEqual([
      ["CAMPINAS/SP", 20, 200],
      ["SANTOS/SP", 10, 100],
    ]);
  });

  it("CT-e digitado que não é número não consulta o banco", async () => {
    mem.ctes = [cte()];
    const r = await obterLista(db, CTX, lista({ ctrc: "abc" }), AGORA);
    expect(r.total).toBe(0);
    expect(mem.consultas).toHaveLength(0);
  });

  it("limites de carga vêm da configuração da empresa (Q48), senão o padrão", async () => {
    mem.configuracoes.set("romaneio_peso_critico_kg", "250");
    const r = await obterLista(db, CTX, lista(), AGORA);
    expect(r.limites).toEqual({ pesoKg: 250, volumes: 10 });
    expect(r.hoje).toBe("2026-10-28");
  });
});

describe("exportarLista", () => {
  it("'somente' sem nenhuma marcada não exporta nada; 'todas' tira as desmarcadas", async () => {
    const [a, b] = [cte({ dataEmissao: "2026-10-02" }), cte({ dataEmissao: "2026-10-05" })];
    mem.ctes = [a, b];
    const entrada = (selecao: object) => c.exportar.entrada.parse({ filtros: FILTROS, selecao });

    expect(
      (await exportarLista(db, CTX, entrada({ modo: "somente", ids: [] }), AGORA)).linhas,
    ).toEqual([]);
    const todas = await exportarLista(db, CTX, entrada({ modo: "todas", ids: [a.id] }), AGORA);
    expect(todas.linhas.map((l) => l.id)).toEqual([b.id]);
    const somente = await exportarLista(db, CTX, entrada({ modo: "somente", ids: [a.id] }), AGORA);
    expect(somente.linhas.map((l) => l.id)).toEqual([a.id]);
  });
});

describe("obterTotais", () => {
  it("'sem movimento' pede todas as ocorrências do CT-e", async () => {
    mem.ctes = [cte({ ocorrencias: [ocorrencia(85, "2026-10-20T10:00:00Z")] })];
    await obterTotais(
      db,
      CTX,
      c.totais.entrada.parse({ filtros: FILTROS, universo: "todos", semMovimento: true }),
      AGORA,
    );
    expect(mem.consultas[0]?.codigosOcorrencia).toBeNull();
  });
});

describe("obterHoje", () => {
  it("usa o dia de Brasília (Q11) e casa o 036 com o CT-e gravado", async () => {
    mem.linhas036 = [linha036({ romaneio: "R1", ctrc: "SPO 1001", dataEmissao: "2026-10-28" })];
    mem.ctesDoDia = [
      {
        ...fato({ numero: "1001", sigla: "SPO", valorFrete: 80 }),
        foraUniverso: false,
        tipoDocumento: "NFE",
        unidadeDestino: "SPO",
        unidadeAtual: null,
        filial: "SPO",
        numeroNf: null,
        destinatario: null,
        ufDestino: "SP",
      },
    ];
    // 01:00 UTC do dia 29 ainda é dia 28 em SP.
    const r = await obterHoje(db, CTX, {}, new Date("2026-10-29T01:00:00Z"));
    expect(r.dia).toBe("2026-10-28");
    expect(r.resumo).toMatchObject({ romaneios: 1, ctes: 1, frete: 80 });
    expect(r.tipos).toEqual(["NFE"]);
  });
});
