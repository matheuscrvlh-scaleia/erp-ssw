import { TIPOS_INTEGRACAO as TIPOS_DO_BANCO } from "@erp/db/schema";
import { decifrarSegredo } from "@erp/db/segredos";
import { TIPOS_INTEGRACAO } from "@erp/shared/plataforma";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CAMINHOS_SENSIVEIS } from "../../infra/log";
import { cenarioDeAdmin } from "../../testes/admin";
import { contextoDoSegredo } from "./casos-de-uso";

let t: Awaited<ReturnType<typeof cenarioDeAdmin>>;
beforeEach(async () => {
  t = await cenarioDeAdmin();
});
afterEach(() => t.app.close());

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).toString(
  "base64",
);

describe("só a Plataforma acessa /api/v1/plataforma/*", () => {
  const rotas = (id: string) =>
    [
      ["GET", "/api/v1/plataforma/empresas"],
      ["POST", "/api/v1/plataforma/empresas"],
      ["GET", `/api/v1/plataforma/empresas/${id}`],
      ["PUT", `/api/v1/plataforma/empresas/${id}/logo`],
      ["GET", `/api/v1/plataforma/empresas/${id}/integracoes`],
      ["PUT", `/api/v1/plataforma/empresas/${id}/integracoes/ssw_bi2/segredo`],
      ["GET", `/api/v1/plataforma/empresas/${id}/usuarios`],
      ["GET", "/api/v1/plataforma/administradores"],
      ["DELETE", `/api/v1/plataforma/administradores/${id}`],
    ] as const;

  it("401 sem sessão; 403 para admin e Super Admin de empresa", async () => {
    for (const [method, url] of rotas(t.empresaA.id)) {
      expect((await t.app.inject({ method, url })).statusCode).toBe(401);
    }
    for (const papel of ["admin", "super_admin"]) {
      const { headers } = await t.comoPapel(papel);
      for (const [method, url] of rotas(t.empresaA.id)) {
        const r = await t.app.inject({ method, url, headers, payload: {} });
        expect(r.statusCode, `${method} ${url}`).toBe(403);
      }
    }
    expect(t.banco.auditoria).toHaveLength(0);
  });
});

