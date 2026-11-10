/**
 * Identidade, acesso e plataforma (de-para "Fora do domínio (fundação)" + docs/regras/05 §1–2 e
 * ADR 0003/0005). Ids de usuário e de empresa são preservados: tudo continua apontando para eles.
 */
import {
  auditoria,
  cargos,
  cargoTelas,
  configuracoes,
  departamentos,
  departamentoTelas,
  empresaIntegracoes,
  empresaModulos,
  empresas,
  empresaUsuarios,
  identidadesExternas,
  plataformaAdmins,
  STATUS_EMPRESA,
  TIPOS_INTEGRACAO,
  usuarios,
  usuarioTelas,
} from "@erp/db/schema";
import { type ChavesDeSegredo, cifrarSegredo } from "@erp/db/segredos";
import { normalizarEmail } from "@erp/dominio/autenticacao";
import { SETORES } from "@erp/shared/acesso/papeis";
import { ehTela } from "@erp/shared/acesso/telas";

import { definirTabela, descartar, migrar, semApoio } from "../motor/tipos";
import { daLista, uuidDeterministico } from "../transformacoes/diversas";
import { ErroDeConversao } from "../transformacoes/erros";
import { lerObjetoJson, type ObjetoJson, type ValorJson } from "../transformacoes/json";
import { senhaLegada } from "../transformacoes/usuario";
import {
  daEmpresa,
  empresaNaChave,
  ESCOPO_DA_EMPRESA,
  ou,
  PELO_ID,
  referenciaEmpresa,
  referenciaUsuario,
} from "./comum";

/** Usuário entra no recorte `--empresa` se tem vínculo nela ou é da Plataforma. */
const USUARIO_NO_RECORTE = `(@empresa is null
  or exists (select 1 from public.empresa_usuarios eu where eu.user_id = u.id and eu.empresa_id = @empresa)
  or exists (select 1 from public.plataforma_admins pa where pa.user_id = u.id))`;

interface OrigemEmpresa {
  id: string;
  slug: string;
  nome: string;
  nome_curto: string;
  razao_social: string | null;
  cnpj: string | null;
  dominio_ssw: string | null;
  logo_path: string | null;
  cor_primaria: string | null;
  cor_destaque: string | null;
  slogan: string | null;
  fuso: string | null;
  status: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const COR = /^#[0-9a-fA-F]{6}$/;

function cor(valor: string | null, padrao: string, coluna: string): string {
  const v = valor ?? padrao;
  if (!COR.test(v)) throw new ErroDeConversao(coluna, v, "cor fora do formato #rrggbb");
  return v;
}

export const passoEmpresas = definirTabela({
  nome: "empresas",
  origem: "public.empresas",
  tabela: empresas,
  consulta: {
    colunas: "o.*",
    de: "public.empresas o",
    onde: ["(@empresa is null or o.id = @empresa)"],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemEmpresa) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) => {
    if (!SLUG.test(o.slug)) throw new ErroDeConversao("slug", o.slug, "slug fora do formato");
    return migrar({
      id: o.id,
      slug: o.slug,
      nome: o.nome,
      nomeCurto: o.nome_curto,
      razaoSocial: o.razao_social,
      cnpj: o.cnpj,
      dominioSsw: o.dominio_ssw,
      // O arquivo em si mora no Storage do Supabase: copiar para o S3 com a mesma chave
      // (docs/migracao-de-dados.md, "Depois da carga").
      logoCaminho: o.logo_path,
      corPrimaria: cor(o.cor_primaria, "#212a63", "cor_primaria"),
      corDestaque: cor(o.cor_destaque, "#c0392b", "cor_destaque"),
      slogan: o.slogan,
      fuso: ou(o.fuso, "America/Sao_Paulo"),
      status: daLista(o.status ?? "implantacao", STATUS_EMPRESA, "status"),
      criadoEm: o.criado_em ?? filtros.instante,
      // Usuários ainda não existem: gravados em `aposMigrar` (FK circular empresa × usuário).
      criadoPor: null,
      atualizadoEm: o.atualizado_em ?? o.criado_em ?? filtros.instante,
      atualizadoPor: null,
    });
  },
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: "(@empresa is null or id = @empresa)",
  referencias: [],
  foraDaConferencia: ["criadoPor", "atualizadoPor"],
  aposMigrar: async ({ origem, executor }, filtros) => {
    const linhas = await origem.consultar<{
      id: string;
      criado_por: string | null;
      atualizado_por: string | null;
    }>(
      `select id::text as id, criado_por::text as criado_por, atualizado_por::text as atualizado_por
       from public.empresas o where ${daEmpresa("o.id")}`,
      { empresa: { valor: filtros.empresaId, tipo: "uuid" } },
    );
    const n = await executor.executar(
      `update erp.empresas d
          set criado_por = (select u.id from erp.usuarios u where u.id = v.criado_por),
              atualizado_por = (select u.id from erp.usuarios u where u.id = v.atualizado_por)
         from unnest(@ids, @criados, @atualizados) as v(id, criado_por, atualizado_por)
        where d.id = v.id`,
      {
        ids: { valor: linhas.map((l) => l.id), tipo: "uuid[]" },
        criados: { valor: linhas.map((l) => l.criado_por), tipo: "uuid[]" },
        atualizados: { valor: linhas.map((l) => l.atualizado_por), tipo: "uuid[]" },
      },
    );
    return [`criado_por/atualizado_por gravados em ${String(n)} empresas (usuário sem par = nulo)`];
  },
});

