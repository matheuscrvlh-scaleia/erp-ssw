import { MODULOS } from "@erp/shared/acesso/modulos";
import { PERMISSOES_GRAVAVEIS } from "@erp/shared/acesso/permissoes";
import { describe, expect, it } from "vitest";

import {
  aplicarModulos,
  aplicarPermissoesDaPlataforma,
  calcularAcesso,
  calcularPermissoes,
  concessaoPodeValer,
  type EntradaDoAcesso,
  escolherEmpresaAtiva,
  moduloLiberado,
  modulosVigentes,
  moduloVigente,
  papelNaEmpresa,
  permissoesDoCargo,
} from "./acesso";

const EMPRESA = "f0000000-0000-4000-8000-000000000001";

describe("permissoesDoCargo", () => {
  it("Admin e Super Admin têm o catálogo da empresa inteiro, sem olhar o que está gravado", () => {
    expect(permissoesDoCargo("admin", [])).toEqual(PERMISSOES_GRAVAVEIS);
    expect(permissoesDoCargo("super_admin", ["performance.ver"])).toEqual(PERMISSOES_GRAVAVEIS);
  });

  it("os demais: só as gravadas que existem no catálogo e não são da Plataforma, em ordem", () => {
    expect(
      permissoesDoCargo("gestor", [
        "calendario.excluir",
        "performance.ver",
        "performance.editar",
        "plataforma_empresas.ver",
        "admin_logs.ver",
        "lixo",
        "calendario.ver",
      ]),
    ).toEqual(["performance.ver", "calendario.ver", "calendario.excluir"]);
  });
});

describe("calcularPermissoes: (cargo ∪ concessões) − negações", () => {
  const base = { papel: "operador", doCargo: ["performance.ver", "historico.ver"], excecoes: [] };

  it("sem exceção, herda o cargo", () => {
    expect(calcularPermissoes(base)).toEqual(["performance.ver", "historico.ver"]);
  });

  it("Sim concede o que o cargo não dá; Não tira o que o cargo dá", () => {
    expect(
      calcularPermissoes({
        ...base,
        excecoes: [
          { permissao: "historico.editar", efeito: "concede" },
          { permissao: "coletas.ver", efeito: "concede" },
          { permissao: "performance.ver", efeito: "nega" },
        ],
      }),
    ).toEqual(["coletas.ver", "historico.ver", "historico.editar"]);
  });

  it("um Não vale até para o Admin; um Sim no Admin não muda nada", () => {
    const r = calcularPermissoes({
      papel: "admin",
      doCargo: [],
      excecoes: [
        { permissao: "coletas.ver", efeito: "nega" },
        { permissao: "performance.ver", efeito: "concede" },
      ],
    });
    expect(r).not.toContain("coletas.ver");
    expect(r).toHaveLength(PERMISSOES_GRAVAVEIS.length - 2);
  });

  it("sem Ver a tela perde as outras ações (negar Ver tira Editar e Excluir)", () => {
    expect(
      calcularPermissoes({
        papel: "operador",
        doCargo: ["calendario.ver", "calendario.editar", "calendario.excluir"],
        excecoes: [{ permissao: "calendario.ver", efeito: "nega" }],
      }),
    ).toEqual([]);
    expect(
      calcularPermissoes({
        ...base,
        excecoes: [{ permissao: "calendario.editar", efeito: "concede" }],
      }),
    ).toEqual(["performance.ver", "historico.ver"]);
  });

  it("Sim de tela administrativa só vale para admin, e para gestor só nas liberáveis", () => {
    const excecoes = [
      { permissao: "admin_usuarios.ver", efeito: "concede" as const },
      { permissao: "admin_bonificacao_entrega.ver", efeito: "concede" as const },
    ];
    expect(calcularPermissoes({ papel: "operador", doCargo: [], excecoes })).toEqual([]);
    expect(calcularPermissoes({ papel: "gestor", doCargo: [], excecoes })).toEqual([
      "admin_bonificacao_entrega.ver",
    ]);
    expect(concessaoPodeValer("admin_usuarios", "admin")).toBe(true);
    expect(concessaoPodeValer("performance", null)).toBe(true);
  });

  it("tela administrativa vinda do cargo vale para qualquer papel (o cargo é a regra)", () => {
    expect(
      calcularPermissoes({ papel: "gestor", doCargo: ["admin_equipes.ver"], excecoes: [] }),
    ).toEqual(["admin_equipes.ver"]);
  });

  it("exceção da Plataforma ou fora do catálogo é ignorada", () => {
    expect(
      calcularPermissoes({
        ...base,
        excecoes: [
          { permissao: "plataforma_empresas.ver", efeito: "concede" },
          { permissao: "nao_existe.ver", efeito: "concede" },
        ],
      }),
    ).toEqual(["performance.ver", "historico.ver"]);
  });
});

