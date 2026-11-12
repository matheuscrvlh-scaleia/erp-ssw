import { describe, expect, it } from "vitest";

import {
  type AlvoDoLogin,
  caminhoDoLogo,
  cargoTemTudo,
  escolherEmpresaModelo,
  exigirPodeAjustarExcecoes,
  exigirPodeAlterarLogin,
  exigirPodeMexerEmSuperAdmin,
  exigirPodeMudarAtivo,
  exigirPodeRemoverAdminPlataforma,
  permissoesGravaveis,
  podeAlterarLogin,
  validarExcecoes,
  validarLogo,
  validarParametrosDeIntegracao,
  validarVigencia,
} from "./administracao";

const base64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));

describe("login de outra pessoa", () => {
  const alvo: AlvoDoLogin = {
    plataforma: false,
    papelDeQuemPede: "admin",
    empresaAtiva: "a",
    empresasDoAlvo: ["a"],
    papeisDoAlvo: ["operador"],
    alvoEhPlataforma: false,
  };

  it("admin só mexe em quem está só na empresa dele; Plataforma sempre", () => {
    expect(podeAlterarLogin(alvo)).toBe(true);
    expect(podeAlterarLogin({ ...alvo, empresasDoAlvo: ["a", "b"] })).toBe(false);
    expect(podeAlterarLogin({ ...alvo, plataforma: true, empresasDoAlvo: ["a", "b"] })).toBe(true);
    expect(() => {
      exigirPodeAlterarLogin({ ...alvo, empresasDoAlvo: ["a", "b"] }, "senha");
    }).toThrow("a senha só pode ser redefinida pela equipe da Plataforma");
  });

  it("senha de Super Admin só outro Super Admin (a Plataforma sozinha não)", () => {
    const superAdmin = { ...alvo, papeisDoAlvo: ["super_admin"] };
    expect(() => {
      exigirPodeAlterarLogin(superAdmin, "senha");
    }).toThrow("Apenas o Super Admin pode redefinir a senha de outro Super Admin");
    expect(() => {
      exigirPodeAlterarLogin(
        { ...superAdmin, plataforma: true, papelDeQuemPede: "admin" },
        "senha",
      );
    }).toThrow();
    expect(() => {
      exigirPodeAlterarLogin({ ...superAdmin, papelDeQuemPede: "super_admin" }, "senha");
    }).not.toThrow();
    expect(() => {
      exigirPodeAlterarLogin(superAdmin, "e-mail");
    }).toThrow("Apenas o Super Admin pode alterar o e-mail de outro Super Admin.");
    expect(() => {
      exigirPodeAlterarLogin(superAdmin, "nome e e-mail");
    }).not.toThrow();
  });

  it("admin de empresa não mexe no login de quem é da Plataforma", () => {
    expect(() => {
      exigirPodeAlterarLogin({ ...alvo, alvoEhPlataforma: true }, "e-mail");
    }).toThrow("Este usuário é da equipe da Plataforma");
    expect(() => {
      exigirPodeAlterarLogin({ ...alvo, alvoEhPlataforma: true, plataforma: true }, "senha");
    }).not.toThrow();
  });

  it("admin não se promove a Super Admin nem tira o papel de quem é", () => {
    const pede = { papelDeQuemPede: "admin", plataforma: false };
    expect(() => {
      exigirPodeMexerEmSuperAdmin({ ...pede, papelAntes: "admin", papelDepois: "super_admin" });
    }).toThrow("Apenas o Super Admin pode dar ou tirar o papel Super Admin.");
    expect(() => {
      exigirPodeMexerEmSuperAdmin({ ...pede, papelAntes: "super_admin", papelDepois: "admin" });
    }).toThrow();
    expect(() => {
      exigirPodeMexerEmSuperAdmin({
        ...pede,
        papelAntes: "super_admin",
        papelDepois: "super_admin",
      });
    }).not.toThrow();
    expect(() => {
      exigirPodeMexerEmSuperAdmin({
        papelDeQuemPede: "admin",
        plataforma: true,
        papelAntes: "admin",
        papelDepois: "super_admin",
      });
    }).not.toThrow();
  });
});

describe("desativar ou reativar", () => {
  const alvo: AlvoDoLogin = {
    plataforma: false,
    papelDeQuemPede: "admin",
    empresaAtiva: "a",
    empresasDoAlvo: ["a"],
    papeisDoAlvo: ["operador"],
    alvoEhPlataforma: false,
  };
  it("admin comum só mexe em quem não é Super Admin nem da Plataforma", () => {
    expect(() => {
      exigirPodeMudarAtivo(alvo);
    }).not.toThrow();
    expect(() => {
      exigirPodeMudarAtivo({ ...alvo, papeisDoAlvo: ["super_admin"] });
    }).toThrow("Apenas o Super Admin pode desativar ou reativar um Super Admin.");
    expect(() => {
      exigirPodeMudarAtivo({ ...alvo, alvoEhPlataforma: true });
    }).toThrow("só a Plataforma o desativa");
  });
  it("Super Admin e Plataforma podem", () => {
    expect(() => {
      exigirPodeMudarAtivo({
        ...alvo,
        papelDeQuemPede: "super_admin",
        papeisDoAlvo: ["super_admin"],
      });
    }).not.toThrow();
    expect(() => {
      exigirPodeMudarAtivo({
        ...alvo,
        plataforma: true,
        alvoEhPlataforma: true,
        papeisDoAlvo: ["super_admin"],
      });
    }).not.toThrow();
  });
});

