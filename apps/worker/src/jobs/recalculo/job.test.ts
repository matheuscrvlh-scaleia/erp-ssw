import { montarCatalogo } from "@erp/dominio/nucleo";
import { CATALOGO_FR, ocorrencia } from "@erp/dominio/testes/nucleo";
import { pino } from "pino";
import { describe, expect, it } from "vitest";

import { criarProcessador } from "../../processador";
import { BancoFalso, cteGravado, EMPRESA } from "../../testes/banco-falso";
import { recalcularCtesDoCodigo } from "./job";

const log = pino({ level: "silent" });

function ocorrenciaDoCte(cteId: string, codigo: number, dataHora: string) {
  return {
    ...ocorrencia(codigo, dataHora),
    cteId,
    complemento: null,
    protocoloSsw: "1",
    responsavel: "sistema" as const,
    penaliza: false,
  };
}

describe("recalcular CT-e do código (Q20)", () => {
  it("a descrição nova do catálogo chega à efetiva; CT-e sem o código fica como está", async () => {
    const banco = new BancoFalso();
    const comCodigo = cteGravado({ numero: "1" });
    const semCodigo = cteGravado({ numero: "2", ocorrEfetivaDescricao: "intocada" });
    banco.ctes = [comCodigo, semCodigo];
    banco.ocorrencias = [
      ocorrenciaDoCte(comCodigo.id, 50, "2026-11-02T12:00:00Z"),
      ocorrenciaDoCte(semCodigo.id, 88, "2026-11-02T12:00:00Z"),
    ];
    const novoCatalogo = [...CATALOGO_FR.values()].map((c) =>
      c.codigo === 50 ? { ...c, descricao: "AGUARDANDO CLIENTE" } : c,
    );
    banco.contexto = { ...banco.contexto, catalogo: montarCatalogo(novoCatalogo) };

    const processar = criarProcessador({
      jobs: [recalcularCtesDoCodigo],
      executar: banco.executar,
      log,
      agora: () => new Date("2026-11-10T12:00:00Z"),
    });
    await processar({
      name: "recalcular-ctes-do-codigo",
      data: { empresaId: EMPRESA, codigos: [50] },
    });

    expect(banco.ctes.find((c) => c.id === comCodigo.id)).toMatchObject({
      ocorrEfetivaCodigoNum: 50,
      ocorrEfetivaDescricao: "AGUARDANDO CLIENTE",
    });
    expect(banco.ctes.find((c) => c.id === semCodigo.id)).toBe(semCodigo);
    expect(banco.contextos.every((c) => c.empresaId === EMPRESA)).toBe(true);
  });
});