describe("aplicarPermissoesDaPlataforma", () => {
  it("tira permissões da Plataforma vindas de fora e dá Logs ao admin da empresa", () => {
    expect(
      aplicarPermissoesDaPlataforma(
        ["performance.ver", "admin_ingestao.ver", "plataforma_logs.ver", "admin_logs.ver"],
        { adminPlataforma: false, papel: "admin" },
      ),
    ).toEqual(["performance.ver", "admin_logs.ver"]);
    expect(
      aplicarPermissoesDaPlataforma(["admin_logs.ver"], {
        adminPlataforma: false,
        papel: "operador",
      }),
    ).toEqual([]);
  });

  it("admin da plataforma recebe as telas da Plataforma com todas as ações", () => {
    const p = aplicarPermissoesDaPlataforma([], { adminPlataforma: true, papel: null });
    expect(p).toContain("plataforma_empresas.excluir");
    expect(p).toContain("admin_ingestao.editar");
    expect(p).toContain("admin_logs.ver");
  });
});

describe("módulos", () => {
  it("bloqueia a tela (todas as ações) de módulo desligado; mantém Plataforma e essencial", () => {
    const r = aplicarModulos(
      [
        "performance.ver",
        "calendario.ver",
        "calendario.editar",
        "admin_usuarios.ver",
        "plataforma_logs.ver",
      ],
      MODULOS,
      ["performance"],
      false,
    );
    expect(r.permissoes).toEqual(["performance.ver", "admin_usuarios.ver", "plataforma_logs.ver"]);
    expect(r.bloqueadas).toEqual([
      { tela: "calendario", modulo: "historico", moduloNome: "Histórico e calendário" },
    ]);
  });

  it("admin da plataforma não perde tela por módulo", () => {
    expect(aplicarModulos(["calendario.ver"], MODULOS, [], true).permissoes).toEqual([
      "calendario.ver",
    ]);
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
  const vinculo = { papel: "operador", ativo: true };
  const entrada: EntradaDoAcesso = {
    usuarioAtivo: true,
    empresaId: EMPRESA,
    adminPlataforma: false,
    vinculo,
    permissoesDoCargo: ["performance.ver", "calendario.ver", "calendario.editar"],
    excecoes: [],
    catalogo: MODULOS,
    modulosVigentes: ["essencial", "performance"],
  };

  it("caminho feliz: permissões do cargo filtradas pelos módulos; telas = as com Ver", () => {
    expect(calcularAcesso(entrada)).toEqual({
      ativo: true,
      papel: "operador",
      permissoes: ["performance.ver"],
      telas: ["performance"],
      telasBloqueadas: [
        { tela: "calendario", modulo: "historico", moduloNome: "Histórico e calendário" },
      ],
    });
  });

  it("exceção entra antes dos módulos", () => {
    const r = calcularAcesso({
      ...entrada,
      excecoes: [{ permissao: "performance.ver", efeito: "nega" }],
      modulosVigentes: ["essencial", "performance", "historico"],
    });
    expect(r.permissoes).toEqual(["calendario.ver", "calendario.editar"]);
    expect(r.telas).toEqual(["calendario"]);
  });

  it("usuário inativo, vínculo inativo ou sem empresa: sem permissões", () => {
    expect(calcularAcesso({ ...entrada, usuarioAtivo: false }).ativo).toBe(false);
    const inativo = calcularAcesso({ ...entrada, vinculo: { ...vinculo, ativo: false } });
    expect(inativo.permissoes).toEqual([]);
    expect(inativo.telas).toEqual([]);
    expect(calcularAcesso({ ...entrada, empresaId: null }).ativo).toBe(false);
  });

  it("admin da plataforma sem vínculo vale como admin da empresa ativa (tudo)", () => {
    const r = calcularAcesso({ ...entrada, adminPlataforma: true, vinculo: null });
    expect(r.papel).toBe("admin");
    expect(r.permissoes).toContain("calendario.excluir");
    expect(r.permissoes).toContain("admin_roles.excluir");
    expect(r.telas).toContain("plataforma_empresas");
    expect(r.telas).toContain("admin_logs");
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
