import { randomUUID } from "node:crypto";

import { type ContextoBanco } from "@erp/db";
import { type RegraDePrazo } from "@erp/dominio/nucleo";
import { pino } from "pino";
import { describe, expect, it } from "vitest";

import {
  type CteDoRecalculo,
  type NovaPrevisao,
} from "../models/prazos/recalculo-de-prazos.service";
import { BancoFalso } from "../testes/banco-falso-dos-jobs";
import { criarProcessador } from "./processador";
import { recalcularPrazos } from "./recalcular-prazos.job";
import { type ExecutorDosJobs, type RepositoriosDosJobs } from "./registro";

const EMPRESA = randomUUID();

const regraParceiro: RegraDePrazo = {
  id: randomUUID(),
  tipo: "parceiro",
  unidadeCodigo: null,
  unidadeDestinoCodigo: null,
  parceiroCnpj: "X",
  prazoHoras: null,
  prazoDias: 5,
  ativo: true,
  criadoEm: new Date("2026-01-01"),
};

function cte(dados: Partial<CteDoRecalculo>): CteDoRecalculo {
  return {
    id: randomUUID(),
    parceiroCnpj: null,
    filial: "CAP",
    dataEmissao: "2026-11-04",
    dataPrevistaEntrega: "2026-11-09",
    prazoFonte: "ssw_038",
    dataBasePrazo: null,
    previsaoSswData: "2026-11-09",
    previsaoSswFonte: "ssw_038",
    previsaoSswDataBase: null,
    ...dados,
  };
}

describe("job recalcular-prazos-configurados", () => {
  it("roda no contexto da empresa, em lotes, até acabar", async () => {
    const contextos: ContextoBanco[] = [];
    const gravadas: NovaPrevisao[][] = [];
    const lotes = [[cte({ parceiroCnpj: "X" })], []];
    const pedidos: (string | null)[] = [];
    const banco = new BancoFalso();
    const prazos: RepositoriosDosJobs["prazos"] = {
      regras: () => Promise.resolve([regraParceiro]),
      candidatos: (_empresa, filtro, aposId) => {
        expect(filtro.parceiros).toEqual(["X"]);
        pedidos.push(aposId);
        return Promise.resolve(lotes.shift() ?? []);
      },
      chegadas: () => Promise.resolve(new Map()),
      gravar: (_empresa, novas) => {
        gravadas.push(novas);
        return Promise.resolve();
      },
    };
    const executar: ExecutorDosJobs = (contexto, fn) => {
      contextos.push(contexto);
      return banco.executar(contexto, (repositorios: RepositoriosDosJobs) =>
        fn({ ...repositorios, prazos }),
      );
    };
    const processar = criarProcessador({
      jobs: [recalcularPrazos],
      executar,
      log: pino({ level: "silent" }),
      agora: () => new Date(),
    });
    await processar({ name: "recalcular-prazos-configurados", data: { empresaId: EMPRESA } });
    expect(contextos.every((c) => c.empresaId === EMPRESA && !c.plataforma)).toBe(true);
    expect(gravadas.flat()).toHaveLength(1);
    expect(pedidos).toHaveLength(2);
    expect(pedidos[0]).toBeNull();
  });
});