interface OrigemUsuario {
  id: string;
  email: string | null;
  encrypted_password: string | null;
  email_confirmed_at: string | null;
  nome_meta: string | null;
  nome_perfil: string | null;
  ativo_perfil: boolean | null;
  banido: boolean;
  empresa_ativa_id: string | null;
  last_sign_in_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const passoUsuarios = definirTabela({
  nome: "usuarios",
  origem: "auth.users + public.usuarios_perfil",
  tabela: usuarios,
  consulta: {
    colunas: `u.id, u.email, u.encrypted_password, u.email_confirmed_at,
      u.raw_user_meta_data->>'nome' as nome_meta, p.nome as nome_perfil, p.ativo as ativo_perfil,
      (u.banned_until is not null and u.banned_until > @instante) as banido,
      p.empresa_ativa_id, u.last_sign_in_at, u.created_at, u.updated_at`,
    de: "auth.users u left join public.usuarios_perfil p on p.id = u.id",
    onde: ["u.deleted_at is null", "not coalesce(u.is_anonymous, false)", USUARIO_NO_RECORTE],
    chave: [{ expressao: "u.id", tipo: "uuid" }],
  },
  chaveDaLinha: (o: OrigemUsuario) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) => {
    if (o.email === null || o.email.trim() === "") return descartar("usuário sem e-mail");
    const email = normalizarEmail(o.email);
    const senha = senhaLegada(o.encrypted_password, o.email_confirmed_at);
    return migrar(
      {
        id: o.id,
        email,
        nome: o.nome_perfil ?? o.nome_meta ?? email,
        // O login novo valida o bcrypt e regrava em argon2id no primeiro acesso.
        senhaHash: senha.hash,
        senhaAlgoritmo: senha.algoritmo,
        ativo: ou(o.ativo_perfil, true) && !o.banido,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        ultimoLoginEm: o.last_sign_in_at,
        empresaPreferidaId: o.empresa_ativa_id,
        criadoEm: o.created_at ?? filtros.instante,
        atualizadoEm: o.updated_at ?? o.created_at ?? filtros.instante,
      },
      senha.hash === null ? ("motivo" in senha && senha.motivo) || null : null,
      o.banido ? "banido no Supabase Auth (fica inativo)" : null,
    );
  },
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: "true",
  referencias: [
    {
      colunas: ["empresaPreferidaId"],
      tabela: "erp.empresas",
      colunasDestino: ["id"],
      tipos: ["uuid"],
      seAusente: { anular: "empresaPreferidaId", motivo: "empresa preferida não migrou" },
    },
  ],
});

interface OrigemIdentidade {
  provider_id: string;
  user_id: string;
  email_identidade: string | null;
  email_usuario: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
}

