import { contrato } from "@erp/shared/contract";
import { ehDataIso } from "@erp/shared/dates";
import {
  SITUACOES_DA_INTEGRACAO,
  STATUS_EMPRESA,
  TIPOS_INTEGRACAO,
  TIPOS_INTEGRACAO_PLATAFORMA,
} from "@erp/shared/platform";
import { z } from "@erp/shared/zod";

import {
  cargo,
  chaveDeCadastro,
  emailDeUsuario,
  listaDePermissoes,
  parametroChave,
  rotuloDoCargo,
} from "./admin";

/*
 * Plataforma (equipe Scale IA): empresas, marca, módulos, usuários por empresa, integrações e
 * segredos, a equipe da Plataforma e os cargos dela. Tudo exige a equipe da Plataforma, com a
 * ação no cargo dela.
 * origem: src/features/plataforma/plataforma.functions.ts (sistema atual)
 */

const ok = z.object({ ok: z.literal(true) });
const parametroEmpresa = z.object({ id: z.uuid() });
const cor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor no formato #RRGGBB");
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const empresaResumo = z.object({
  id: z.uuid(),
  slug: z.string(),
  nome: z.string(),
  nomeCurto: z.string(),
  cnpj: z.string().nullable(),
  status: z.enum(STATUS_EMPRESA),
  criadoEm: z.iso.datetime(),
  usuariosAtivos: z.number().int(),
  modulosLiberados: z.number().int(),
  integracoesAtivas: z.number().int(),
});
export type EmpresaResumo = z.infer<typeof empresaResumo>;

export const empresaCompleta = z.object({
  id: z.uuid(),
  slug: z.string(),
  nome: z.string(),
  nomeCurto: z.string(),
  razaoSocial: z.string().nullable(),
  cnpj: z.string().nullable(),
  dominioSsw: z.string().nullable(),
  logoUrl: z.string().nullable(),
  /** Favicon da aba do navegador; nulo = o do sistema. */
  faviconUrl: z.string().nullable(),
  corPrimaria: z.string(),
  corDestaque: z.string(),
  slogan: z.string().nullable(),
  fuso: z.string(),
  status: z.enum(STATUS_EMPRESA),
  criadoEm: z.iso.datetime(),
  atualizadoEm: z.iso.datetime(),
});
export type EmpresaCompleta = z.infer<typeof empresaCompleta>;

export const dadosDaEmpresa = z.object({
  nome: z.string().trim().min(2).max(120),
  nomeCurto: z.string().trim().min(1).max(30),
  razaoSocial: textoOpcional(160),
  cnpj: textoOpcional(20),
  dominioSsw: textoOpcional(20),
  fuso: z.string().trim().min(3).max(60),
  status: z.enum(STATUS_EMPRESA),
  corPrimaria: cor,
  corDestaque: cor,
  slogan: textoOpcional(120),
});
export type DadosDaEmpresa = z.output<typeof dadosDaEmpresa>;

export const moduloDaEmpresa = z.object({
  chave: z.string(),
  nome: z.string(),
  descricao: z.string().nullable(),
  essencial: z.boolean(),
  ordem: z.number().int(),
  /** Já tem linha de liberação (falso = nunca configurado). */
  configurado: z.boolean(),
  ativo: z.boolean(),
  inicio: z.string().nullable(),
  fim: z.string().nullable(),
  observacao: z.string().nullable(),
  atualizadoEm: z.iso.datetime().nullable(),
});
export type ModuloDaEmpresa = z.infer<typeof moduloDaEmpresa>;

const dataOuNulo = z
  .string()
  .refine(ehDataIso, "Data inválida (use AAAA-MM-DD).")
  .nullable()
  .or(z.literal("").transform(() => null));

/** Parâmetro de integração: texto, número, booleano, nulo ou lista de textos. */
export const valorDeParametro = z.union([
  z.string().max(500),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string().max(200)).max(200),
]);
export type ValorDeParametro = z.infer<typeof valorDeParametro>;

export const integracaoDaEmpresa = z.object({
  tipo: z.enum(TIPOS_INTEGRACAO),
  configurada: z.boolean(),
  ativo: z.boolean(),
  parametros: z.record(z.string(), valorDeParametro),
  /** Só quando o segredo foi gravado; o valor nunca sai da API. */
  segredoDefinidoEm: z.iso.datetime().nullable(),
  ultimoTesteEm: z.iso.datetime().nullable(),
  ultimoTesteOk: z.boolean().nullable(),
  ultimoTesteMsg: z.string().nullable(),
  atualizadoEm: z.iso.datetime().nullable(),
  /** Última vez que o sistema falou com o serviço (job do worker-ssw ou teste manual). */
  ultimaConexao: z
    .object({ em: z.iso.datetime(), ok: z.boolean(), mensagem: z.string().nullable() })
    .nullable(),
  /** Último dado que chegou por esta integração; `detalhe` = arquivo ou relatório, quando há. */
  ultimoDado: z.object({ em: z.iso.datetime(), detalhe: z.string().nullable() }).nullable(),
  situacao: z.enum(SITUACOES_DA_INTEGRACAO),
});
export type IntegracaoDaEmpresa = z.infer<typeof integracaoDaEmpresa>;

