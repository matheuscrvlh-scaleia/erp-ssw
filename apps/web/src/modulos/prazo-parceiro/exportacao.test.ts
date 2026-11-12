import { type LinhaPrazo, type NascidoAtrasado } from "@erp/shared/contratos/prazo-parceiro";
import { describe, expect, it } from "vitest";

import { urlCtrcNoSsw } from "@/lib/exportacao";

import { linhaDaLista, linhaDoNascido, slug } from "./exportacao";

const linha: LinhaPrazo = {
  id: "00000000-0000-4000-8000-000000000001",
  sigla: "CPS",
  numero: "123",
  parceiroNome: "Transportes ABC",
  dataEmissao: "2026-11-02",
  dataEmbarque: "2026-11-02",
  dataPrevista: "2026-11-03",
  prazoPadraoData: "2026-11-04",
  diasAbaixoDoPadrao: 1,
  nasceuAtrasado: true,
  prazoOrigem: "parceiro",
  statusAtual: null,
  setor: null,
  unidadeNome: null,
};

const nascido: NascidoAtrasado = {
  id: "00000000-0000-4000-8000-000000000002",
  sigla: "CPS",
  numero: "456",
  dataEmbarque: "2026-11-02",
  dataEmissao: "2026-11-02",
  dataPrevista: "2026-11-03",
  prazoPadraoData: "2026-11-04",
  diasAbaixoDoPadrao: 1,
  statusAtual: null,
  setor: null,
  unidadeNome: null,
  cidadeDestino: "Campinas",
  ufDestino: "SP",
};

describe("exportação do Prazo do parceiro", () => {
  it("lista: origem e nascido por extenso, com o link do SSW", () => {
    expect(linhaDaLista(linha)).toMatchObject({
      origem: "Parceiro",
      nascido: "Sim",
      linkSsw: urlCtrcNoSsw("CPS", "123", "2026-11-02"),
    });
    expect(linhaDaLista({ ...linha, prazoOrigem: "proprio", nasceuAtrasado: false })).toMatchObject(
      { origem: "Próprio", nascido: "Não" },
    );
  });

  it("nascidos: destino montado e link do SSW", () => {
    expect(linhaDoNascido(nascido)).toMatchObject({
      destino: "Campinas/SP",
      linkSsw: urlCtrcNoSsw("CPS", "456", "2026-11-02"),
    });
  });

  it("nome do arquivo sem acento nem espaço", () => {
    expect(slug("Transportes São João Ltda.")).toBe("transportes-sao-joao-ltda");
  });
});
