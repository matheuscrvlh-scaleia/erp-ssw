import { SETORES } from "../acesso/papeis";
import { TELAS } from "../acesso/telas";
import { contrato } from "../contrato";
import { z } from "../zod";

/** Senha nova (redefinição e convite). O login aceita a senha antiga como está. */
export const SENHA_MINIMO = 8;
const senhaNova = z
  .string()
  .min(SENHA_MINIMO, `A senha precisa ter pelo menos ${SENHA_MINIMO} caracteres.`)
  .max(200);

const email = z.email("Informe um e-mail válido.").max(320);

const tokenEmitido = z.object({
  tokenAcesso: z.string(),
  expiraEmSegundos: z.number().int().positive(),
});

export type TokenEmitido = z.infer<typeof tokenEmitido>;

const ok = z.object({ ok: z.literal(true) });

export const empresaAtiva = z.object({
  id: z.uuid(),
  nome: z.string(),
  nomeCurto: z.string(),
  logoUrl: z.string().nullable(),
  corPrimaria: z.string(),
  corDestaque: z.string(),
  slogan: z.string().nullable(),
  fuso: z.string(),
});

export type EmpresaAtiva = z.infer<typeof empresaAtiva>;

export const acesso = z.object({
  usuario: z.object({ id: z.uuid(), email: z.string(), nome: z.string().nullable() }),
  ativo: z.boolean(),
  papel: z.string().nullable(),
  papelRotulo: z.string().nullable(),
  setor: z.enum(SETORES).nullable(),
  telas: z.array(z.enum(TELAS)),
  empresa: empresaAtiva.nullable(),
  empresas: z.array(z.object({ id: z.uuid(), nome: z.string() })),
  modulos: z.array(z.string()),
  telasBloqueadas: z.array(
    z.object({ tela: z.enum(TELAS), modulo: z.string(), moduloNome: z.string() }),
  ),
  adminPlataforma: z.boolean(),
});

export type Acesso = z.infer<typeof acesso>;

export const contratosAuth = {
  provedores: contrato({
    metodo: "GET",
    caminho: "/api/v1/auth/provedores",
    saida: z.object({ google: z.boolean() }),
  }),
  login: contrato({
    metodo: "POST",
    caminho: "/api/v1/auth/login",
    entrada: z.object({ email, senha: z.string().min(1, "Informe a senha.").max(200) }),
    saida: tokenEmitido,
  }),
  renovar: contrato({
    metodo: "POST",
    caminho: "/api/v1/auth/refresh",
    saida: tokenEmitido,
  }),
  sair: contrato({
    metodo: "POST",
    caminho: "/api/v1/auth/logout",
    saida: ok,
  }),
  eu: contrato({
    metodo: "GET",
    caminho: "/api/v1/auth/me",
    saida: acesso,
  }),
  trocarEmpresa: contrato({
    metodo: "POST",
    caminho: "/api/v1/auth/empresa-ativa",
    entrada: z.object({ empresaId: z.uuid() }),
    saida: tokenEmitido,
  }),
  ajudaAcesso: contrato({
    metodo: "GET",
    caminho: "/api/v1/auth/ajuda-acesso",
    saida: z.object({
      ativo: z.boolean(),
      nome: z.string().nullable(),
      email: z.string(),
      papelRotulo: z.string().nullable(),
      admins: z.array(z.object({ nome: z.string().nullable(), email: z.string() })),
    }),
  }),
  esqueciSenha: contrato({
    metodo: "POST",
    caminho: "/api/v1/auth/senha/esqueci",
    entrada: z.object({ email }),
    saida: z.object({ mensagem: z.string() }),
  }),
  redefinirSenha: contrato({
    metodo: "POST",
    caminho: "/api/v1/auth/senha/redefinir",
    entrada: z.object({ token: z.string().min(20).max(200), senha: senhaNova }),
    saida: ok,
  }),
  aceitarConvite: contrato({
    metodo: "POST",
    caminho: "/api/v1/auth/convite/aceitar",
    entrada: z.object({
      token: z.string().min(20).max(200),
      senha: senhaNova,
      nome: z.string().trim().min(2).max(120).optional(),
    }),
    saida: ok,
  }),
} as const;

/** Rotas de redirecionamento do Google (não são JSON: o navegador navega até elas). */
export const CAMINHOS_GOOGLE = {
  iniciar: "/api/v1/auth/google",
  retorno: "/api/v1/auth/google/retorno",
} as const;

/** Motivos que a API devolve em `/login?erro=` quando o login pelo Google não fecha. */
export const ERROS_LOGIN_GOOGLE = {
  sem_conta:
    "Este e-mail do Google não tem acesso. Peça um convite ao administrador da sua empresa.",
  falhou: "Não foi possível entrar com o Google. Tente de novo.",
} as const;
