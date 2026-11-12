import { MODULOS } from "@erp/shared/acesso/modulos";
import { describe, expect, it } from "vitest";

import {
  aplicarModulos,
  aplicarTelasDaPlataforma,
  calcularAcesso,
  calcularTelas,
  type EntradaDoAcesso,
  escolherEmpresaAtiva,
  moduloLiberado,
  modulosVigentes,
  moduloVigente,
  papelNaEmpresa,
} from "./acesso";

const EMPRESA = "f0000000-0000-4000-8000-000000000001";

describe("calcularTelas (computeScreens)", () => {
  const base = {
    telasDoCargo: [],
    telasDoDepartamento: [],
    setor: null,
    excecoes: [],
    papel: null,
  };

  it("une cargo e departamento na ordem do catálogo e ignora chave desconhecida", () => {
    expect(
      calcularTelas({
        ...base,
        telasDoCargo: ["calendario", "tela_que_nao_existe"],
        telasDoDepartamento: ["performance"],
      }),
    ).toEqual(["performance", "calendario"]);
  });

  it("usa o setor legado só quando cargo e departamento não dão nada", () => {
    expect(calcularTelas({ ...base, setor: "rh" })).toEqual([
      "performance",
      "historico",
      "calendario",
    ]);
    expect(calcularTelas({ ...base, setor: "rh", telasDoCargo: ["coletas"] })).toEqual(["coletas"]);
  });

  it("exceção adiciona e tira tela operacional", () => {
    expect(
      calcularTelas({
        ...base,
        telasDoCargo: ["performance", "romaneio"],
        excecoes: [
          { tela: "romaneio", permitido: false },
          { tela: "coletas", permitido: true },
        ],
      }),
    ).toEqual(["performance", "coletas"]);
  });

  it("exceção de tela admin só vale para admin, e para gestor só nas liberáveis", () => {
    const excecoes = [
      { tela: "admin_usuarios", permitido: true },
      { tela: "admin_bonificacao_entrega", permitido: true },
    ];
    expect(calcularTelas({ ...base, papel: "operador", excecoes })).toEqual([]);
    expect(calcularTelas({ ...base, papel: "gestor", excecoes })).toEqual([
      "admin_bonificacao_entrega",
    ]);
    expect(calcularTelas({ ...base, papel: "admin", excecoes })).toEqual([
      "admin_usuarios",
      "admin_bonificacao_entrega",
    ]);
  });
});

describe("aplicarTelasDaPlataforma", () => {
  it("tira telas da Plataforma que vieram de cargo e dá Logs ao admin da empresa", () => {
    expect(
      aplicarTelasDaPlataforma(["performance", "admin_ingestao", "plataforma_logs", "admin_logs"], {
        adminPlataforma: false,
        papel: "admin",
      }),
    ).toEqual(["performance", "admin_logs"]);
    expect(
      aplicarTelasDaPlataforma(["admin_logs"], { adminPlataforma: false, papel: "operador" }),
    ).toEqual([]);
  });

  it("admin da plataforma recebe todas as telas da Plataforma", () => {
    const telas = aplicarTelasDaPlataforma([], { adminPlataforma: true, papel: null });
    expect(telas).toContain("plataforma_empresas");
    expect(telas).toContain("admin_ingestao");
    expect(telas).toContain("admin_logs");
  });
});

