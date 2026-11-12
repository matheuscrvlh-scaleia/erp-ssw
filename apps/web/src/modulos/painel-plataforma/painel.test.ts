import { type EmpresaNoPainel } from "@erp/shared/contratos/painel-plataforma";
import { describe, expect, it } from "vitest";

import { haQuantoTempo, resumoDosNiveis, seloDaSsw } from "./PaginaPainel";

const REF = "2026-11-12T15:00:00.000Z";

const empresa = (mudanca: Partial<EmpresaNoPainel>): EmpresaNoPainel => ({
  id: "00000000-0000-4000-8000-000000000001",
  nome: "FR Transportes",
  nomeCurto: "FR",
  status: "ativa",
  corPrimaria: "#212a63",
  usuariosAtivos: 1,
  modulosLiberados: 1,
  ultimoLoginEm: null,
  saude: { nivel: "ok", motivos: [] },
  ssw: {
    configurado: true,
    tokenValido: false,
    tokenAtualizadoEm: null,
    saudavel: false,
    motivo: "sem_token",
  },
  workerSsw: { situacao: "ok", jobsComFalha: [] },
  ultimoDadoEm: null,
  xml: { pendentes: 0, expirados: 0 },
  numeros: null,
  ...mudanca,
});

describe("haQuantoTempo", () => {
  it("minutos, horas e dias desde a montagem do painel", () => {
    expect(haQuantoTempo(null, REF)).toBe("Nunca");
    expect(haQuantoTempo("2026-11-12T14:59:30.000Z", REF)).toBe("agora");
    expect(haQuantoTempo("2026-11-12T14:35:00.000Z", REF)).toBe("há 25 min");
    expect(haQuantoTempo("2026-11-12T12:00:00.000Z", REF)).toBe("há 3 h");
    expect(haQuantoTempo("2026-11-09T15:00:00.000Z", REF)).toBe("há 3 dias");
  });
});

describe("seloDaSsw", () => {
  it("token conhecido só com o worker-ssw no ar", () => {
    expect(seloDaSsw(empresa({}))).toEqual({ tom: "erro", texto: "Sem token" });
    expect(seloDaSsw(empresa({ workerSsw: { situacao: "fora", jobsComFalha: [] } }))).toEqual({
      tom: "neutro",
      texto: "Token desconhecido",
    });
  });

  it("desligada e saudável", () => {
    const desligada = {
      configurado: false,
      tokenValido: false,
      tokenAtualizadoEm: null,
      saudavel: true,
      motivo: "ok" as const,
    };
    expect(seloDaSsw(empresa({ ssw: desligada })).texto).toBe("Desligada");
    expect(seloDaSsw(empresa({ ssw: { ...desligada, configurado: true } })).texto).toBe(
      "Token válido",
    );
  });
});

describe("resumoDosNiveis", () => {
  it("só os níveis com empresa, no singular ou plural", () => {
    expect(resumoDosNiveis({ ok: 2, atencao: 1, critico: 1, inativa: 0 })).toBe(
      "2 saudáveis · 1 em atenção · 1 crítica",
    );
  });
});
