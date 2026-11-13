import { describe, expect, it } from "vitest";

import { lerFiltros } from "@/hooks/url-filters";

import {
  buscaDaAbertura,
  codigosDaBusca,
  esquemaRomaneio,
  filtrosDaBarra,
  recorteEfetivo,
} from "./search";

const intervalo = { inicio: "2026-11-01", fim: "2026-11-10" };
const busca = (bruto: Record<string, unknown>) => lerFiltros(esquemaRomaneio, bruto);

describe("URL do Romaneio", () => {
  it("padrões de hoje: aba Hoje, mês, por saída, 50 por página", () => {
    const b = busca({});
    expect(b).toMatchObject({ tab: "hoje", periodo: "mes", ver: "saida", size: 50, page: 1 });
    expect(b.ordem).toBeUndefined();
  });

  it("aceita os parâmetros singulares antigos (codigo, placa, motorista)", () => {
    const b = busca({ tab: "andamento", codigo: "13", codigos: ["69"], placa: "ABC1D23" });
    expect(codigosDaBusca(b)).toEqual([13, 69]);
    expect(filtrosDaBarra(b, intervalo).placas).toEqual(["ABC1D23"]);
  });

  it("verTodos vem como 0/1", () => {
    expect(busca({ verTodos: 1 }).verTodos).toBe(true);
    expect(busca({ verTodos: "0" }).verTodos).toBe(false);
  });

  it("tamanho de página fora da lista volta para 50", () => {
    expect(busca({ size: 75 }).size).toBe(50);
  });
});

describe("filtrosDaBarra", () => {
  it("só leva os filtros preenchidos", () => {
    expect(filtrosDaBarra(busca({ ver: "emissao" }), intervalo)).toEqual({
      campo: "emissao",
      ...intervalo,
    });
  });

  it("Motorista vale fora da aba Ajudante; Ajudante só nela", () => {
    const b = busca({ motoristas: ["JOAO"], ajudantes: ["PEDRO"] });
    expect(filtrosDaBarra({ ...b, tab: "motoristas" }, intervalo)).toMatchObject({
      motoristas: ["JOAO"],
    });
    expect(filtrosDaBarra({ ...b, tab: "motoristas" }, intervalo).ajudantes).toBeUndefined();
    const ajudante = filtrosDaBarra({ ...b, tab: "ajudantes" }, intervalo);
    expect(ajudante.ajudantes).toEqual(["PEDRO"]);
    expect(ajudante.motoristas).toBeUndefined();
  });
});

describe("recorte da lista", () => {
  it("sem recorte: por emissão mostra só romaneados, salvo 'Ver todos'", () => {
    expect(recorteEfetivo({ recorte: "todos", ver: "emissao", verTodos: false })).toBe(
      "romaneados",
    );
    expect(recorteEfetivo({ recorte: "todos", ver: "emissao", verTodos: true })).toBe("todos");
    expect(recorteEfetivo({ recorte: "todos", ver: "saida", verTodos: false })).toBe("todos");
  });

  it("o card clicado vence", () => {
    expect(recorteEfetivo({ recorte: "travado", ver: "emissao", verTodos: false })).toBe("travado");
  });

  it("abrir pela distribuição leva código, em rota e só em andamento, sem 'Em rota agora'", () => {
    expect(buscaDaAbertura({ codigos: [13], recorte: "em_rota", status: "andamento" })).toEqual({
      tab: "andamento",
      recorte: "em_rota",
      romaneado: "todos",
      status: "andamento",
      codigos: ["13"],
      codigo: "",
      page: 1,
    });
  });
});
