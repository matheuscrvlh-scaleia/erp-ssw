import { contrato } from "../contrato";
import { ehDataIso } from "../datas";
import { STATUS_EMPRESA, TIPOS_INTEGRACAO } from "../plataforma";
import { z } from "../zod";
import { cargo, departamentoDaEmpresa, emailDeUsuario, novoUsuario } from "./admin";

/*
 * Plataforma (equipe Scale IA): empresas, marca, módulos, usuários por empresa, integrações e
 * segredos, administradores. Tudo exige admin da Plataforma.
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

export const vinculoNaEmpresa = z.object({
  usuarioId: z.uuid(),
  nome: z.string().nullable(),
  email: z.string(),
  papel: z.string().nullable(),
  departamento: z.string().nullable(),
  ativo: z.boolean(),
  criadoEm: z.iso.datetime(),
  totalEmpresas: z.number().int(),
  adminPlataforma: z.boolean(),
});
export type VinculoNaEmpresa = z.infer<typeof vinculoNaEmpresa>;

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
});
export type IntegracaoDaEmpresa = z.infer<typeof integracaoDaEmpresa>;

export const adminDaPlataforma = z.object({
  usuarioId: z.uuid(),
  nome: z.string().nullable(),
  email: z.string(),
  criadoEm: z.iso.datetime(),
});
export type AdminDaPlataforma = z.infer<typeof adminDaPlataforma>;

const parametroTipo = z.object({ id: z.uuid(), tipo: z.enum(TIPOS_INTEGRACAO) });

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
  listarUsuarios: contrato({
    metodo: "GET",
    caminho: "/api/v1/plataforma/empresas/:id/usuarios",
    parametros: parametroEmpresa,
    saida: z.object({ usuarios: z.array(vinculoNaEmpresa) }),
  }),
  convidarUsuario: contrato({
    metodo: "POST",
    caminho: "/api/v1/plataforma/empresas/:id/usuarios",
    parametros: parametroEmpresa,
    entrada: novoUsuario,
    saida: z.object({ id: z.uuid(), jaExistia: z.boolean() }),
  }),
  salvarVinculo: contrato({
    metodo: "PUT",
    caminho: "/api/v1/plataforma/empresas/:id/usuarios/:usuarioId",
    parametros: z.object({ id: z.uuid(), usuarioId: z.uuid() }),
    entrada: z.object({
      papel: z.string().trim().min(1).max(64).nullable(),
      departamento: z.string().trim().min(1).max(40).nullable(),
      ativo: z.boolean(),
    }),
    saida: ok,
  }),
  /** Cargos e departamentos da empresa editada (não da empresa ativa de quem opera — Q29). */
  cadastrosDaEmpresa: contrato({
    metodo: "GET",
    caminho: "/api/v1/plataforma/empresas/:id/cadastros",
    parametros: parametroEmpresa,
    saida: z.object({
      cargos: z.array(cargo),
      departamentos: z.array(departamentoDaEmpresa),
    }),
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
  listarAdmins: contrato({
    metodo: "GET",
    caminho: "/api/v1/plataforma/administradores",
    saida: z.object({ admins: z.array(adminDaPlataforma) }),
  }),
  adicionarAdmin: contrato({
    metodo: "POST",
    caminho: "/api/v1/plataforma/administradores",
    entrada: z.object({ email: emailDeUsuario }),
    saida: ok,
  }),
  removerAdmin: contrato({
    metodo: "DELETE",
    caminho: "/api/v1/plataforma/administradores/:usuarioId",
    parametros: z.object({ usuarioId: z.uuid() }),
    saida: ok,
  }),
} as const;