export const passoIdentidadesExternas = definirTabela({
  nome: "identidades_externas",
  origem: "auth.identities (google)",
  tabela: identidadesExternas,
  consulta: {
    colunas: `i.provider_id, i.user_id, i.identity_data->>'email' as email_identidade,
      u.email as email_usuario, i.created_at, i.last_sign_in_at`,
    de: "auth.identities i join auth.users u on u.id = i.user_id",
    onde: ["i.provider = 'google'", "u.deleted_at is null", USUARIO_NO_RECORTE],
    chave: [{ expressao: "i.provider_id", tipo: "text" }],
  },
  chaveDaLinha: (o: OrigemIdentidade) => `google:${o.user_id}`,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) => {
    const email = o.email_identidade ?? o.email_usuario;
    if (email === null) return descartar("identidade Google sem e-mail");
    return migrar({
      id: uuidDeterministico("identidades_externas", "google", o.provider_id),
      usuarioId: o.user_id,
      provedor: "google",
      sujeito: o.provider_id,
      email: normalizarEmail(email),
      criadoEm: o.created_at ?? filtros.instante,
      ultimoUsoEm: o.last_sign_in_at,
    });
  },
  conflito: ["provedor", "sujeito"],
  aoConflitar: "atualizar",
  escopoDestino: "true",
  referencias: [
    {
      colunas: ["usuarioId"],
      tabela: "erp.usuarios",
      colunasDestino: ["id"],
      tipos: ["uuid"],
      seAusente: { descartar: "usuário não migrou" },
    },
  ],
});

interface OrigemPlataformaAdmin {
  user_id: string;
  criado_em: string | null;
  criado_por: string | null;
}

export const passoPlataformaAdmins = definirTabela({
  nome: "plataforma_admins",
  origem: "public.plataforma_admins",
  tabela: plataformaAdmins,
  consulta: {
    colunas: "o.user_id, o.criado_em, o.criado_por",
    de: "public.plataforma_admins o",
    onde: [],
    chave: [{ expressao: "o.user_id", tipo: "uuid" }],
  },
  chaveDaLinha: (o: OrigemPlataformaAdmin) => o.user_id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    migrar({
      usuarioId: o.user_id,
      criadoEm: o.criado_em ?? filtros.instante,
      criadoPor: o.criado_por,
    }),
  conflito: ["usuarioId"],
  aoConflitar: "atualizar",
  escopoDestino: "true",
  referencias: [
    {
      colunas: ["usuarioId"],
      tabela: "erp.usuarios",
      colunasDestino: ["id"],
      tipos: ["uuid"],
      seAusente: { descartar: "usuário não migrou" },
    },
    referenciaUsuario(plataformaAdmins, "criadoPor"),
  ],
});

interface OrigemCargo {
  empresa_id: string;
  key: string;
  label: string;
  is_protected: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Cargos eram globais; viram por empresa (Q30, ADR 0005): cópia de cada um para cada empresa. */
export const passoCargos = definirTabela({
  nome: "cargos",
  origem: "public.roles × public.empresas",
  tabela: cargos,
  consulta: {
    colunas: "e.id as empresa_id, r.key, r.label, r.is_protected, r.created_at, r.updated_at",
    de: "public.roles r cross join public.empresas e",
    onde: [daEmpresa("e.id")],
    chave: [
      { expressao: "e.id", tipo: "uuid" },
      { expressao: "r.key", tipo: "text" },
    ],
  },
  chaveDaLinha: (o: OrigemCargo) => `${o.empresa_id}:${o.key}`,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    migrar({
      empresaId: o.empresa_id,
      chave: o.key,
      rotulo: o.label,
      protegido: ou(o.is_protected, false),
      criadoEm: o.created_at ?? filtros.instante,
      atualizadoEm: o.updated_at ?? o.created_at ?? filtros.instante,
    }),
  conflito: ["empresaId", "chave"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(cargos, "empresaId")],
});

interface OrigemTelaDoCargo {
  empresa_id: string;
  role_key: string;
  screen: string;
}

const TELA_FORA_DO_CATALOGO = "tela fora do catálogo (@erp/shared/acesso/telas)";

export const passoCargoTelas = definirTabela({
  nome: "cargo_telas",
  origem: "public.role_screen_permissions × public.empresas",
  tabela: cargoTelas,
  consulta: {
    colunas: "e.id as empresa_id, p.role_key, p.screen",
    de: "public.role_screen_permissions p cross join public.empresas e",
    onde: [daEmpresa("e.id")],
    chave: [
      { expressao: "e.id", tipo: "uuid" },
      { expressao: "p.role_key", tipo: "text" },
      { expressao: "p.screen", tipo: "text" },
    ],
  },
  chaveDaLinha: (o: OrigemTelaDoCargo) => `${o.empresa_id}:${o.role_key}:${o.screen}`,
  preparar: semApoio,
  transformar: (o) =>
    ehTela(o.screen)
      ? migrar({ empresaId: o.empresa_id, cargoChave: o.role_key, telaChave: o.screen })
      : descartar(TELA_FORA_DO_CATALOGO),
  conflito: ["empresaId", "cargoChave", "telaChave"],
  aoConflitar: "ignorar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    {
      colunas: ["empresaId", "cargoChave"],
      tabela: "erp.cargos",
      colunasDestino: ["empresa_id", "chave"],
      tipos: ["uuid", "text"],
      seAusente: { descartar: "cargo não migrou" },
    },
  ],
});

