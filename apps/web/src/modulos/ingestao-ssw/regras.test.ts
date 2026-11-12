import { type EventoWebhook } from "@erp/shared/contratos/ingestao-ssw";
import { describe, expect, it } from "vitest";

import { podeReprocessar, situacaoDoEvento } from "./regras";

describe("situacaoDoEvento", () => {
  it("segue a mesma classificação dos contadores do diagnóstico", () => {
    expect(situacaoDoEvento({ statusHttp: 200, autenticado: true })).toBe("processado");
    expect(situacaoDoEvento({ statusHttp: 202, autenticado: true })).toBe("sem_vinculo");
    expect(situacaoDoEvento({ statusHttp: 200, autenticado: false })).toBe("rejeitado");
    expect(situacaoDoEvento({ statusHttp: 401, autenticado: true })).toBe("rejeitado");
    expect(situacaoDoEvento({ statusHttp: 503, autenticado: true })).toBe("erro");
  });
});

describe("podeReprocessar", () => {
  const evento = (e: Partial<EventoWebhook>): EventoWebhook => ({
    id: "00000000-0000-4000-8000-000000000000",
    recebidoEm: "2026-11-12T12:00:00.000Z",
    statusHttp: 200,
    autenticado: true,
    motivoRejeicao: null,
    erroProcessamento: null,
    cteId: null,
    numeroCte: null,
    temPayload: true,
    ...e,
  });

  it("só reprocessa o que guardou o conteúdo", () => {
    expect(podeReprocessar(evento({ statusHttp: 503, temPayload: false }))).toBe(false);
  });

  it("reprocessa erro e sem vínculo, não o processado", () => {
    expect(podeReprocessar(evento({ statusHttp: 503 }))).toBe(true);
    expect(podeReprocessar(evento({ statusHttp: 202 }))).toBe(true);
    expect(podeReprocessar(evento({ statusHttp: 200 }))).toBe(false);
  });

  it("rejeitado só quando o motivo é de autenticação recuperável", () => {
    expect(podeReprocessar(evento({ statusHttp: 401, motivoRejeicao: "token_incorreto" }))).toBe(
      true,
    );
    expect(
      podeReprocessar(evento({ autenticado: false, motivoRejeicao: "cnpj_nao_autorizado" })),
    ).toBe(true);
    expect(podeReprocessar(evento({ statusHttp: 400, motivoRejeicao: "payload_invalido" }))).toBe(
      false,
    );
    expect(podeReprocessar(evento({ statusHttp: 401 }))).toBe(false);
  });
});
