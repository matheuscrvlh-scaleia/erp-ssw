import { unidades } from "@erp/db/schema";
import { describe, expect, it } from "vitest";

import { referenciaEmpresa } from "../tabelas/comum";
import { destinoFalso, logMudo, origemFalsa } from "../testes/falsos";
import { dinheiro } from "../transformacoes/numeros";
import { armazemEmMemoria, type EstadoDaTabela } from "./estado";
import { executarMigracao, selecionarPassos } from "./executar";
import { conferirTabela, migrarTabela } from "./motor";
import { definirTabela, descartar, type Filtros, migrar, semApoio } from "./tipos";

interface LinhaDeTeste {
  id: string;
  empresa_id: string | null;
  nome: string;
  valor: string | null;
}

const EMPRESA = "f0000000-0000-4000-8000-000000000001";
const filtros: Filtros = { empresaId: null, instante: "2026-11-10 12:00:00+00" };

const passoDeTeste = definirTabela({
  nome: "unidades",
  origem: "public.unidades",
  tabela: unidades,
  consulta: {
    colunas: "o.*",
    de: "public.unidades o",
    onde: [],
    chave: [{ expressao: "o.id", tipo: "uuid" }],
  },
  chaveDaLinha: (o: LinhaDeTeste) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, f) => {
    if (o.empresa_id === null) return descartar("empresa_id nulo");
    // Só para exercitar a falha de precisão no motor.
    dinheiro(o.valor, "valor");
    return migrar(
      {
        id: o.id,
        empresaId: o.empresa_id,
        nome: o.nome,
        cidade: "Curitiba",
        uf: "PR",
        ativo: true,
        criadoEm: f.instante,
      },
      o.nome.startsWith("ajuste") ? "nome marcado" : null,
    );
  },
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: "true",
  referencias: [referenciaEmpresa(unidades, "empresaId")],
});
const def = passoDeTeste.definicao;

function linhas(n: number, extra: Partial<LinhaDeTeste> = {}): LinhaDeTeste[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `u${String(i + 1).padStart(2, "0")}`,
    empresa_id: EMPRESA,
    nome: `Unidade ${String(i + 1)}`,
    valor: "1.00",
    ...extra,
  }));
}

function ambiente(origem: LinhaDeTeste[]) {
  return {
    origem: origemFalsa({ "public.unidades o": [...origem] }),
    destino: destinoFalso({ "erp.empresas": [[EMPRESA]] }),
  };
}

const opcoes = { tamanhoDoLote: 2, simulacao: false };

describe("migrarTabela", () => {
  it("migra em lotes, uma gravação por lote, e salva o checkpoint a cada lote", async () => {
    const infra = ambiente(linhas(5));
    const salvos: EstadoDaTabela[] = [];
    const estado = await migrarTabela(
      def,
      infra,
      filtros,
      opcoes,
      undefined,
      (e) => {
        salvos.push(structuredClone(e));
        return Promise.resolve();
      },
      logMudo,
    );

    expect(estado).toMatchObject({ status: "concluida", lidas: 5, migradas: 5 });
    expect(infra.destino.gravacoes).toHaveLength(3);
    expect(salvos.map((s) => s.ultimaChave)).toEqual([["u02"], ["u04"], ["u05"], ["u05"]]);
    expect(infra.destino.tabelas.get('"erp"."unidades"')?.size).toBe(5);
  });

  it("descarta pela regra e pela referência, e conta os ajustes da transformação", async () => {
    const origem = [
      ...linhas(2),
      { id: "u10", empresa_id: null, nome: "x", valor: null },
      { id: "u11", empresa_id: "outra", nome: "y", valor: null },
      { id: "u12", empresa_id: EMPRESA, nome: "ajuste z", valor: null },
    ];
    const estado = await migrarTabela(
      def,
      ambiente(origem),
      filtros,
      { ...opcoes, tamanhoDoLote: 10 },
      undefined,
      () => Promise.resolve(),
      logMudo,
    );
    expect(estado.migradas).toBe(3);
    expect(estado.descartes).toEqual({
      "empresa_id nulo": { quantidade: 1, exemplos: ["u10"] },
      "empresa não migrou": { quantidade: 1, exemplos: ["u11"] },
    });
    expect(estado.ajustes).toEqual({ "nome marcado": { quantidade: 1, exemplos: ["u12"] } });
  });

  it("retoma do checkpoint: lê só depois da última chave gravada", async () => {
    const infra = ambiente(linhas(5));
    const anterior: EstadoDaTabela = {
      status: "em_andamento",
      ultimaChave: ["u04"],
      lidas: 4,
      migradas: 4,
      descartes: {},
      ajustes: {},
      erros: [],
    };
    const estado = await migrarTabela(
      def,
      infra,
      filtros,
      opcoes,
      anterior,
      () => Promise.resolve(),
      logMudo,
    );
    expect(estado).toMatchObject({ status: "concluida", lidas: 5, migradas: 5 });
    expect(infra.destino.gravacoes).toHaveLength(1);
    expect(infra.destino.gravacoes[0]?.linhas.map((l) => l.id)).toEqual(["u05"]);
  });

  it("tabela já concluída não é relida", async () => {
    const infra = ambiente(linhas(3));
    const concluida: EstadoDaTabela = {
      status: "concluida",
      ultimaChave: ["u03"],
      lidas: 3,
      migradas: 3,
      descartes: {},
      ajustes: {},
      erros: [],
    };
    await migrarTabela(def, infra, filtros, opcoes, concluida, () => Promise.resolve(), logMudo);
    expect(infra.origem.leituras).toBe(0);
  });

  it("valor fora da precisão para a tabela sem gravar o lote (o anterior fica)", async () => {
    const origem = linhas(4);
    const terceira = origem[2];
    if (terceira) terceira.valor = "1.005";
    const infra = ambiente(origem);
    const estado = await migrarTabela(
      def,
      infra,
      filtros,
      opcoes,
      undefined,
      () => Promise.resolve(),
      logMudo,
    );
    expect(estado.status).toBe("falhou");
    expect(estado.ultimaChave).toEqual(["u02"]);
    expect(estado.migradas).toBe(2);
    expect(estado.erros).toEqual([
      {
        chave: "u03",
        coluna: "valor",
        valor: "1.005",
        motivo: "valor: tem mais de 2 casas decimais",
      },
    ]);
    expect(infra.destino.gravacoes).toHaveLength(1);
  });

  it("simulação não grava nem salva, e junta todos os erros", async () => {
    const origem = linhas(4).map((l, i) => ({ ...l, valor: i % 2 === 0 ? "9.999" : "1" }));
    const infra = ambiente(origem);
    let salvou = false;
    const estado = await migrarTabela(
      def,
      infra,
      filtros,
      { ...opcoes, simulacao: true },
      undefined,
      () => {
        salvou = true;
        return Promise.resolve();
      },
      logMudo,
    );
    expect(estado.status).toBe("falhou");
    expect(estado.erros.map((e) => e.chave)).toEqual(["u01", "u03"]);
    expect(estado.lidas).toBe(4);
    expect(infra.destino.gravacoes).toHaveLength(0);
    expect(salvou).toBe(false);
  });
});

