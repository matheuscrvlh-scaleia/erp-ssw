import { type ResultadoDoBlocoDeAplicacao } from "@erp/shared/contracts/ingestion";
import { describe, expect, it } from "vitest";

import { proximaExecucao, somar } from "./rules";

describe("próxima execução do FTP (Q37: todo minuto, exceto :00 e :30)", () => {
  it("pula :00 e :30", () => {
    expect(proximaExecucao(new Date("2026-11-10T12:58:40Z")).toISOString()).toBe(
      "2026-11-10T12:59:00.000Z",
    );
    expect(proximaExecucao(new Date("2026-11-10T12:59:10Z")).toISOString()).toBe(
      "2026-11-10T13:01:00.000Z",
    );
    expect(proximaExecucao(new Date("2026-11-10T13:29:00Z")).toISOString()).toBe(
      "2026-11-10T13:31:00.000Z",
    );
  });
});

const bloco = (r: Partial<ResultadoDoBlocoDeAplicacao>): ResultadoDoBlocoDeAplicacao => ({
  dryRun: true,
  offset: 0,
  processados: 0,
  candidatos: 0,
  pendentes: 0,
  totais: { inserir: 0, atualizar: 0, ocorrencias: 0, ignorados: 0 },
  inserir: [],
  atualizar: [],
  ocorrencias: [],
  ignorados: [],
  temMais: false,
  romaneio036: null,
  ...r,
});

describe("soma dos blocos da aplicação", () => {
  it("soma totais e blocos; pendentes e 036 vêm do último bloco que trouxe", () => {
    const um = somar(
      null,
      bloco({ totais: { inserir: 2, atualizar: 1, ocorrencias: 0, ignorados: 3 }, pendentes: 9 }),
    );
    const dois = somar(
      um,
      bloco({
        totais: { inserir: 1, atualizar: 0, ocorrencias: 4, ignorados: 0 },
        pendentes: 5,
        romaneio036: 7,
      }),
    );
    expect(dois.blocos).toBe(2);
    expect(dois.totais).toEqual({ inserir: 3, atualizar: 1, ocorrencias: 4, ignorados: 3 });
    expect(dois.pendentes).toBe(5);
    expect(dois.romaneio036).toBe(7);
    expect(somar(dois, bloco({})).romaneio036).toBe(7);
  });

  it("guarda no máximo 500 itens por lista", () => {
    const muitos = Array.from({ length: 300 }, (_, i) => ({
      chave: String(i),
      dataEmissao: null,
      previsao: null,
    }));
    const r = somar(somar(null, bloco({ inserir: muitos })), bloco({ inserir: muitos }));
    expect(r.inserir).toHaveLength(500);
  });
});
