import { randomUUID } from "node:crypto";

import { type ContextoBanco } from "@erp/db";
import { type RegraDePrazo } from "@erp/dominio/nucleo";
import { pino } from "pino";
import { describe, expect, it } from "vitest";

import { criarProcessador } from "../../processador";
import { type ExecutorDoWorker, type RepositoriosDoWorker } from "../registro";
import { type CteDoRecalculo, type NovaPrevisao, novasPrevisoes, recalcularPrazos } from "./job";

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

describe("novasPrevisoes", () => {
  it("aplica a regra e devolve a previsão do SSW quando a regra sai; não mexe no que já está certo", () => {
    const comRegra = cte({ parceiroCnpj: "X" });
    const orfao = cte({ prazoFonte: "regra_unidade", dataPrevistaEntrega: "2026-11-06" });
    const certo = cte({});
    const novas = novasPrevisoes([comRegra, orfao, certo], [regraParceiro], new Map());
    expect(novas).toEqual([
      expect.objectContaining({
        cteId: comRegra.id,
        dataPrevistaEntrega: "2026-11-09",
        prazoFonte: "regra_parceiro",
        previsaoSswData: "2026-11-09",
        troca: null,
      }),
      expect.objectContaining({
        cteId: orfao.id,
        dataPrevistaEntrega: "2026-11-09",
        prazoFonte: "ssw_038",
        dataBasePrazo: null,
        troca: { dataAnterior: "2026-11-06", dataNova: "2026-11-09", fonte: "ssw_038" },
      }),
    ]);
  });
});

describe("job recalcular-prazos-configurados", () => {
  it("roda no contexto da empresa, em lotes, até acabar", async () => {
    const contextos: ContextoBanco[] = [];
    const gravadas: NovaPrevisao[][] = [];
    const lotes = [[cte({ parceiroCnpj: "X" })], []];
    const pedidos: (string | null)[] = [];
    const repositorios: RepositoriosDoWorker = {
      agendamentos: { empresasAtivas: () => Promise.resolve([]) },
      manutencao: {
        apagarSessoesEncerradas: () => Promise.resolve(0),
        apagarTokensDeSenhaVencidos: () => Promise.resolve(0),
      },
      prazos: {
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
      },
    };
    const executar: ExecutorDoWorker = (contexto, fn) => {
      contextos.push(contexto);
      return fn(repositorios);
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