interface OrigemDepartamento {
  key: string;
  label: string;
  descricao: string | null;
  ativo: boolean | null;
  is_protected: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  empresa_id: string | null;
}

export const passoDepartamentos = definirTabela({
  nome: "departamentos",
  origem: "public.departamentos",
  tabela: departamentos,
  consulta: {
    colunas: "o.*",
    de: "public.departamentos o",
    onde: [daEmpresa("o.empresa_id")],
    chave: [{ expressao: "o.key", tipo: "text" }],
  },
  chaveDaLinha: (o: OrigemDepartamento) => o.key,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    o.empresa_id === null
      ? descartar("empresa_id nulo")
      : migrar({
          empresaId: o.empresa_id,
          chave: o.key,
          rotulo: o.label,
          descricao: o.descricao,
          ativo: ou(o.ativo, true),
          protegido: ou(o.is_protected, false),
          criadoEm: o.created_at ?? filtros.instante,
          atualizadoEm: o.updated_at ?? o.created_at ?? filtros.instante,
        }),
  conflito: ["empresaId", "chave"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(departamentos, "empresaId")],
});

interface OrigemTelaDoDepartamento {
  empresa_id: string | null;
  departamento_key: string;
  screen: string;
}

export const passoDepartamentoTelas = definirTabela({
  nome: "departamento_telas",
  origem: "public.departamento_screen_permissions",
  tabela: departamentoTelas,
  consulta: {
    colunas: "coalesce(o.empresa_id, d.empresa_id) as empresa_id, o.departamento_key, o.screen",
    de: "public.departamento_screen_permissions o left join public.departamentos d on d.key = o.departamento_key",
    onde: [daEmpresa("coalesce(o.empresa_id, d.empresa_id)")],
    chave: [
      { expressao: "o.departamento_key", tipo: "text" },
      { expressao: "o.screen", tipo: "text" },
    ],
  },
  chaveDaLinha: (o: OrigemTelaDoDepartamento) => `${o.departamento_key}:${o.screen}`,
  preparar: semApoio,
  transformar: (o) => {
    if (o.empresa_id === null) return descartar("empresa_id nulo");
    if (!ehTela(o.screen)) return descartar(TELA_FORA_DO_CATALOGO);
    return migrar({
      empresaId: o.empresa_id,
      departamentoChave: o.departamento_key,
      telaChave: o.screen,
    });
  },
  conflito: ["empresaId", "departamentoChave", "telaChave"],
  aoConflitar: "ignorar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    {
      colunas: ["empresaId", "departamentoChave"],
      tabela: "erp.departamentos",
      colunasDestino: ["empresa_id", "chave"],
      tipos: ["uuid", "text"],
      seAusente: { descartar: "departamento não migrou" },
    },
  ],
});

interface OrigemVinculo {
  empresa_id: string;
  user_id: string;
  role_key: string | null;
  departamento_key: string | null;
  unidade_id: string | null;
  ativo: boolean | null;
  criado_em: string | null;
  criado_por: string | null;
  setor: string | null;
}

