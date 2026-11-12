import { describe, expect, it } from "vitest";

import { CATALOGO_FR, cte, ocorrencia } from "../testes/nucleo";
import { CONFIGURACAO_PADRAO } from "./configuracao";
import {
  type CadastrosDoNucleo,
  type CamposDoCte,
  criarCte,
  type CteGravado,
  regravarCte,
  type RepositorioCteNucleo,
} from "./gravar-cte";
import { type TrocaDePrevisao } from "./prazo";

const AGORA = new Date("2026-11-10T12:00:00Z");

const cad: CadastrosDoNucleo = {
  catalogo: CATALOGO_FR,
  filiais: [{ sigla: "CAP", cidade: "CAMPINAS", uf: "SP", propria: true }],
  regrasDePrazo: [],
  config: CONFIGURACAO_PADRAO,
  cnpjsProprios: [],
  dominioSsw: "FRT",
};

function gravado(extra: Partial<CteGravado> = {}): CteGravado {
  return {
    ...cte({ filial: "CAP" }),
    id: "c1",
    empresaId: "e1",
    sigla: "CAP",
    numero: "1",
    atualizadoEm: new Date("2026-11-03T10:00:00Z"),
    ...extra,
  };
}

function repositorio(existentes: CteGravado[] = []) {
  const ctes = [...existentes];
  const atualizacoes: { id: string; campos: CamposDoCte<CteGravado> }[] = [];
  const trocas: (TrocaDePrevisao & { cteId: string })[] = [];
  const repo: RepositorioCteNucleo<CteGravado> = {
    cadastrosDoNucleo: () => Promise.resolve(cad),
    ocorrenciasDosCtes: () => Promise.resolve(new Map()),
    inserirCtes: (novos) => {
      const entraram = novos.filter(
        (n) => !ctes.some((c) => c.sigla === n.sigla && c.numero === n.numero),
      );
      ctes.push(...entraram);
      return Promise.resolve(entraram);
    },
    atualizarCte: (id, campos) => {
      atualizacoes.push({ id, campos });
      return Promise.resolve();
    },
    registrarTrocaDePrevisao: (cteId, troca) => {
      trocas.push({ ...troca, cteId });
      return Promise.resolve();
    },
  };
  return { repo, ctes, atualizacoes, trocas };
}

describe("criarCte", () => {
  it("grava o CT-e com os derivados do núcleo", async () => {
    const { repo, ctes } = repositorio();
    const r = await criarCte(repo, cad, gravado(), "outra");
    expect(r.tipo).toBe("gravado");
    expect(ctes).toHaveLength(1);
    expect(ctes[0]?.filialEfetiva).toBe("CAP");
  });

  it("emissão antes da data mínima e CT-e novo pelo BI2 são descartados", async () => {
    const { repo, ctes } = repositorio();
    const comTrava = { ...cad, config: { ...cad.config, dataMinimaEmissao: "2026-11-05" } };
    expect(await criarCte(repo, comTrava, gravado(), "outra")).toEqual({
      tipo: "descartado",
      motivo: "abaixo_da_data_minima",
    });
    expect(await criarCte(repo, cad, gravado(), "bi2")).toEqual({
      tipo: "descartado",
      motivo: "bi2_nao_cria_cte",
    });
    expect(ctes).toEqual([]);
  });

  it("CT-e que já existe com a mesma sigla e número é erro", async () => {
    const { repo } = repositorio([gravado()]);
    await expect(criarCte(repo, cad, gravado({ id: "c2" }), "outra")).rejects.toThrow(
      "CT-e CAP 1 já existe.",
    );
  });
});

describe("regravarCte", () => {
  it("linha igual à gravada não é regravada", async () => {
    const criado = await criarCte(repositorio().repo, cad, gravado(), "outra");
    if (criado.tipo !== "gravado") throw new Error("esperava o CT-e gravado");
    const { repo, atualizacoes } = repositorio([criado.cte]);
    const r = await regravarCte(repo, cad, criado.cte, {}, [], AGORA);
    expect(r).toEqual({ tipo: "igual", cte: criado.cte });
    expect(atualizacoes).toEqual([]);
  });

  it("grava só o que mudou, com atualizado_em, e recalcula a efetiva pelo catálogo", async () => {
    const criado = await criarCte(repositorio().repo, cad, gravado(), "outra");
    if (criado.tipo !== "gravado") throw new Error("esperava o CT-e gravado");
    const { repo, atualizacoes } = repositorio([criado.cte]);
    const r = await regravarCte(
      repo,
      cad,
      criado.cte,
      { pagadorCnpj: "11.222.333/0001-81" },
      [ocorrencia(85, "2026-11-04T12:00:00Z")],
      AGORA,
    );
    expect(r.tipo).toBe("gravado");
    expect(atualizacoes).toHaveLength(1);
    expect(atualizacoes[0]?.campos).toMatchObject({
      pagadorCnpj: "11.222.333/0001-81",
      pagadorCnpjDigitos: "11222333000181",
      ocorrEfetivaCodigoNum: 85,
      atualizadoEm: AGORA,
    });
    expect(Object.keys(atualizacoes[0]?.campos ?? {})).not.toContain("id");
  });

  it("status escrito pelo chamador fica até chegar ocorrência (ocorrenciasMudaram)", async () => {
    const criado = await criarCte(repositorio().repo, cad, gravado(), "outra");
    if (criado.tipo !== "gravado") throw new Error("esperava o CT-e gravado");
    const oc = [ocorrencia(99, "2026-11-04T12:00:00Z", { descricao: "CTRC BAIXADO/CANCELADO" })];
    const { repo, atualizacoes } = repositorio([criado.cte]);
    await regravarCte(repo, cad, criado.cte, { statusAtual: "CANCELADO" }, oc, AGORA);
    expect(atualizacoes[0]?.campos.statusAtual).toBe("CANCELADO");
    const cancelado = { ...criado.cte, statusAtual: "CANCELADO" };
    await regravarCte(repo, cad, cancelado, {}, oc, AGORA, { ocorrenciasMudaram: true });
    expect(atualizacoes[1]?.campos.statusAtual).toBe("CTRC BAIXADO/CANCELADO");
  });
});
