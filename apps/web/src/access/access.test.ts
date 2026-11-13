import { describe, expect, it } from "vitest";

import { contraste, paletaDaMarca, tituloComEmpresa } from "./brand";
import { decidirAcesso, destinoSeguro } from "./guard";
import { montarBusca, montarMenu } from "./navigation";

const base = { ativo: true, telas: [], telasBloqueadas: [], adminPlataforma: false };

describe("decidirAcesso (guarda de rota, regras/05 §1.9)", () => {
  it("tela liberada e caminho sem tela passam", () => {
    const acesso = { ...base, telas: ["calendario" as const] };
    expect(decidirAcesso(acesso, "/calendario")).toEqual({ tipo: "liberado" });
    expect(decidirAcesso(acesso, "/ctrc/123")).toEqual({ tipo: "liberado" });
  });

  it("conta inativa vai para /sem-acesso, que sempre abre", () => {
    const inativa = { ...base, ativo: false, telas: ["calendario" as const] };
    expect(decidirAcesso(inativa, "/calendario")).toEqual({
      tipo: "redirecionar",
      para: "/sem-acesso",
    });
    expect(decidirAcesso(inativa, "/sem-acesso")).toEqual({ tipo: "liberado" });
  });

  it("módulo desligado mostra o aviso no lugar da tela", () => {
    const acesso = {
      ...base,
      telas: ["performance" as const],
      telasBloqueadas: [
        { tela: "calendario" as const, modulo: "historico", moduloNome: "Histórico e calendário" },
      ],
    };
    expect(decidirAcesso(acesso, "/calendario")).toEqual({
      tipo: "modulo_desligado",
      moduloNome: "Histórico e calendário",
    });
  });

  it("sem permissão leva à primeira tela do usuário (telas[0]); sem nenhuma, /sem-acesso", () => {
    expect(decidirAcesso({ ...base, telas: ["romaneio", "calendario"] }, "/performance")).toEqual({
      tipo: "redirecionar",
      para: "/romaneio",
    });
    expect(decidirAcesso(base, "/performance")).toEqual({
      tipo: "redirecionar",
      para: "/sem-acesso",
    });
  });

  it("tela com abas abre com pelo menos uma aba, mesmo sem a tela do caminho", () => {
    const soCodigos = { ...base, telas: ["admin_codigos" as const] };
    expect(decidirAcesso(soCodigos, "/admin/configuracoes")).toEqual({ tipo: "liberado" });
    expect(decidirAcesso({ ...base, telas: ["romaneio"] }, "/admin/configuracoes")).toEqual({
      tipo: "redirecionar",
      para: "/romaneio",
    });
  });

  it("Plataforma › Configurações: pela tela de Integrações do cargo na Plataforma", () => {
    const daEquipe = { ...base, adminPlataforma: true, telas: ["plataforma_integracoes" as const] };
    expect(decidirAcesso(daEquipe, "/plataforma/configuracoes")).toEqual({ tipo: "liberado" });
    expect(decidirAcesso({ ...base, telas: ["romaneio"] }, "/plataforma/configuracoes")).toEqual({
      tipo: "redirecionar",
      para: "/romaneio",
    });
  });
});

describe("Usuários e cargos", () => {
  it("abre com a tela Cargos mesmo sem a de Usuários", () => {
    const acesso = { ...base, telas: ["admin_roles" as const] };
    expect(decidirAcesso(acesso, "/admin/usuarios")).toEqual({ tipo: "liberado" });
    expect(decidirAcesso({ ...base, telas: ["calendario"] }, "/admin/usuarios")).toEqual({
      tipo: "redirecionar",
      para: "/calendario",
    });
  });
});

describe("destinoSeguro", () => {
  it("só aceita caminho interno", () => {
    expect(destinoSeguro("/calendario?ano=2026")).toBe("/calendario?ano=2026");
    expect(destinoSeguro("//evil.com")).toBe("/");
    expect(destinoSeguro("/\\evil.com")).toBe("/");
    expect(destinoSeguro("https://evil.com")).toBe("/");
    expect(destinoSeguro(undefined)).toBe("/");
    expect(destinoSeguro("/\t/evil.example")).toBe("/");
    expect(destinoSeguro("/ /evil.example")).toBe("/");
  });
});