/** Vínculo usuário × empresa; o setor legado sai do perfil e vai para cada vínculo (ADR 0003). */
export const passoEmpresaUsuarios = definirTabela({
  nome: "empresa_usuarios",
  origem: "public.empresa_usuarios + usuarios_perfil.setor",
  tabela: empresaUsuarios,
  consulta: {
    colunas: `o.empresa_id, o.user_id, o.role_key, o.departamento_key, o.unidade_id, o.ativo,
      o.criado_em, o.criado_por, p.setor::text as setor`,
    de: "public.empresa_usuarios o left join public.usuarios_perfil p on p.id = o.user_id",
    onde: [daEmpresa("o.empresa_id")],
    chave: [
      { expressao: "o.empresa_id", tipo: "uuid" },
      { expressao: "o.user_id", tipo: "uuid" },
    ],
  },
  chaveDaLinha: (o: OrigemVinculo) => `${o.empresa_id}:${o.user_id}`,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    migrar({
      empresaId: o.empresa_id,
      usuarioId: o.user_id,
      papel: o.role_key,
      departamentoChave: o.departamento_key,
      setor: o.setor === null ? null : daLista(o.setor, SETORES, "setor"),
      unidadeId: o.unidade_id,
      ativo: ou(o.ativo, true),
      criadoEm: o.criado_em ?? filtros.instante,
      criadoPor: o.criado_por,
    }),
  conflito: ["empresaId", "usuarioId"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    referenciaEmpresa(empresaUsuarios, "empresaId"),
    {
      colunas: ["usuarioId"],
      tabela: "erp.usuarios",
      colunasDestino: ["id"],
      tipos: ["uuid"],
      seAusente: { descartar: "usuário não migrou" },
    },
    {
      colunas: ["empresaId", "papel"],
      tabela: "erp.cargos",
      colunasDestino: ["empresa_id", "chave"],
      tipos: ["uuid", "text"],
      seAusente: { anular: "papel", motivo: "cargo inexistente na empresa (papel vira nulo)" },
    },
    {
      colunas: ["empresaId", "departamentoChave"],
      tabela: "erp.departamentos",
      colunasDestino: ["empresa_id", "chave"],
      tipos: ["uuid", "text"],
      seAusente: {
        anular: "departamentoChave",
        motivo: "departamento de outra empresa ou inexistente (vira nulo)",
      },
    },
    {
      colunas: ["unidadeId"],
      tabela: "erp.unidades",
      colunasDestino: ["id"],
      tipos: ["uuid"],
      seAusente: { anular: "unidadeId", motivo: "unidade não migrou (vira nula)" },
    },
    referenciaUsuario(empresaUsuarios, "criadoPor"),
  ],
});

interface OrigemExcecao {
  id: string;
  user_id: string;
  screen: string;
  allowed: boolean | null;
  created_at: string | null;
  empresa_id: string | null;
}

export const passoUsuarioTelas = definirTabela({
  nome: "usuario_telas",
  origem: "public.user_screen_permissions",
  tabela: usuarioTelas,
  consulta: {
    colunas: "o.*",
    de: "public.user_screen_permissions o",
    onde: [daEmpresa("o.empresa_id")],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemExcecao) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) => {
    if (o.empresa_id === null) return descartar("empresa_id nulo");
    if (!ehTela(o.screen)) return descartar(TELA_FORA_DO_CATALOGO);
    return migrar({
      empresaId: o.empresa_id,
      usuarioId: o.user_id,
      telaChave: o.screen,
      permitido: ou(o.allowed, true),
      criadoEm: o.created_at ?? filtros.instante,
    });
  },
  conflito: ["empresaId", "usuarioId", "telaChave"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    referenciaEmpresa(usuarioTelas, "empresaId"),
    {
      colunas: ["usuarioId"],
      tabela: "erp.usuarios",
      colunasDestino: ["id"],
      tipos: ["uuid"],
      seAusente: { descartar: "usuário não migrou" },
    },
  ],
});

interface OrigemEmpresaModulo {
  empresa_id: string;
  modulo_key: string;
  ativo: boolean | null;
  inicio: string | null;
  fim: string | null;
  observacao: string | null;
  atualizado_em: string | null;
  atualizado_por: string | null;
}