describe("empresas", () => {
  it("cria em implantação, com cargos padrão e cópia da empresa modelo (a mais antiga)", async () => {
    t.banco.adm.detalhesDaEmpresa.set(t.empresaA.id, {
      slug: "fr",
      razaoSocial: null,
      cnpj: null,
      dominioSsw: null,
      criadoEm: new Date("2020-01-01"),
      atualizadoEm: new Date("2020-01-01"),
    });
    t.banco.adm.codigos.push({ empresaId: t.empresaA.id, codigo: 1, descricao: "Entregue" });
    t.banco.adm.configuracoes.push(
      {
        empresaId: t.empresaA.id,
        chave: "sla_meta_pct",
        valor: "95",
        descricao: "Meta",
        grupo: "performance",
        atualizadoEm: new Date(),
        atualizadoPor: null,
      },
      {
        empresaId: t.empresaA.id,
        chave: "edge_apikey",
        valor: "segredo-da-fr",
        descricao: "Infra",
        grupo: "empresa",
        atualizadoEm: new Date(),
        atualizadoPor: null,
      },
    );
    const { headers } = await t.comoPlataforma();
    const r = await t.app.inject({
      method: "POST",
      url: "/api/v1/plataforma/empresas",
      headers,
      payload: { nome: "Nova Log", nomeCurto: "Nova", slug: "nova-log", cnpj: "" },
    });
    expect(r.statusCode).toBe(200);
    const { id } = r.json<{ id: string }>();
    const chavesDosCargos = [...t.banco.cargos.keys()]
      .filter((k) => k.startsWith(id))
      .map((k) => k.slice(id.length + 1));
    expect(chavesDosCargos).toEqual(["super_admin", "admin", "gestor", "operador", "equipe"]);
    expect(t.banco.cargos.get(`${id}:super_admin`)?.protegido).toBe(true);
    expect(t.banco.cargos.get(`${id}:admin`)?.telas).toContain("admin_usuarios");
    expect(t.banco.adm.codigos.filter((c) => c.empresaId === id)).toHaveLength(1);
    expect(t.banco.adm.configuracoes.filter((c) => c.empresaId === id).map((c) => c.chave)).toEqual(
      ["sla_meta_pct"],
    );
    expect(t.banco.empresas.find((e) => e.id === id)?.status).toBe("implantacao");
    expect(t.banco.auditoria.at(-1)).toMatchObject({
      empresaId: id,
      acao: "criar",
      entidade: "empresa",
    });

    const repetida = await t.app.inject({
      method: "POST",
      url: "/api/v1/plataforma/empresas",
      headers,
      payload: { nome: "Outra", nomeCurto: "O", slug: "nova-log" },
    });
    expect(repetida.json()).toEqual({
      erro: { codigo: "CONFLITO", mensagem: "Empresa com esse identificador (slug) já existe." },
    });
  });

  it("422 com cor fora do formato e slug inválido", async () => {
    const { headers } = await t.comoPlataforma();
    const slug = await t.app.inject({
      method: "POST",
      url: "/api/v1/plataforma/empresas",
      headers,
      payload: { nome: "X Y", nomeCurto: "X", slug: "-ruim" },
    });
    expect(slug.statusCode).toBe(422);
    const cor = await t.app.inject({
      method: "PUT",
      url: `/api/v1/plataforma/empresas/${t.empresaA.id}`,
      headers,
      payload: {
        nome: "FR",
        nomeCurto: "FR",
        fuso: "America/Sao_Paulo",
        status: "ativa",
        corPrimaria: "azul",
        corDestaque: "#c0392b",
      },
    });
    expect(cor.json<{ erro: { mensagem: string } }>().erro.mensagem).toContain(
      "Cor no formato #RRGGBB",
    );
  });

  it("logo: PNG vai para o armazenamento com nome novo; o anterior é apagado; GIF é recusado", async () => {
    const { headers } = await t.comoPlataforma();
    const url = `/api/v1/plataforma/empresas/${t.empresaA.id}/logo`;
    const primeiro = await t.app.inject({
      method: "PUT",
      url,
      headers,
      payload: { conteudoBase64: PNG },
    });
    expect(primeiro.statusCode).toBe(200);
    const caminho1 = t.banco.empresas.find((e) => e.id === t.empresaA.id)?.logoCaminho;
    expect(caminho1).toMatch(new RegExp(`^${t.empresaA.id}/logo-\\d{14}\\.png$`));
    expect(t.cenario.armazenamento.arquivos.get(caminho1 ?? "")?.tipo).toBe("image/png");

    t.cenario.relogio.avancar(1000);
    await t.app.inject({ method: "PUT", url, headers, payload: { conteudoBase64: PNG } });
    expect(t.cenario.armazenamento.arquivos.has(caminho1 ?? "")).toBe(false);
    expect(t.cenario.armazenamento.arquivos.size).toBe(1);

    const gif = await t.app.inject({
      method: "PUT",
      url,
      headers,
      payload: { conteudoBase64: Buffer.from("GIF89a").toString("base64") },
    });
    expect(gif.json()).toEqual({
      erro: { codigo: "ENTRADA_INVALIDA", mensagem: "Envie o logo em PNG ou JPEG." },
    });
  });
});

