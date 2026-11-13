import { PERMISSOES } from "@erp/shared/access/permissions";
import { TELAS } from "@erp/shared/access/screens";
import { contrato } from "@erp/shared/contract";
import { z } from "@erp/shared/zod";

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
  /** Permissões efetivas (`tela.acao`): o front esconde o que não pode; a API confere de novo. */
  permissoes: z.array(z.enum(PERMISSOES)),
  /** Telas com "Ver" (menu e guarda de rota). */
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