export const passoEmpresaModulos = definirTabela({
  nome: "empresa_modulos",
  origem: "public.empresa_modulos",
  tabela: empresaModulos,
  consulta: {
    colunas: "o.*",
    de: "public.empresa_modulos o",
    onde: [daEmpresa("o.empresa_id")],
    chave: [
      { expressao: "o.empresa_id", tipo: "uuid" },
      { expressao: "o.modulo_key", tipo: "text" },
    ],
  },
  chaveDaLinha: (o: OrigemEmpresaModulo) => `${o.empresa_id}:${o.modulo_key}`,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    migrar({
      empresaId: o.empresa_id,
      moduloChave: o.modulo_key,
      ativo: ou(o.ativo, true),
      inicio: o.inicio,
      fim: o.fim,
      observacao: o.observacao,
      atualizadoEm: o.atualizado_em ?? filtros.instante,
      atualizadoPor: o.atualizado_por,
    }),
  conflito: ["empresaId", "moduloChave"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    referenciaEmpresa(empresaModulos, "empresaId"),
    {
      colunas: ["moduloChave"],
      tabela: "erp.modulos",
      colunasDestino: ["chave"],
      tipos: ["text"],
      seAusente: { descartar: "módulo fora do catálogo (@erp/shared/acesso/modulos)" },
    },
    referenciaUsuario(empresaModulos, "atualizadoPor"),
  ],
});

interface OrigemIntegracao {
  empresa_id: string;
  tipo: string;
  id: string | null;
  ativo: boolean | null;
  parametros: string | null;
  segredo: string | null;
  segredo_definido_em: string | null;
  ultimo_teste_em: string | null;
  ultimo_teste_ok: boolean | null;
  ultimo_teste_msg: string | null;
  atualizado_em: string | null;
  atualizado_por: string | null;
  cfg_dominio: string | null;
  cfg_usuario: string | null;
  cfg_senha: string | null;
  cfg_cnpj_edi: string | null;
  cfg_webhook_secret: string | null;
  cfg_cnpjs_aceitos: string[] | null;
  cfg_verificacao_em: string | null;
  cfg_verificacao_ok: boolean | null;
  cfg_verificacao_mensagem: string | null;
  cfg_verificacao_origem: string | null;
}

/**
 * Integrações + o `ssw_config` legado. O segredo principal sai do Vault (ou, se a integração não
 * tem, da senha/segredo do webhook do `ssw_config`) e é cifrado com AES-256-GCM pela aplicação
 * (contexto `<empresa_id>:<tipo>`, como em `packages/db/src/segredos.ts`). Domínio, usuário,
 * CNPJ EDI, CNPJs aceitos e a última verificação vão para `parametros` quando a integração não
 * os tem. O token de sessão do SSW não migra: expira em 4 h e o worker gera outro.
 */
const ORIGEM_INTEGRACOES = `(
  select i.empresa_id, i.tipo, i.id, i.ativo, i.parametros::text as parametros,
         nullif(s.decrypted_secret, '') as segredo, i.segredo_definido_em, i.ultimo_teste_em,
         i.ultimo_teste_ok, i.ultimo_teste_msg, i.atualizado_em, i.atualizado_por
    from public.empresa_integracoes i
    left join vault.decrypted_secrets s on s.id = i.segredo_id
  union all
  select c.empresa_id, t.tipo, null, true, null, null, null, null, null, null, c.updated_at, null
    from public.ssw_config c
   cross join (values ('ssw_api'), ('ssw_webhook')) as t(tipo)
   where not exists (select 1 from public.empresa_integracoes i
                      where i.empresa_id = c.empresa_id and i.tipo = t.tipo)
     and ((t.tipo = 'ssw_api' and nullif(c.senha, '') is not null)
       or (t.tipo = 'ssw_webhook' and nullif(c.webhook_secret, '') is not null))
) o left join public.ssw_config c on c.empresa_id = o.empresa_id`;

function semValor(parametros: ObjetoJson, chave: string): boolean {
  const atual = parametros[chave];
  return atual === undefined || atual === null || atual === "";
}

function completar(parametros: ObjetoJson, chave: string, valor: ValorJson): void {
  if (valor !== null && valor !== "" && semValor(parametros, chave)) parametros[chave] = valor;
}