/** Pessoa da equipe da Plataforma (entra em todas as empresas) com o cargo dela na Plataforma. */
export const adminDaPlataforma = z.object({
  usuarioId: z.uuid(),
  nome: z.string().nullable(),
  email: z.string(),
  ativo: z.boolean(),
  cargo: z.string(),
  cargoRotulo: z.string(),
  ultimoLoginEm: z.iso.datetime().nullable(),
  criadoEm: z.iso.datetime(),
});
export type AdminDaPlataforma = z.infer<typeof adminDaPlataforma>;

const chaveDoCargoDaPlataforma = z.string().min(1).max(64);

const parametroTipo = z.object({ id: z.uuid(), tipo: z.enum(TIPOS_INTEGRACAO) });

/** Integração da própria Plataforma (domínio, e-mail, worker-ssw). O segredo nunca sai da API. */
export const integracaoDaPlataforma = z.object({
  tipo: z.enum(TIPOS_INTEGRACAO_PLATAFORMA),
  parametros: z.record(z.string(), valorDeParametro),
  segredoDefinidoEm: z.iso.datetime().nullable(),
  atualizadoEm: z.iso.datetime().nullable(),
});
export type IntegracaoDaPlataforma = z.infer<typeof integracaoDaPlataforma>;

const enderecoHttp = z.url({ protocol: /^https?$/, error: "Informe um endereço http(s) válido." });
/** Parâmetros aceitos por tipo (a API valida; a tela usa os mesmos campos do catálogo). */
export const PARAMETROS_DA_INTEGRACAO_PLATAFORMA = {
  dominio: z.object({ url: enderecoHttp }),
  email: z.object({
    remetente: z
      .string()
      .trim()
      .max(200)
      .regex(
        /^([^<>]+<)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/,
        "Remetente no formato Nome <email@dominio>.",
      ),
  }),
  worker_ssw: z.object({ url: enderecoHttp }),
} as const;

const parametroTipoDaPlataforma = z.object({ tipo: z.enum(TIPOS_INTEGRACAO_PLATAFORMA) });

