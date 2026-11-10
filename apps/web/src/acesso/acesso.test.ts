import { describe, expect, it } from "vitest";

import { decidirAcesso, destinoSeguro } from "./guarda";
import { tituloComEmpresa, variaveisDaMarca } from "./marca";
import { montarMenu } from "./navegacao";

const base = { ativo: true, telas: [], telasBloqueadas: [] };

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
  it("separa as seções, tira o prefixo e não repete caminho (ranking/ranking_novo)", () => {
    const menu = montarMenu([
      "ranking_novo",
      "ranking",
      "calendario",
      "admin_usuarios",
      "plataforma_empresas",
      "romaneio_placa",
    ]);
    expect(menu.principal.map((i) => [i.caminho, i.rotulo])).toEqual([
      ["/ranking", "Ranking"],
      ["/calendario", "Calendário"],
    ]);
    expect(menu.admin.map((i) => i.rotulo)).toEqual(["Usuários"]);
    expect(menu.plataforma.map((i) => i.caminho)).toEqual(["/plataforma/empresas"]);
  });
});

describe("marca da empresa", () => {
  it("cor do tema não sobrescreve nada; outra cor pinta barra e topo", () => {
    expect(variaveisDaMarca("#212A63")).toEqual({});
    expect(variaveisDaMarca("vermelho")).toEqual({});
    expect(variaveisDaMarca("#0f6e56")).toMatchObject({
      "--sidebar": "#0f6e56",
      "--marca-primaria": "#0f6e56",
    });
  });

  it("título da aba com o nome da empresa", () => {
    expect(tituloComEmpresa("FR Transportes")).toBe("FR Transportes · Painel Logístico");
    expect(tituloComEmpresa(undefined)).toBe("Painel Logístico");
  });
});