describe("montarMenu", () => {
  it("separa as seções e não repete caminho (ranking/ranking_novo)", () => {
    const menu = montarMenu({
      adminPlataforma: false,
      telas: [
        "ranking_novo",
        "ranking",
        "calendario",
        "admin_bonificacao_entrega",
        "admin_usuarios",
        "plataforma_empresas",
        "romaneio_placa",
      ],
    });
    expect(menu.principal.map((i) => [i.caminho, i.rotulo])).toEqual([
      ["/ranking", "Ranking"],
      ["/calendario", "Calendário"],
      ["/admin/bonificacao-entrega", "Bonificação de entrega"],
    ]);
    expect(menu.administracao.map((i) => i.rotulo)).toEqual(["Usuários e cargos"]);
    expect(menu.plataforma.map((i) => i.caminho)).toEqual(["/plataforma/empresas"]);
  });

  it("Configurações aparece com qualquer aba; as telas que viraram abas saem do menu", () => {
    const menu = montarMenu({ adminPlataforma: false, telas: ["admin_equipes", "admin_logs"] });
    expect(menu.administracao.map((i) => [i.caminho, i.rotulo])).toEqual([
      ["/admin/configuracoes", "Configurações"],
      ["/admin/logs", "Logs"],
    ]);
  });

  it("Plataforma: Empresas, Usuários e cargos, Configurações e Logs", () => {
    const menu = montarMenu({
      adminPlataforma: true,
      telas: [
        "plataforma_empresas",
        "plataforma_admins",
        "plataforma_integracoes",
        "plataforma_logs",
        "admin_ahgora",
      ],
    });
    expect(menu.plataforma.map((i) => [i.caminho, i.rotulo])).toEqual([
      ["/plataforma/empresas", "Empresas"],
      ["/plataforma/administradores", "Usuários e cargos"],
      ["/plataforma/configuracoes", "Configurações"],
      ["/plataforma/logs", "Logs"],
    ]);
  });
});

describe("montarBusca", () => {
  it("acha as abas dos hubs pelo caminho novo e as abas da empresa ativa", () => {
    const busca = montarBusca({
      adminPlataforma: true,
      telas: ["admin_codigos", "plataforma_integracoes", "admin_ssw_diagnostico"],
      empresa: { id: "e1", nome: "FR" },
    });
    expect(busca.map((d) => [d.rotulo, d.caminho, d.aba])).toEqual([
      ["Configurações", "/admin/configuracoes", undefined],
      ["Códigos de ocorrências", "/admin/configuracoes", "codigos"],
      ["Configurações", "/plataforma/configuracoes", undefined],
      ["Integrações", "/plataforma/configuracoes", "integracoes"],
      ["Feriados gerais", "/plataforma/configuracoes", "feriados-gerais"],
      ["Importações", "/plataforma/empresas/e1", "importacoes"],
    ]);
  });
});

describe("marca da empresa", () => {
  it("cor inválida cai na padrão; a paleta deriva da cor da empresa", () => {
    expect(paletaDaMarca("vermelho")).toEqual(paletaDaMarca("#212a63"));
    expect(paletaDaMarca("#0f6e56")["--marca"]).toBe("#0f6e56");
  });

  it("toda cor de empresa sai com contraste AA (texto, botão, lateral)", () => {
    for (const cor of ["#212a63", "#0f6e56", "#f5c518", "#ffffff", "#000000", "#c0392b"]) {
      const p = paletaDaMarca(cor);
      const v = (k: string) => p[k] ?? "";
      expect(contraste(v("--marca-texto"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contraste(v("--marca"), v("--marca-fg"))).toBeGreaterThanOrEqual(4.5);
      expect(contraste(v("--marca-clara"), v("--marca-clara-fg"))).toBeGreaterThanOrEqual(4.5);
      expect(contraste(v("--lateral"), "#ffffff")).toBeGreaterThanOrEqual(10);
      expect(contraste(v("--lateral-destaque"), v("--lateral"))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("título da aba com o nome da empresa", () => {
    expect(tituloComEmpresa("FR Transportes")).toBe("FR Transportes · Painel Logístico");
    expect(tituloComEmpresa(undefined)).toBe("Painel Logístico");
  });
});