describe("módulos", () => {
  it("bloqueia tela de módulo desligado e mantém tela sem módulo e do essencial", () => {
    const r = aplicarModulos(
      ["performance", "calendario", "admin_usuarios", "plataforma_logs"],
      MODULOS,
      ["performance"],
      false,
    );
    expect(r.telas).toEqual(["performance", "admin_usuarios", "plataforma_logs"]);
    expect(r.bloqueadas).toEqual([
      { tela: "calendario", modulo: "historico", moduloNome: "Histórico e calendário" },
    ]);
  });

  it("admin da plataforma não perde tela por módulo", () => {
    expect(aplicarModulos(["calendario"], MODULOS, [], true).telas).toEqual(["calendario"]);
  });

  it("vigência: essencial sempre; demais ativos dentro do período (limites inclusivos)", () => {
    const liberacoes = [
      { modulo: "romaneio", ativo: true, inicio: "2026-11-10", fim: null },
      { modulo: "coletas", ativo: true, inicio: null, fim: "2026-11-09" },
      { modulo: "ranking", ativo: false, inicio: null, fim: null },
      { modulo: "historico", ativo: true, inicio: null, fim: "2026-11-10" },
    ];
    expect(modulosVigentes(MODULOS, liberacoes, "2026-11-10")).toEqual([
      "essencial",
      "historico",
      "romaneio",
    ]);
  });

  it("moduloVigente (tela de módulos da Plataforma): mesma regra da lista", () => {
    const m = { essencial: false, ativo: true, inicio: null, fim: null };
    expect(moduloVigente({ ...m, fim: "2026-11-10" }, "2026-11-10")).toBe(true);
    expect(moduloVigente({ ...m, fim: "2026-11-09" }, "2026-11-10")).toBe(false);
    expect(moduloVigente({ ...m, inicio: "2026-11-11" }, "2026-11-10")).toBe(false);
    expect(moduloVigente({ ...m, ativo: false, essencial: true }, "2026-11-10")).toBe(true);
  });

  it("moduloLiberado: admin da plataforma sempre; senão algum dos pedidos", () => {
    expect(moduloLiberado({ adminPlataforma: true, modulos: [] }, ["x"])).toBe(true);
    expect(moduloLiberado({ adminPlataforma: false, modulos: ["a"] }, ["b", "a"])).toBe(true);
    expect(moduloLiberado({ adminPlataforma: false, modulos: ["a"] }, ["b"])).toBe(false);
  });
});

describe("calcularAcesso", () => {
  const vinculo = { papel: "operador", departamento: "exp", setor: null, ativo: true };
  const entrada: EntradaDoAcesso = {
    usuarioAtivo: true,
    empresaId: EMPRESA,
    adminPlataforma: false,
    vinculo,
    telasDoCargo: ["performance", "calendario"],
    telasDoDepartamento: [],
    excecoes: [],
    catalogo: MODULOS,
    modulosVigentes: ["essencial", "performance"],
  };

  it("caminho feliz: telas do cargo filtradas pelos módulos", () => {
    expect(calcularAcesso(entrada)).toEqual({
      ativo: true,
      papel: "operador",
      setor: null,
      telas: ["performance"],
      telasBloqueadas: [
        { tela: "calendario", modulo: "historico", moduloNome: "Histórico e calendário" },
      ],
    });
  });

  it("usuário inativo, vínculo inativo ou sem empresa: sem telas", () => {
    expect(calcularAcesso({ ...entrada, usuarioAtivo: false }).ativo).toBe(false);
    expect(calcularAcesso({ ...entrada, vinculo: { ...vinculo, ativo: false } }).telas).toEqual([]);
    expect(calcularAcesso({ ...entrada, empresaId: null }).ativo).toBe(false);
  });

  it("admin da plataforma sem vínculo vale como admin da empresa ativa", () => {
    const r = calcularAcesso({ ...entrada, adminPlataforma: true, vinculo: null });
    expect(r.papel).toBe("admin");
    expect(r.telas).toContain("calendario");
    expect(r.telas).toContain("plataforma_empresas");
  });

  it("papelNaEmpresa sem empresa e sem vínculo é nulo", () => {
    expect(papelNaEmpresa({ vinculo: null, adminPlataforma: true, empresaId: null })).toBeNull();
  });
});

describe("escolherEmpresaAtiva (empresa_atual)", () => {
  const vinculos = [
    { empresaId: "b", ativo: true, empresaAtiva: true, criadoEm: new Date("2026-02-01") },
    { empresaId: "a", ativo: true, empresaAtiva: true, criadoEm: new Date("2026-03-01") },
    { empresaId: "c", ativo: false, empresaAtiva: true, criadoEm: new Date("2026-01-01") },
    { empresaId: "d", ativo: true, empresaAtiva: false, criadoEm: new Date("2026-01-01") },
  ];

  it("mantém a preferida se o vínculo ainda vale", () => {
    expect(escolherEmpresaAtiva({ preferida: "a", adminPlataforma: false, vinculos })).toBe("a");
  });

  it("preferida sem vínculo válido cai no vínculo mais antigo", () => {
    expect(escolherEmpresaAtiva({ preferida: "c", adminPlataforma: false, vinculos })).toBe("b");
    expect(
      escolherEmpresaAtiva({ preferida: null, adminPlataforma: false, vinculos: [] }),
    ).toBeNull();
  });

  it("admin da plataforma fica com qualquer preferida", () => {
    expect(escolherEmpresaAtiva({ preferida: "z", adminPlataforma: true, vinculos: [] })).toBe("z");
  });
});