describe("integrações e segredos", () => {
  it("o catálogo de tipos é o mesmo do banco", () => {
    expect([...TIPOS_INTEGRACAO]).toEqual([...TIPOS_DO_BANCO]);
  });

  it("segredo é cifrado com o contexto da empresa e nunca volta nem vai para a auditoria", async () => {
    const { headers } = await t.comoPlataforma();
    const valor = "token-super-secreto-123";
    const url = `/api/v1/plataforma/empresas/${t.empresaA.id}/integracoes/ssw_bi2/segredo`;
    const r = await t.app.inject({ method: "PUT", url, headers, payload: { segredo: valor } });
    expect(r.statusCode).toBe(200);
    expect(r.body).not.toContain(valor);

    const gravada = t.banco.adm.integracoes.find((i) => i.tipo === "ssw_bi2");
    expect(gravada?.segredoCifrado).not.toContain(valor);
    expect(gravada?.ativo).toBe(false);
    const cifrado = {
      cifrado: gravada?.segredoCifrado ?? "",
      versaoChave: gravada?.segredoVersaoChave ?? 0,
    };
    expect(
      decifrarSegredo(
        t.cenario.chavesDeSegredo,
        cifrado,
        contextoDoSegredo(t.empresaA.id, "ssw_bi2"),
      ),
    ).toBe(valor);
    // Copiado para outra empresa, não decifra (dado autenticado).
    expect(() =>
      decifrarSegredo(
        t.cenario.chavesDeSegredo,
        cifrado,
        contextoDoSegredo(t.empresaB.id, "ssw_bi2"),
      ),
    ).toThrow();

    const lista = await t.app.inject({
      url: `/api/v1/plataforma/empresas/${t.empresaA.id}/integracoes`,
      headers,
    });
    expect(lista.body).not.toContain(valor);
    expect(lista.body).not.toContain(gravada?.segredoCifrado ?? "???");
    const bi2 = lista
      .json<{ integracoes: { tipo: string; segredoDefinidoEm: string | null }[] }>()
      .integracoes.find((i) => i.tipo === "ssw_bi2");
    expect(typeof bi2?.segredoDefinidoEm).toBe("string");
    expect(JSON.stringify(t.banco.auditoria)).not.toContain(valor);
    expect(t.banco.auditoria.at(-1)).toMatchObject({
      acao: "definir_segredo",
      resumo: "Senha/token definido (ssw_bi2)",
    });

    const removido = await t.app.inject({ method: "PUT", url, headers, payload: { segredo: "" } });
    expect(removido.json()).toEqual({ segredoDefinidoEm: null });
    expect(t.banco.adm.integracoes.find((i) => i.tipo === "ssw_bi2")?.segredoCifrado).toBeNull();
  });

  it("parâmetro com cara de senha é recusado; integração sem segredo não aceita segredo", async () => {
    const { headers } = await t.comoPlataforma();
    const r = await t.app.inject({
      method: "PUT",
      url: `/api/v1/plataforma/empresas/${t.empresaA.id}/integracoes/sftp`,
      headers,
      payload: { ativo: true, parametros: { host: "ftp", senha: "123" } },
    });
    expect(r.statusCode).toBe(422);
    expect(r.body).not.toContain('"123"');
    const xml = await t.app.inject({
      method: "PUT",
      url: `/api/v1/plataforma/empresas/${t.empresaA.id}/integracoes/xml_cte/segredo`,
      headers,
      payload: { segredo: "x" },
    });
    expect(xml.statusCode).toBe(422);
  });

  it("o log do servidor esconde o campo segredo", () => {
    expect(CAMINHOS_SENSIVEIS).toContain("segredo");
    expect(CAMINHOS_SENSIVEIS).toContain("*.segredo");
  });
});