describe("cargos e exceções", () => {
  it("Admin e Super Admin têm tudo; os outros cargos não", () => {
    expect(cargoTemTudo("admin")).toBe(true);
    expect(cargoTemTudo("super_admin")).toBe(true);
    expect(cargoTemTudo("gestor")).toBe(false);
  });

  it("cargo grava só permissões da empresa, sem repetir", () => {
    expect(permissoesGravaveis(["calendario.ver", "calendario.ver", "ranking.ver"])).toEqual([
      "calendario.ver",
      "ranking.ver",
    ]);
    expect(() => permissoesGravaveis(["plataforma_empresas.ver"])).toThrow(/não podem/);
    expect(() => permissoesGravaveis(["admin_logs.ver"])).toThrow(/não podem/);
  });

  it("exceção: uma permissão não é concedida e negada ao mesmo tempo", () => {
    expect(
      validarExcecoes([
        { permissao: "coletas.ver", efeito: "concede" },
        { permissao: "coletas.ver", efeito: "concede" },
      ]),
    ).toEqual([{ permissao: "coletas.ver", efeito: "concede" }]);
    expect(() =>
      validarExcecoes([
        { permissao: "coletas.ver", efeito: "concede" },
        { permissao: "coletas.ver", efeito: "nega" },
      ]),
    ).toThrow(/ao mesmo tempo/);
  });

  it("só admin (ou a Plataforma) ajusta exceções, e nunca as próprias", () => {
    const pedido = { quemPede: "a", alvo: "b", papelDeQuemPede: "admin", plataforma: false };
    expect(() => {
      exigirPodeAjustarExcecoes(pedido);
    }).not.toThrow();
    expect(() => {
      exigirPodeAjustarExcecoes({ ...pedido, papelDeQuemPede: "gestor" });
    }).toThrow(/administrador/);
    expect(() => {
      exigirPodeAjustarExcecoes({ ...pedido, papelDeQuemPede: null, plataforma: true });
    }).not.toThrow();
    expect(() => {
      exigirPodeAjustarExcecoes({ ...pedido, alvo: "a", plataforma: true });
    }).toThrow(/próprias/);
  });

  it("empresa modelo = a mais antiga que não é a nova", () => {
    const empresas = [
      { id: "b", criadoEm: new Date("2026-02-01") },
      { id: "a", criadoEm: new Date("2026-01-01") },
      { id: "nova", criadoEm: new Date("2025-01-01") },
    ];
    expect(escolherEmpresaModelo(empresas, "nova")?.id).toBe("a");
    expect(escolherEmpresaModelo([{ id: "nova", criadoEm: new Date() }], "nova")).toBeNull();
  });

  it("parâmetro com cara de segredo é recusado", () => {
    expect(() => {
      validarParametrosDeIntegracao({ host: "x", porta: 22 });
    }).not.toThrow();
    expect(() => {
      validarParametrosDeIntegracao({ host: "x", Api_Key: "1", senha: "2" });
    }).toThrow("Senha e token não ficam nos parâmetros (Api_Key, senha).");
  });

  it("vigência com fim antes do início é recusada", () => {
    expect(() => {
      validarVigencia("2026-12-01", "2026-11-01");
    }).toThrow("O fim da liberação não pode ser antes do início.");
    expect(() => {
      validarVigencia("2026-11-01", null);
    }).not.toThrow();
  });

  it("último admin da Plataforma não sai", () => {
    expect(() => {
      exigirPodeRemoverAdminPlataforma(1);
    }).toThrow("Não dá para remover o último administrador da Plataforma.");
    expect(() => {
      exigirPodeRemoverAdminPlataforma(2);
    }).not.toThrow();
  });
});

describe("logo", () => {
  it("aceita PNG e JPEG pelos primeiros bytes (com ou sem prefixo data:)", () => {
    expect(validarLogo(base64([0x89, 0x50, 0x4e, 0x47, 1, 2])).extensao).toBe("png");
    expect(validarLogo(`data:image/jpeg;base64,${base64([0xff, 0xd8, 0xff, 0xe0])}`).tipo).toBe(
      "image/jpeg",
    );
  });

  it("recusa outro formato e arquivo grande", () => {
    expect(() => validarLogo(base64([0x47, 0x49, 0x46, 0x38]))).toThrow(
      "Envie o logo em PNG ou JPEG.",
    );
    expect(() => validarLogo("não é base64!")).toThrow("Envie o logo em PNG ou JPEG.");
    const grande = new Uint8Array(512 * 1024 + 1);
    grande.set([0x89, 0x50, 0x4e, 0x47]);
    expect(() => validarLogo(Buffer.from(grande).toString("base64"))).toThrow(
      "O logo passa de 512 KB. Reduza a imagem e envie de novo.",
    );
  });

  it("caminho novo a cada envio, com carimbo UTC", () => {
    expect(caminhoDoLogo("e1", new Date("2026-11-10T13:04:05.678Z"), "png")).toBe(
      "e1/logo-20261110130405.png",
    );
  });
});