export function parametrosDaIntegracao(o: OrigemIntegracao): ObjetoJson {
  const parametros = lerObjetoJson(o.parametros);
  if (o.tipo === "ssw_api") {
    completar(parametros, "dominio", o.cfg_dominio);
    completar(parametros, "usuario", o.cfg_usuario);
    completar(parametros, "cnpj_edi", o.cfg_cnpj_edi);
    if (o.cfg_verificacao_em !== null && semValor(parametros, "ultima_verificacao")) {
      parametros.ultima_verificacao = {
        em: o.cfg_verificacao_em,
        ok: o.cfg_verificacao_ok,
        mensagem: o.cfg_verificacao_mensagem,
        origem: o.cfg_verificacao_origem,
      };
    }
  }
  if (o.tipo === "ssw_webhook" && o.cfg_cnpjs_aceitos && o.cfg_cnpjs_aceitos.length > 0) {
    completar(parametros, "cnpjs_aceitos", o.cfg_cnpjs_aceitos);
  }
  return parametros;
}

function segredoLegado(o: OrigemIntegracao): string | null {
  const legado =
    o.tipo === "ssw_api" ? o.cfg_senha : o.tipo === "ssw_webhook" ? o.cfg_webhook_secret : null;
  return o.segredo ?? (legado === "" ? null : legado);
}

export function passoEmpresaIntegracoes(chaves: ChavesDeSegredo) {
  return definirTabela({
    nome: "empresa_integracoes",
    origem: "public.empresa_integracoes + vault + public.ssw_config",
    tabela: empresaIntegracoes,
    consulta: {
      colunas: `o.*, c.dominio as cfg_dominio, c.usuario as cfg_usuario, c.senha as cfg_senha,
        c.cnpj_edi as cfg_cnpj_edi, c.webhook_secret as cfg_webhook_secret,
        c.cnpjs_transportadora_aceitos as cfg_cnpjs_aceitos,
        c.ultima_verificacao_em as cfg_verificacao_em, c.ultima_verificacao_ok as cfg_verificacao_ok,
        c.ultima_verificacao_mensagem as cfg_verificacao_mensagem,
        c.ultima_verificacao_origem as cfg_verificacao_origem`,
      de: ORIGEM_INTEGRACOES,
      onde: [daEmpresa("o.empresa_id")],
      chave: [
        { expressao: "o.empresa_id", tipo: "uuid" },
        { expressao: "o.tipo", tipo: "text" },
      ],
    },
    chaveDaLinha: (o: OrigemIntegracao) => `${o.empresa_id}:${o.tipo}`,
    preparar: semApoio,
    transformar: (o, _apoio, filtros) => {
      const tipo = daLista(o.tipo, TIPOS_INTEGRACAO, "tipo");
      const segredo = segredoLegado(o);
      const cifrado =
        segredo === null ? null : cifrarSegredo(chaves, segredo, `${o.empresa_id}:${tipo}`);
      return migrar({
        id: o.id ?? uuidDeterministico("empresa_integracoes", o.empresa_id, tipo),
        empresaId: o.empresa_id,
        tipo,
        ativo: ou(o.ativo, false),
        parametros: parametrosDaIntegracao(o),
        segredoCifrado: cifrado?.cifrado ?? null,
        segredoVersaoChave: cifrado?.versaoChave ?? null,
        segredoAnteriorCifrado: null,
        segredoAnteriorVersaoChave: null,
        segredoDefinidoEm:
          cifrado === null ? null : (o.segredo_definido_em ?? o.atualizado_em ?? filtros.instante),
        ultimoTesteEm: o.ultimo_teste_em,
        ultimoTesteOk: o.ultimo_teste_ok,
        ultimoTesteMsg: o.ultimo_teste_msg,
        atualizadoEm: o.atualizado_em ?? filtros.instante,
        atualizadoPor: o.atualizado_por,
      });
    },
    conflito: ["empresaId", "tipo"],
    aoConflitar: "atualizar",
    escopoDestino: ESCOPO_DA_EMPRESA,
    referencias: [
      referenciaEmpresa(empresaIntegracoes, "empresaId"),
      referenciaUsuario(empresaIntegracoes, "atualizadoPor"),
    ],
    // IV aleatório: o texto cifrado muda a cada execução. A versão da chave é conferida.
    foraDaConferencia: ["segredoCifrado"],
  });
}