describe("usuários por empresa", () => {
  it("cadastros vêm da empresa editada, não da ativa de quem opera (Q29)", async () => {
    t.banco.definirCargo(t.empresaB.id, "so_da_b", { rotulo: "Só da B", telas: [] });
    const { headers } = await t.comoPlataforma(t.empresaA.id);
    const r = await t.app.inject({
      url: `/api/v1/plataforma/empresas/${t.empresaB.id}/cadastros`,
      headers,
    });
    expect(r.json<{ cargos: { chave: string }[] }>().cargos.map((c) => c.chave)).toContain(
      "so_da_b",
    );
    expect(t.banco.contextos.at(-1)).toMatchObject({ empresaId: t.empresaB.id, plataforma: true });
  });

  it("convite para e-mail que já tem conta só liga a pessoa à empresa", async () => {
    const pessoa = t.banco.criarUsuario({ email: "ja@fr.com.br" });
    t.banco.vincular(pessoa.id, t.empresaA.id, { papel: "operador" });
    const { headers } = await t.comoPlataforma();
    const r = await t.app.inject({
      method: "POST",
      url: `/api/v1/plataforma/empresas/${t.empresaB.id}/usuarios`,
      headers,
      payload: {
        modo: "convite",
        email: "ja@fr.com.br",
        nome: "Já",
        papel: "admin",
        departamento: null,
      },
    });
    expect(r.json()).toEqual({ id: pessoa.id, jaExistia: true });
    expect(t.banco.vinculos.filter((v) => v.usuarioId === pessoa.id)).toHaveLength(2);
    expect(t.cenario.correio.enviados).toHaveLength(0);
  });

  it("vínculo: papel tem de existir na empresa editada", async () => {
    const pessoa = t.banco.criarUsuario({ email: "p@fr.com.br" });
    t.banco.definirCargo(t.empresaA.id, "so_da_a", { rotulo: "Só da A", telas: [] });
    const { headers } = await t.comoPlataforma();
    const r = await t.app.inject({
      method: "PUT",
      url: `/api/v1/plataforma/empresas/${t.empresaB.id}/usuarios/${pessoa.id}`,
      headers,
      payload: { papel: "so_da_a", departamento: null, ativo: true },
    });
    expect(r.statusCode).toBe(422);
    expect(t.banco.vinculos.some((v) => v.usuarioId === pessoa.id)).toBe(false);
  });
});

describe("módulos", () => {
  it("vigência com fim antes do início é recusada; liberação gravada é registrada", async () => {
    const { headers } = await t.comoPlataforma();
    const url = `/api/v1/plataforma/empresas/${t.empresaB.id}/modulos/ranking`;
    const ruim = await t.app.inject({
      method: "PUT",
      url,
      headers,
      payload: { ativo: true, inicio: "2026-12-01", fim: "2026-11-01", observacao: null },
    });
    expect(ruim.statusCode).toBe(422);
    const bom = await t.app.inject({
      method: "PUT",
      url,
      headers,
      payload: { ativo: true, inicio: "", fim: null, observacao: "teste" },
    });
    expect(bom.statusCode).toBe(200);
    const lista = await t.app.inject({
      url: `/api/v1/plataforma/empresas/${t.empresaB.id}/modulos`,
      headers,
    });
    const ranking = lista
      .json<{ modulos: { chave: string }[] }>()
      .modulos.find((m) => m.chave === "ranking");
    expect(ranking).toMatchObject({ configurado: true, ativo: true, observacao: "teste" });
  });
});

describe("administradores da Plataforma", () => {
  it("adiciona por e-mail de conta existente e nunca remove o último", async () => {
    const { usuario, headers } = await t.comoPlataforma();
    const semConta = await t.app.inject({
      method: "POST",
      url: "/api/v1/plataforma/administradores",
      headers,
      payload: { email: "ninguem@x.com" },
    });
    expect(semConta.statusCode).toBe(404);

    const ultimo = await t.app.inject({
      method: "DELETE",
      url: `/api/v1/plataforma/administradores/${usuario.id}`,
      headers,
    });
    expect(ultimo.json()).toEqual({
      erro: {
        codigo: "CONFLITO",
        mensagem: "Não dá para remover o último administrador da Plataforma.",
      },
    });

    const colega = t.banco.criarUsuario({ email: "colega@scale.ia" });
    await t.app.inject({
      method: "POST",
      url: "/api/v1/plataforma/administradores",
      headers,
      payload: { email: "COLEGA@scale.ia" },
    });
    expect(t.banco.plataformaAdmins.has(colega.id)).toBe(true);
    expect(t.banco.auditoria.at(-1)).toMatchObject({
      empresaId: null,
      entidade: "admin_plataforma",
    });
    const removido = await t.app.inject({
      method: "DELETE",
      url: `/api/v1/plataforma/administradores/${colega.id}`,
      headers,
    });
    expect(removido.statusCode).toBe(200);
    expect(t.banco.plataformaAdmins.has(colega.id)).toBe(false);
  });
});