export const contratosPlataforma = {
  listarEmpresas: contrato({
    metodo: "GET",
    caminho: "/api/v1/plataforma/empresas",
    saida: z.object({ empresas: z.array(empresaResumo) }),
  }),
  criarEmpresa: contrato({
    metodo: "POST",
    caminho: "/api/v1/plataforma/empresas",
    entrada: z.object({
      nome: z.string().trim().min(2).max(120),
      nomeCurto: z.string().trim().min(1).max(30),
      slug: z
        .string()
        .trim()
        .min(1)
        .max(60)
        .regex(/^[a-z0-9][a-z0-9-]*$/, "Use minúsculas, números e hífen (sem começar com hífen)."),
      cnpj: textoOpcional(20),
    }),
    saida: z.object({ id: z.uuid() }),
  }),
  obterEmpresa: contrato({
    metodo: "GET",
    caminho: "/api/v1/plataforma/empresas/:id",
    parametros: parametroEmpresa,
    saida: empresaCompleta,
  }),
  salvarEmpresa: contrato({
    metodo: "PUT",
    caminho: "/api/v1/plataforma/empresas/:id",
    parametros: parametroEmpresa,
    entrada: dadosDaEmpresa,
    saida: ok,
  }),
  enviarLogo: contrato({
    metodo: "PUT",
    caminho: "/api/v1/plataforma/empresas/:id/logo",
    parametros: parametroEmpresa,
    // 512 KiB em base64 = 699 052 caracteres; a folga cobre o prefixo `data:` se vier.
    entrada: z.object({ conteudoBase64: z.string().min(1).max(699_100) }),
    saida: z.object({ logoUrl: z.string().nullable() }),
  }),
  removerLogo: contrato({
    metodo: "DELETE",
    caminho: "/api/v1/plataforma/empresas/:id/logo",
    parametros: parametroEmpresa,
    saida: ok,
  }),
  enviarFavicon: contrato({
    metodo: "PUT",
    caminho: "/api/v1/plataforma/empresas/:id/favicon",
    parametros: parametroEmpresa,
    entrada: z.object({ conteudoBase64: z.string().min(1).max(699_100) }),
    saida: z.object({ faviconUrl: z.string().nullable() }),
  }),
  removerFavicon: contrato({
    metodo: "DELETE",
    caminho: "/api/v1/plataforma/empresas/:id/favicon",
    parametros: parametroEmpresa,
    saida: ok,
  }),
  listarModulos: contrato({
    metodo: "GET",
    caminho: "/api/v1/plataforma/empresas/:id/modulos",
    parametros: parametroEmpresa,
    saida: z.object({ modulos: z.array(moduloDaEmpresa) }),
  }),
  salvarModulo: contrato({
    metodo: "PUT",
    caminho: "/api/v1/plataforma/empresas/:id/modulos/:modulo",
    parametros: z.object({ id: z.uuid(), modulo: z.string().min(1).max(60) }),
    entrada: z.object({
      ativo: z.boolean(),
      inicio: dataOuNulo,
      fim: dataOuNulo,
      observacao: textoOpcional(300),
    }),
    saida: ok,
  }),
  listarIntegracoes: contrato({
    metodo: "GET",
    caminho: "/api/v1/plataforma/empresas/:id/integracoes",
    parametros: parametroEmpresa,
    saida: z.object({ integracoes: z.array(integracaoDaEmpresa) }),
  }),
  salvarIntegracao: contrato({
    metodo: "PUT",
    caminho: "/api/v1/plataforma/empresas/:id/integracoes/:tipo",
    parametros: parametroTipo,
    entrada: z.object({
      ativo: z.boolean(),
      parametros: z
        .record(z.string().min(1).max(60), valorDeParametro)
        .refine((p) => Object.keys(p).length <= 30, "Parâmetros demais."),
    }),
    saida: ok,
  }),
  definirSegredo: contrato({
    metodo: "PUT",
    caminho: "/api/v1/plataforma/empresas/:id/integracoes/:tipo/segredo",
    parametros: parametroTipo,
    /** Vazio remove o segredo. */
    entrada: z.object({ segredo: z.string().trim().max(4096) }),
    saida: z.object({ segredoDefinidoEm: z.iso.datetime().nullable() }),
  }),
  listarIntegracoesDaPlataforma: contrato({
    metodo: "GET",
    caminho: "/api/v1/plataforma/integracoes",
    saida: z.object({ integracoes: z.array(integracaoDaPlataforma) }),
  }),
  salvarIntegracaoDaPlataforma: contrato({
    metodo: "PUT",
    caminho: "/api/v1/plataforma/integracoes/:tipo",
    parametros: parametroTipoDaPlataforma,
    entrada: z.object({ parametros: z.record(z.string().min(1).max(60), valorDeParametro) }),
    saida: ok,
  }),
  definirSegredoDaPlataforma: contrato({
    metodo: "PUT",
    caminho: "/api/v1/plataforma/integracoes/:tipo/segredo",
    parametros: parametroTipoDaPlataforma,
    /** Vazio remove o segredo. */
    entrada: z.object({ segredo: z.string().trim().max(4096) }),
    saida: z.object({ segredoDefinidoEm: z.iso.datetime().nullable() }),
  }),
  /** Manda um e-mail de teste com a configuração gravada. */
  testarEmailDaPlataforma: contrato({
    metodo: "POST",
    caminho: "/api/v1/plataforma/integracoes/email/teste",
    entrada: z.object({ para: emailDeUsuario }),
    saida: ok,
  }),
  listarAdmins: contrato({
    metodo: "GET",
    caminho: "/api/v1/plataforma/administradores",
    saida: z.object({ admins: z.array(adminDaPlataforma) }),
  }),
  adicionarAdmin: contrato({
    metodo: "POST",
    caminho: "/api/v1/plataforma/administradores",
    entrada: z.object({ email: emailDeUsuario, cargo: chaveDoCargoDaPlataforma }),
    saida: ok,
  }),
  trocarCargoDoAdmin: contrato({
    metodo: "PUT",
    caminho: "/api/v1/plataforma/administradores/:usuarioId",
    parametros: z.object({ usuarioId: z.uuid() }),
    entrada: z.object({ cargo: chaveDoCargoDaPlataforma }),
    saida: ok,
  }),
  removerAdmin: contrato({
    metodo: "DELETE",
    caminho: "/api/v1/plataforma/administradores/:usuarioId",
    parametros: z.object({ usuarioId: z.uuid() }),
    saida: ok,
  }),
  /** Cargos da equipe da Plataforma (`temTudo` = Super Admin; `usuarios` = quantos estão nele). */
  listarCargosDaPlataforma: contrato({
    metodo: "GET",
    caminho: "/api/v1/plataforma/cargos",
    saida: z.object({ cargos: z.array(cargo) }),
  }),
  criarCargoDaPlataforma: contrato({
    metodo: "POST",
    caminho: "/api/v1/plataforma/cargos",
    entrada: z.object({
      chave: chaveDeCadastro,
      rotulo: rotuloDoCargo,
      permissoes: listaDePermissoes,
    }),
    saida: ok,
  }),
  alterarCargoDaPlataforma: contrato({
    metodo: "PUT",
    caminho: "/api/v1/plataforma/cargos/:chave",
    parametros: parametroChave,
    entrada: z.object({ rotulo: rotuloDoCargo, permissoes: listaDePermissoes }),
    saida: ok,
  }),
  excluirCargoDaPlataforma: contrato({
    metodo: "DELETE",
    caminho: "/api/v1/plataforma/cargos/:chave",
    parametros: parametroChave,
    saida: ok,
  }),
} as const;