interface OrigemConfiguracao {
  chave: string;
  valor: string;
  descricao: string;
  grupo: string;
  updated_at: string | null;
  updated_by: string | null;
  empresa_id: string | null;
}

export const passoConfiguracoes = definirTabela({
  nome: "configuracoes",
  origem: "public.configuracoes",
  tabela: configuracoes,
  consulta: {
    colunas: "o.*",
    de: "public.configuracoes o",
    onde: ["(@empresa is null or o.empresa_id = @empresa or o.empresa_id is null)"],
    chave: [empresaNaChave("o.empresa_id"), { expressao: "o.chave", tipo: "text" }],
  },
  chaveDaLinha: (o: OrigemConfiguracao) => `${o.empresa_id ?? "plataforma"}:${o.chave}`,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    migrar({
      // A origem não tem id: um estável por (empresa, chave).
      id: uuidDeterministico("configuracoes", o.empresa_id ?? "", o.chave),
      empresaId: o.empresa_id,
      chave: o.chave,
      valor: o.valor,
      descricao: o.descricao,
      grupo: o.grupo,
      atualizadoEm: o.updated_at ?? filtros.instante,
      atualizadoPor: o.updated_by,
    }),
  conflito: ["empresaId", "chave"],
  aoConflitar: "atualizar",
  chaveDestino: ["id"],
  escopoDestino: "(@empresa is null or empresa_id = @empresa or empresa_id is null)",
  referencias: [
    {
      colunas: ["empresaId"],
      tabela: "erp.empresas",
      colunasDestino: ["id"],
      tipos: ["uuid"],
      seAusente: { descartar: "empresa não migrou" },
    },
    referenciaUsuario(configuracoes, "atualizadoPor"),
  ],
});

interface OrigemAuditoria {
  id: string;
  empresa_id: string | null;
  ator_id: string | null;
  ator_email: string | null;
  ator_tipo: string;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  resumo: string | null;
  antes: string | null;
  depois: string | null;
  ip: string | null;
  user_agent: string | null;
  criado_em: string | null;
}

const TIPOS_DE_ATOR = ["usuario", "plataforma", "sistema", "integracao"] as const;

export const passoAuditoria = definirTabela({
  nome: "auditoria",
  origem: "public.auditoria",
  tabela: auditoria,
  consulta: {
    colunas: "o.*",
    de: "public.auditoria o",
    onde: [daEmpresa("o.empresa_id")],
    chave: [{ expressao: "o.id", tipo: "bigint" }],
  },
  chaveDaLinha: (o: OrigemAuditoria) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    migrar({
      empresaId: o.empresa_id,
      atorId: o.ator_id,
      atorEmail: o.ator_email,
      atorTipo: daLista(o.ator_tipo, TIPOS_DE_ATOR, "ator_tipo"),
      acao: o.acao,
      entidade: o.entidade,
      entidadeId: o.entidade_id,
      resumo: o.resumo,
      antes: o.antes,
      depois: o.depois,
      ip: o.ip,
      userAgent: o.user_agent,
      criadoEm: o.criado_em ?? filtros.instante,
    }),
  // O histórico só cresce: id preservado, linha existente nunca é reescrita.
  identidade: { coluna: "id", valor: (o) => o.id },
  conflito: ["id"],
  aoConflitar: "ignorar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    {
      colunas: ["empresaId"],
      tabela: "erp.empresas",
      colunasDestino: ["id"],
      tipos: ["uuid"],
      seAusente: {
        anular: "empresaId",
        motivo: "empresa não migrou (vira registro da Plataforma)",
      },
    },
    referenciaUsuario(auditoria, "atorId"),
  ],
  aposMigrar: async ({ executor }) => {
    await executor.executar(
      `select setval(pg_get_serial_sequence('erp.auditoria', 'id'),
                     coalesce((select max(id) from erp.auditoria), 0) + 1, false)`,
      {},
    );
    return ["sequência de erp.auditoria.id posicionada depois do maior id migrado"];
  },
});
