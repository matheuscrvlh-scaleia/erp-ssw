import { describe, expect, it } from "vitest";

import {
  apurarDia,
  apurarFuncionario,
  casarFuncionarios,
  departamentosDistintos,
  horaExtraNoDia,
  jornadaPrevistaMinutos,
  normalizarNome,
  selecionarFuncionarios,
} from "./ponto";

const b = (hora: string, type = "ORIGINAL", dia = "2026-09-01") => ({
  punchTime: `${dia}T${hora}:00.000-03:00`,
  type,
});

describe("apurarDia", () => {
  it("exemplo da spec: 08:02, 12:00, 13:01, 18:10 → 547 min", () => {
    const d = apurarDia("2026-09-01", [b("13:01"), b("08:02"), b("18:10"), b("12:00")]);
    expect(d.minutosTrabalhados).toBe(547);
    expect(d.motivoRevisao).toBeNull();
    expect(d.batidas.map((x) => x.hora)).toEqual(["08:02", "12:00", "13:01", "18:10"]);
  });

  it("batida excluída → revisar; três batidas → ímpar; repetida no mesmo minuto conta uma vez", () => {
    expect(apurarDia("d", [b("08:00"), b("12:00", "DELETADA")]).motivoRevisao).toBe("excluida");
    expect(apurarDia("d", [b("08:00"), b("12:00"), b("13:00")]).motivoRevisao).toBe("impar");
    expect(apurarDia("d", [b("08:00"), b("08:00"), b("12:00")]).minutosTrabalhados).toBe(240);
  });
});

describe("apuração do período", () => {
  it("agrupa pelo dia local da batida (22h não vira o dia seguinte)", () => {
    const f = apurarFuncionario({ register: "1", name: "Ana", terminationDate: "" }, [
      b("08:00", "ORIGINAL", "2026-09-02"),
      b("22:00", "ORIGINAL", "2026-09-01"),
      b("12:00", "ORIGINAL", "2026-09-02"),
    ]);
    expect(f.dias.map((d) => d.data)).toEqual(["2026-09-01", "2026-09-02"]);
    expect(f).toMatchObject({
      diasComRegistro: 2,
      minutosApurados: 240,
      diasARevisar: 1,
      demitido: false,
    });
  });

  it("seleciona com matrícula, sem demitidos (salvo pedido) e do departamento", () => {
    const todos = [
      { register: "1", name: "A", department: "Entrega" },
      { register: "", name: "B", department: "Entrega" },
      { register: "3", name: "C", department: "Entrega", terminationDate: "2026-01-01" },
      { register: "4", name: "D", department: "Adm" },
    ];
    expect(selecionarFuncionarios(todos, { departamento: "Entrega" }).map((f) => f.name)).toEqual([
      "A",
    ]);
    expect(selecionarFuncionarios(todos, { incluirDemitidos: true })).toHaveLength(3);
    expect(departamentosDistintos(todos)).toEqual(["Adm", "Entrega"]);
  });
});

describe("hora extra para a bonificação", () => {
  const turno = {
    key: "T1",
    officeHours: ["08:00", "12:00", "13:00", "17:48"],
    lateExitTolerance: "00:10",
  };

  it("exemplo da spec: jornada 528 min + 10 de tolerância; trabalhou 545 → hora extra", () => {
    expect(jornadaPrevistaMinutos(turno)).toBe(528);
    const dia = { data: "d", batidas: [], minutosTrabalhados: 545, motivoRevisao: null };
    expect(horaExtraNoDia(dia, turno)).toBe(true);
    expect(horaExtraNoDia({ ...dia, minutosTrabalhados: 538 }, turno)).toBe(false);
  });

  it("folga: qualquer trabalho é extra; dia que não fecha = sem registro", () => {
    const dia = { data: "d", batidas: [], minutosTrabalhados: 60, motivoRevisao: null };
    expect(horaExtraNoDia(dia, undefined)).toBe(true);
    expect(horaExtraNoDia(dia, { key: "F", hasNoOfficeHours: true })).toBe(true);
    expect(
      horaExtraNoDia({ ...dia, minutosTrabalhados: null, motivoRevisao: "impar" }, turno),
    ).toBeNull();
  });

  it("casa nome exato, sem acento, e prefixo único (036 corta em 30 caracteres)", () => {
    expect(normalizarNome("  José  da Silva-Jr ")).toBe("JOSE DA SILVAJR");
    const cadastro = [
      { register: "1", name: "MARCOS VINICIUS NASCIMENTO DOS SANTOS" },
      { register: "2", name: "João Pereira" },
      { register: "3", name: "ANA LIMA" },
      { register: "4", name: "ANA LIMA SOUZA" },
    ];
    const casados = casarFuncionarios(
      ["MARCOS VINICIUS NASCIMENTO DOS", "JOAO PEREIRA", "ANA", "AGREGADO X"],
      cadastro,
    );
    expect(casados.get("MARCOS VINICIUS NASCIMENTO DOS")?.register).toBe("1");
    expect(casados.get("JOAO PEREIRA")?.register).toBe("2");
    expect(casados.has("ANA")).toBe(false);
    expect(casados.has("AGREGADO X")).toBe(false);
  });
});
