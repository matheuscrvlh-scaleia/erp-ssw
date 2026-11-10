import {
  type IntegracaoDaEmpresa,
  type ModuloDaEmpresa,
  type VinculoNaEmpresa,
} from "@erp/shared/contratos/plataforma";
import { describe, expect, it } from "vitest";

import { problemaDoLogo } from "./AbaDados";
import { itensDaImplantacao, moduloVale, parametrosEditados } from "./AbasDaEmpresa";
import { slugDoNome } from "./PaginaEmpresas";

const HOJE = "2026-11-10";

const modulo = (extra: Partial<ModuloDaEmpresa>): ModuloDaEmpresa => ({
  chave: "ranking",
  nome: "Ranking",
  descricao: null,
  essencial: false,
  ordem: 1,
  configurado: true,
  ativo: true,
  inicio: null,
  fim: null,
  observacao: null,
  atualizadoEm: null,
  ...extra,
});

const integracao = (extra: Partial<IntegracaoDaEmpresa>): IntegracaoDaEmpresa => ({
  tipo: "ssw_bi2",
  configurada: true,
  ativo: true,
  parametros: {},
  segredoDefinidoEm: null,
  ultimoTesteEm: null,
  ultimoTesteOk: null,
  ultimoTesteMsg: null,
  atualizadoEm: null,
  ...extra,
});

describe("Plataforma › empresas", () => {
  it("slug sugerido pelo nome", () => {
    expect(slugDoNome("  Transportes São João Ltda. ")).toBe("transportes-sao-joao-ltda");
  });

  it("logo: só PNG/JPEG até 512 KB", () => {
    expect(problemaDoLogo({ type: "image/png", size: 1000 })).toBeNull();
    expect(problemaDoLogo({ type: "image/gif", size: 10 })).toBe("Envie o logo em PNG ou JPEG.");
    expect(problemaDoLogo({ type: "image/jpeg", size: 600 * 1024 })).toContain("512 KB");
  });

  it("parâmetros: troca os editados, lista por vírgula, apaga o vazio e mantém os desconhecidos", () => {
    expect(
      parametrosEditados(
        { host: "velho", origem: "env", porta: "22" },
        [{ chave: "host" }, { chave: "porta" }, { chave: "cnpjs", lista: true }],
        { host: " ftp.fr ", porta: "", cnpjs: "1, 2,,3" },
      ),
    ).toEqual({ host: "ftp.fr", origem: "env", cnpjs: ["1", "2", "3"] });
  });

  it("módulo vale com vigência no dia de Brasília; essencial sempre", () => {
    expect(moduloVale(modulo({ fim: HOJE }), HOJE)).toBe(true);
    expect(moduloVale(modulo({ fim: "2026-11-09" }), HOJE)).toBe(false);
    expect(moduloVale(modulo({ inicio: "2026-11-11" }), HOJE)).toBe(false);
    expect(moduloVale(modulo({ ativo: false, essencial: true }), HOJE)).toBe(true);
  });

  it("implantação: aponta o que falta, inclusive segredo de integração ligada", () => {
    const vinculo: VinculoNaEmpresa = {
      usuarioId: "00000000-0000-4000-8000-000000000001",
      nome: "Ana",
      email: "ana@fr.com.br",
      papel: "admin",
      departamento: null,
      ativo: true,
      criadoEm: "2026-11-01T00:00:00.000Z",
      totalEmpresas: 1,
      adminPlataforma: true,
    };
    const itens = itensDaImplantacao(
      { razaoSocial: null, cnpj: "1", dominioSsw: "FRT", status: "implantacao" },
      [modulo({})],
      [integracao({})],
      [vinculo],
      HOJE,
    );
    expect(itens.map((i) => [i.titulo, i.feito])).toEqual([
      ["Dados da empresa", false],
      ["Módulos liberados", true],
      ["Integrações configuradas", true],
      ["Senhas e tokens das integrações", false],
      ["Usuários convidados", false],
      ["Empresa ativa", false],
    ]);
    expect(itens[0]?.detalhe).toBe("Falta: razão social.");
    expect(itens[3]?.detalhe).toBe("Falta: Token do BI2.");
  });
});
