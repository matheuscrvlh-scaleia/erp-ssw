import { describe, expect, it } from "vitest";

import {
  alertasDaLinha,
  atrasoDaLinha,
  atrasoParaExportar,
  type LinhaSituacao,
  statusDaLinha,
} from "./linha";
import { linhaDoTempo } from "./linha-do-tempo";

const base: LinhaSituacao = {
  dataPrevista: null,
  dataEntregaRealizada: null,
  atrasoDias: null,
  performanceDias: null,
  responsabilidadeCliente: null,
  baixadoSemEntrega: false,
  emRotaAgora: false,
  peso: null,
  volumes: null,
  ultimaOcorrenciaCodigo: null,
  tde: null,
};
const HOJE = "2026-11-10";

describe("linha da lista", () => {
  it("status do mais avançado para o menos", () => {
    expect(statusDaLinha({ ...base, ultimaOcorrenciaCodigo: 18 })).toBe("Entregue");
    expect(statusDaLinha({ ...base, baixadoSemEntrega: true })).toBe("Baixado");
    expect(statusDaLinha({ ...base, emRotaAgora: true })).toBe("Em rota");
    expect(statusDaLinha(base)).toBe("Pendente");
  });

  it("atraso: baixa → resp. cliente → performance → previsão → BI2", () => {
    expect(
      atrasoDaLinha({ ...base, baixadoSemEntrega: true, dataPrevista: "2026-11-01" }, HOJE),
    ).toEqual({ dias: 0, fonte: "baixa formal" });
    expect(atrasoDaLinha({ ...base, responsabilidadeCliente: true }, HOJE).fonte).toBe(
      "resp. cliente",
    );
    expect(atrasoDaLinha({ ...base, dataEntregaRealizada: "x", performanceDias: 2 }, HOJE)).toEqual(
      { dias: 2, fonte: "performance" },
    );
    expect(atrasoDaLinha({ ...base, dataPrevista: "2026-11-07", atrasoDias: 9 }, HOJE)).toEqual({
      dias: 3,
      fonte: "prazo",
    });
    expect(atrasoDaLinha({ ...base, dataPrevista: "2026-11-12" }, HOJE).dias).toBe(0);
    expect(atrasoDaLinha({ ...base, atrasoDias: 4 }, HOJE)).toEqual({ dias: 4, fonte: "BI2" });
  });

  it("alertas e texto do atraso na exportação", () => {
    const l = { ...base, peso: 150, volumes: 11, tde: 5, responsabilidadeCliente: true };
    expect(alertasDaLinha(l, 1, { pesoKg: 100, volumes: 10 })).toEqual([
      "ATRASADO 1 dia",
      "RESP. CLIENTE",
      "CARGA PESADA",
      "ALTO VOLUME",
      "TDE",
    ]);
    expect(
      atrasoParaExportar(
        { ...base, dataEntregaRealizada: "x", performanceDias: 0 },
        { dias: 0, fonte: "performance" },
      ),
    ).toBe("No prazo");
    expect(atrasoParaExportar(base, { dias: 3, fonte: "prazo" })).toBe("3 dias");
  });
});

describe("linha do tempo", () => {
  it("junta ocorrência gravada com a do 930 e mantém a do 930 sem par", () => {
    const quando = new Date("2026-11-10T13:00:00Z");
    const eventos = linhaDoTempo(
      [{ dataHora: quando, codigo: 85, descricao: null, complemento: null }],
      [
        {
          ocorrenciaEm: quando,
          codigo: "085",
          descricao: "SAIDA",
          complemento: "OBS",
          usuario: "ANA",
          unidade: "",
          empresa: "FRT",
        },
        {
          ocorrenciaEm: new Date("2026-11-10T15:00:00Z"),
          codigo: "001",
          descricao: "ENTREGA",
          complemento: null,
          usuario: null,
          unidade: null,
          empresa: "CAP",
        },
        {
          ocorrenciaEm: null,
          codigo: "009",
          descricao: null,
          complemento: null,
          usuario: null,
          unidade: null,
          empresa: null,
        },
      ],
    );
    expect(eventos).toEqual([
      {
        dataHora: new Date("2026-11-10T15:00:00Z"),
        codigo: "001",
        descricao: "ENTREGA",
        complemento: null,
        usuario: null,
        unidade: "CAP",
        fonte: "ssw",
      },
      {
        dataHora: quando,
        codigo: "85",
        descricao: "SAIDA",
        complemento: "OBS",
        usuario: "ANA",
        unidade: null,
        fonte: "sistema",
      },
    ]);
  });
});