describe("conferirTabela", () => {
  it("confere quando o destino tem exatamente o que a regra manda", async () => {
    const infra = ambiente([...linhas(3), { id: "u09", empresa_id: null, nome: "x", valor: null }]);
    await migrarTabela(def, infra, filtros, opcoes, undefined, () => Promise.resolve(), logMudo);
    const conferencia = await conferirTabela(def, infra, filtros, 2);
    expect(conferencia).toMatchObject({ origem: 3, destino: 3, confere: true });
  });

  it("acusa linha alterada ou faltando no destino", async () => {
    const infra = ambiente(linhas(3));
    await migrarTabela(def, infra, filtros, opcoes, undefined, () => Promise.resolve(), logMudo);
    const tabela = infra.destino.tabelas.get('"erp"."unidades"');
    const linha = tabela?.get(JSON.stringify(["u02"]));
    if (linha) linha.nome = "outro nome";
    expect((await conferirTabela(def, infra, filtros, 2)).confere).toBe(false);
    tabela?.delete(JSON.stringify(["u02"]));
    expect(await conferirTabela(def, infra, filtros, 2)).toMatchObject({
      origem: 3,
      destino: 2,
      confere: false,
    });
  });
});

describe("executarMigracao", () => {
  const instante = () => Promise.resolve(filtros.instante);
  const base = {
    simulacao: false,
    recomecar: false,
    tamanhoDoLote: 2,
    tabelas: null,
    empresaId: null,
  };
  const final = { nome: "final", executar: () => Promise.resolve(["nota final"]) };

  it("migra, roda o pós-migração e os passos finais, e confere", async () => {
    const infra = ambiente(linhas(3));
    let depois = 0;
    const comPos = definirTabela({
      ...def,
      aposMigrar: () => {
        depois += 1;
        return Promise.resolve(["ajuste adiado"]);
      },
    });
    const armazem = armazemEmMemoria();
    const relatorio = await executarMigracao(
      [comPos],
      [final],
      infra,
      armazem,
      base,
      logMudo,
      instante,
    );
    expect(relatorio.sucesso).toBe(true);
    expect(depois).toBe(1);
    expect(relatorio.tabelas[0]).toMatchObject({
      notas: ["ajuste adiado"],
      conferencia: { confere: true },
    });
    expect(relatorio.passosFinais).toEqual([{ nome: "final", notas: ["nota final"] }]);
    expect(armazem.atual()?.tabelas.unidades?.status).toBe("concluida");
    expect(armazem.atual()?.instante).toBe(filtros.instante);
  });

  it("para na tabela que falha e não confere nada", async () => {
    const origem = linhas(2);
    const primeira = origem[0];
    if (primeira) primeira.valor = "0.001";
    const infra = ambiente(origem);
    const relatorio = await executarMigracao(
      [passoDeTeste, definirTabela({ ...def, nome: "unidades:segunda" })],
      [final],
      infra,
      armazemEmMemoria(),
      base,
      logMudo,
      instante,
    );
    expect(relatorio.sucesso).toBe(false);
    expect(relatorio.tabelas).toHaveLength(1);
    expect(relatorio.passosFinais).toEqual([]);
  });

  it("recusa checkpoint de outra empresa sem --recomecar", async () => {
    const armazem = armazemEmMemoria({
      versao: 1,
      instante: filtros.instante,
      empresaId: EMPRESA,
      tabelas: {},
    });
    await expect(
      executarMigracao([passoDeTeste], [], ambiente([]), armazem, base, logMudo, instante),
    ).rejects.toThrow(/--recomecar/);
  });

  it("--tabelas aceita o passo ou a tabela de destino e recusa nome desconhecido", () => {
    const segunda = definirTabela({ ...def, nome: "unidades:segunda" });
    expect(selecionarPassos([passoDeTeste, segunda], ["unidades"])).toHaveLength(2);
    expect(selecionarPassos([passoDeTeste, segunda], ["unidades:segunda"])).toEqual([segunda]);
    expect(() => selecionarPassos([passoDeTeste], ["ctrcs"])).toThrow(/desconhecida/);
  });
});
