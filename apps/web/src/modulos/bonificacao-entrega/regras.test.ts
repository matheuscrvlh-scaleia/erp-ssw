import { type LinhaBonificacao } from "@erp/dominio/bonificacao-entrega";
import { type ParametrosDeBonificacao } from "@erp/shared/contratos/bonificacao-entrega";
import { describe, expect, it } from "vitest";

import { agruparPorDia, filtrarLinhas, TODAS, vigenteHoje } from "./regras";

const linha = (extra: Partial<LinhaBonificacao>): LinhaBonificacao => ({
  dataRomaneio: "2026-10-01",
  unidade: "SPO",
  romaneio: "SPO001",
  placa: null,
  colaborador: "Ana",
  funcao: "Motorista",
  nfsCarregadas: 10,
  sac: 0,
  retornos: 0,
  pendentes: 0,
  nfsEntregues: 10,
  exito: 1,
  rotaPequena: true,
  horaExtra: false,
  semRegistroPonto: false,
  nivel: "turbo",
  bonus: 10,
  zeradoPorFalta: false,
  ...extra,
});

const parametros = (
  vigenciaInicio: string,
  vigenciaFim: string | null,
  taxaTurbo: number,
): ParametrosDeBonificacao => ({
  id: "00000000-0000-4000-8000-000000000001",
  vigenciaInicio,
  vigenciaFim,
  taxaTurbo,
  taxaAcelerado: 0.8,
  taxaEmRotaGrande: 0.4,
  taxaEmRotaPequena: 0.6,
  metaRotaPequena: 0.9,
  metaRotaGrande: 0.95,
  metaEmRota: 0.8,
  limiteNfsRotaPequena: 15,
});

describe("regras da bonificação de entrega", () => {
  const linhas = [
    linha({ colaborador: "Ana", horaExtra: false }),
    linha({ colaborador: "Bia", funcao: "Ajudante", horaExtra: true }),
    linha({ colaborador: "Caio", horaExtra: null, semRegistroPonto: true }),
  ];
  const nomes = (ls: readonly LinhaBonificacao[]) => ls.map((l) => l.colaborador);

  it("filtra por função e hora extra; TODAS não filtra", () => {
    expect(nomes(filtrarLinhas(linhas, TODAS, TODAS))).toEqual(["Ana", "Bia", "Caio"]);
    expect(nomes(filtrarLinhas(linhas, "Ajudante", TODAS))).toEqual(["Bia"]);
    expect(nomes(filtrarLinhas(linhas, TODAS, "sim"))).toEqual(["Bia"]);
    expect(nomes(filtrarLinhas(linhas, TODAS, "nao"))).toEqual(["Ana"]);
    expect(nomes(filtrarLinhas(linhas, TODAS, "sem_ponto"))).toEqual(["Caio"]);
    expect(filtrarLinhas(linhas, "Motorista", "sim")).toEqual([]);
  });

  it("agrupa pelo dia do romaneio, em ordem de dia", () => {
    const dias = agruparPorDia([
      linha({ dataRomaneio: "2026-10-02T08:00:00", colaborador: "Ana" }),
      linha({ dataRomaneio: "2026-10-01", colaborador: "Bia" }),
      linha({ dataRomaneio: "2026-10-02", colaborador: "Caio" }),
    ]);
    expect(dias.map(([dia, ls]) => [dia, nomes(ls)])).toEqual([
      ["2026-10-01", ["Bia"]],
      ["2026-10-02", ["Ana", "Caio"]],
    ]);
  });

  it("parâmetros vigentes hoje; sem vigente, o primeiro; sem nenhum, null", () => {
    const antigos = parametros("2026-01-01", "2026-06-30", 0.9);
    const atuais = parametros("2026-07-01", null, 1);
    expect(vigenteHoje([antigos, atuais], "2026-10-01")?.taxaTurbo).toBe(1);
    expect(vigenteHoje([antigos, atuais], "2026-03-15")?.taxaTurbo).toBe(0.9);
    expect(vigenteHoje([atuais], "2025-12-31")?.taxaTurbo).toBe(1);
    expect(vigenteHoje([], "2026-10-01")).toBeNull();
  });
});
