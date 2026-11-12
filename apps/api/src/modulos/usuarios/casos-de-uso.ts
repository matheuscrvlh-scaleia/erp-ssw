import { type ExcecaoDePermissao } from "@erp/dominio/acesso";
import {
  type AlvoDoLogin,
  exigirPodeAjustarExcecoes,
  exigirPodeAlterarLogin,
  exigirPodeMexerEmSuperAdmin,
  exigirPodeMudarAtivo,
  validarExcecoes,
} from "@erp/dominio/administracao";
import { mudancaParaAuditoria, type Registro } from "@erp/dominio/auditoria";
import { ErroDeNegocio } from "@erp/dominio/erros";
import { ehPermissao } from "@erp/shared/acesso/permissoes";
import {
  type ExcecaoDePermissaoGravada,
  type NovoUsuario,
  type UsuarioDaEmpresa,
} from "@erp/shared/contratos/admin";

import { conflito, naoEncontrado } from "../../http/erros";
import { gerarTokenOpaco, hashDoToken } from "../../infra/aleatorio";
import { type Correio } from "../../infra/correio";
import { type Executor } from "../../infra/repositorios";
import { type ServicoDeSenhas } from "../../infra/senhas";
import { type Ator, type RepositorioAuditoria } from "../auditoria/auditoria";
import { type RepositorioAuth } from "../auth/casos-de-uso";
import { emailDeConvite } from "../auth/emails";

export interface ContaGravada {
  id: string;
  email: string;
  nome: string | null;
  ativo: boolean;
  temSenha: boolean;
}

/** Vínculo com a empresa: o cargo (`papel`) e se está ativo. */
export interface VinculoGravado {
  papel: string | null;
  ativo: boolean;
}

export interface UsuarioListado extends VinculoGravado {
  id: string;
  nome: string | null;
  email: string;
  temSenha: boolean;
  contaAtiva: boolean;
}

export interface RepositorioUsuarios {
  /** Vínculos da empresa (ativos ou não) com a conta, na ordem de criação da conta. */
  listar(empresaId: string): Promise<UsuarioListado[]>;
  /** Exceções de permissão ("Sim"/"Não") dos usuários da empresa. */
  excecoes(empresaId: string): Promise<(ExcecaoDePermissao & { usuarioId: string })[]>;
  contaPorEmail(email: string): Promise<ContaGravada | null>;
  conta(usuarioId: string): Promise<ContaGravada | null>;
  vinculo(empresaId: string, usuarioId: string): Promise<VinculoGravado | null>;
  /**
   * Vínculos da pessoa em todas as empresas. Só tem sentido num executor de Plataforma: com o
   * contexto da empresa, a RLS esconderia os vínculos das outras.
   */
  vinculosEmTodasAsEmpresas(
    usuarioId: string,
  ): Promise<{ empresaId: string; papel: string | null }[]>;
  existeCargo(empresaId: string, chave: string): Promise<boolean>;
  criarConta(conta: {
    email: string;
    nome: string;
    senhaHash: string | null;
    empresaPreferidaId: string;
  }): Promise<string>;
  alterarConta(
    usuarioId: string,
    dados: { nome: string; email: string; ativo: boolean },
  ): Promise<void>;
  /** Insere ou atualiza o vínculo; `criado_por` só no insert. */
  gravarVinculo(
    empresaId: string,
    usuarioId: string,
    vinculo: VinculoGravado,
    criadoPor: string,
  ): Promise<void>;
  /** A empresa vira a preferida do próximo login se a pessoa ainda não tem uma. */
  definirPreferidaSeVazia(usuarioId: string, empresaId: string): Promise<void>;
  trocarExcecoes(
    empresaId: string,
    usuarioId: string,
    excecoes: readonly ExcecaoDePermissao[],
    criadoPor: string,
  ): Promise<void>;
}

/** Validade do link de convite. */
export const VALIDADE_CONVITE_HORAS = 72;

export interface DependenciasUsuarios {
  correio: Correio;
  senhas: ServicoDeSenhas;
  /** Origem pública do ERP (Plataforma › Integrações › Domínio) para os links dos e-mails. */
  webUrl: () => Promise<string>;
  agora: () => Date;
}

/** Empresa em que se opera e quem opera (papel na empresa, se é da Plataforma). */
export interface ContextoUsuarios {
  empresaId: string;
  empresaNome: string;
  papel: string | null;
  plataforma: boolean;
}

type Db = Executor<"usuarios" | "auth" | "auditoria">;
/** Leitura sem o filtro da empresa (contexto de Plataforma), só para conferir a pessoa inteira. */
type Global = Executor<"usuarios" | "acesso">;

const naoPertence = () => naoEncontrado("Usuário não pertence à empresa ativa.");

async function exigirCargo(
  usuarios: RepositorioUsuarios,
  empresaId: string,
  papel: string | null,
): Promise<void> {
  if (papel && !(await usuarios.existeCargo(empresaId, papel))) {
    throw new ErroDeNegocio("ENTRADA_INVALIDA", "Cargo inexistente");
  }
}

function linkDeConvite(webUrl: string, token: string): string {
  const link = new URL("/aceitar-convite", webUrl);
  link.searchParams.set("token", token);
  return link.href;
}

/** Grava o token do convite (invalidando os anteriores) e devolve o link para o e-mail. */
async function emitirConvite(
  deps: DependenciasUsuarios,
  auth: RepositorioAuth,
  usuarioId: string,
): Promise<string> {
  const token = gerarTokenOpaco();
  const agora = deps.agora();
  await auth.emitirTokenSenha(
    {
      usuarioId,
      tipo: "convite",
      tokenHash: hashDoToken(token),
      expiraEm: new Date(agora.getTime() + VALIDADE_CONVITE_HORAS * 3_600_000),
    },
    agora,
  );
  return linkDeConvite(await deps.webUrl(), token);
}

/** Só as exceções de permissões do catálogo (uma tela que saiu do catálogo não aparece). */
function paraContrato(e: ExcecaoDePermissao): ExcecaoDePermissaoGravada[] {
  return ehPermissao(e.permissao) ? [{ permissao: e.permissao, efeito: e.efeito }] : [];
}

/**
 * Usuários da empresa com o cargo e as exceções de permissão. Ativo = conta ativa e vínculo ativo.
 * origem: listUsers (users.functions.ts, sistema atual)
 */
export async function listarUsuarios(
  db: Executor<"usuarios">,
  empresaId: string,
): Promise<UsuarioDaEmpresa[]> {
  return db(async ({ usuarios }) => {
    const [linhas, excecoes] = [
      await usuarios.listar(empresaId),
      await usuarios.excecoes(empresaId),
    ];
    return linhas.map((l) => ({
      id: l.id,
      nome: l.nome,
      email: l.email,
      papel: l.papel,
      ativo: l.contaAtiva && l.ativo,
      temSenha: l.temSenha,
      excecoes: excecoes.filter((e) => e.usuarioId === l.id).flatMap(paraContrato),
    }));
  });
}

/**
 * Conta nova na empresa, tudo numa transação (decisão Q36): conta, vínculo com o cargo (empresa
 * preferida), convite e registro em Logs. Exceções de permissão vêm depois, no "Permissões". O e-mail sai dentro da transação: se não sair, nada fica
 * gravado. Convite: a pessoa cria a senha pelo link (Q33). Com senha: grava argon2id.
 * origem: criarUsuario (criar-usuario.server.ts, sistema atual)
 */
async function criarConta(
  deps: DependenciasUsuarios,
  db: Db,
  ctx: ContextoUsuarios,
  ator: Ator,
  entrada: NovoUsuario,
): Promise<string> {
  exigirPodeMexerEmSuperAdmin({
    papelAntes: null,
    papelDepois: entrada.papel,
    papelDeQuemPede: ctx.papel,
    plataforma: ctx.plataforma,
  });
  const senhaHash = entrada.modo === "senha" ? await deps.senhas.gerarHash(entrada.senha) : null;

  return db(async ({ usuarios, auth, auditoria }) => {
    await exigirCargo(usuarios, ctx.empresaId, entrada.papel);
    const id = await usuarios.criarConta({
      email: entrada.email,
      nome: entrada.nome,
      senhaHash,
      empresaPreferidaId: ctx.empresaId,
    });
    await usuarios.gravarVinculo(
      ctx.empresaId,
      id,
      { papel: entrada.papel, ativo: true },
      ator.usuarioId,
    );
    const convite = entrada.modo === "convite";
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "convidar",
      entidade: "usuario",
      entidadeId: id,
      resumo: ctx.plataforma
        ? `${convite ? "Convite para" : "Conta com senha para"} ${entrada.email} (${ctx.empresaNome})`
        : convite
          ? `Convite para ${entrada.email}`
          : `Usuário ${entrada.email} criado com senha`,
      antes: null,
      depois: { email: entrada.email, papel: entrada.papel, modo: entrada.modo },
    });
    if (convite) {
      const link = await emitirConvite(deps, auth, id);
      await deps.correio.enviar(
        emailDeConvite({
          para: entrada.email,
          nome: entrada.nome,
          empresa: ctx.empresaNome,
          link,
          validadeHoras: VALIDADE_CONVITE_HORAS,
        }),
      );
    }
    return id;
  });
}

/**
 * Admin › Usuários: e-mail que já tem conta não é recriado. Na mesma empresa é repetido; em outra,
 * quem liga a pessoa a mais uma empresa é a Plataforma.
 */
export async function criarUsuario(
  deps: DependenciasUsuarios,
  db: Db,
  ctx: ContextoUsuarios,
  ator: Ator,
  entrada: NovoUsuario,
): Promise<{ id: string }> {
  const existente = await db(({ usuarios }) => usuarios.contaPorEmail(entrada.email));
  if (existente) {
    const jaNaEmpresa = await db(({ usuarios }) => usuarios.vinculo(ctx.empresaId, existente.id));
    throw conflito(
      jaNaEmpresa
        ? "Este e-mail já é usuário desta empresa."
        : "Este e-mail já tem conta no painel. Peça à equipe da Plataforma para ligá-lo a esta empresa.",
    );
  }
  return { id: await criarConta(deps, db, ctx, ator, entrada) };
}

/**
 * Plataforma › Empresa › Usuários: e-mail que já tem conta só ganha (ou reativa) o vínculo.
 * origem: convidarUsuarioEmpresa (plataforma.functions.ts, sistema atual)
 */
export async function convidarParaEmpresa(
  deps: DependenciasUsuarios,
  db: Db,
  ctx: ContextoUsuarios,
  ator: Ator,
  entrada: NovoUsuario,
): Promise<{ id: string; jaExistia: boolean }> {
  const existente = await db(({ usuarios }) => usuarios.contaPorEmail(entrada.email));
  if (!existente) {
    return { id: await criarConta(deps, db, ctx, ator, entrada), jaExistia: false };
  }
  await db(async ({ usuarios, auditoria }) => {
    await exigirCargo(usuarios, ctx.empresaId, entrada.papel);
    const antes = await usuarios.vinculo(ctx.empresaId, existente.id);
    const depois: VinculoGravado = { papel: entrada.papel, ativo: true };
    await usuarios.gravarVinculo(ctx.empresaId, existente.id, depois, ator.usuarioId);
    await usuarios.definirPreferidaSeVazia(existente.id, ctx.empresaId);
    await registrarVinculo(auditoria, ator, ctx.empresaId, existente.id, antes, depois);
  });
  return { id: existente.id, jaExistia: true };
}

function registroDoVinculo(v: VinculoGravado): Registro {
  return { papel: v.papel, ativo: v.ativo };
}

export async function registrarVinculo(
  auditoria: RepositorioAuditoria,
  ator: Ator,
  empresaId: string,
  usuarioId: string,
  antes: VinculoGravado | null,
  depois: VinculoGravado,
): Promise<void> {
  const mudanca = mudancaParaAuditoria({
    acao: antes ? "alterar" : "criar",
    antes: antes && registroDoVinculo(antes),
    depois: registroDoVinculo(depois),
  });
  if (!mudanca) return;
  await auditoria.registrar(ator, {
    empresaId,
    acao: antes ? "alterar" : "criar",
    entidade: "usuario_empresa",
    entidadeId: usuarioId,
    resumo: null,
    ...mudanca,
  });
}

/** Tudo o que a regra de login precisa saber da pessoa, lido sem o filtro da empresa. */
async function alvoDoLogin(
  global: Global,
  ctx: ContextoUsuarios,
  usuarioId: string,
): Promise<AlvoDoLogin> {
  return global(async ({ usuarios, acesso }) => {
    const vinculos = await usuarios.vinculosEmTodasAsEmpresas(usuarioId);
    return {
      plataforma: ctx.plataforma,
      papelDeQuemPede: ctx.papel,
      empresaAtiva: ctx.empresaId,
      empresasDoAlvo: vinculos.map((v) => v.empresaId),
      papeisDoAlvo: vinculos.map((v) => v.papel),
      alvoEhPlataforma: await acesso.ehAdminPlataforma(usuarioId),
    };
  });
}

function excecoesComoTexto(excecoes: readonly ExcecaoDePermissao[]): Registro {
  return Object.fromEntries(
    excecoes.map((e) => [e.permissao, e.efeito === "concede" ? "Sim" : "Não"]),
  );
}

/**
 * Edição pelo Admin: nome e e-mail só se a pessoa é só desta empresa (ou pela Plataforma); com um
 * vínculo só, a conta acompanha o ativo; o vínculo (cargo) é desta empresa.
 * origem: updateUser (users.functions.ts, sistema atual)
 */
export async function alterarUsuario(
  db: Db,
  global: Global,
  ctx: ContextoUsuarios,
  ator: Ator,
  usuarioId: string,
  entrada: {
    nome: string;
    email: string;
    papel: string;
    ativo: boolean;
  },
): Promise<void> {
  const alvo = await alvoDoLogin(global, ctx, usuarioId);

  await db(async ({ usuarios, auditoria }) => {
    const conta = await usuarios.conta(usuarioId);
    const antes = await usuarios.vinculo(ctx.empresaId, usuarioId);
    if (!conta || !antes) throw naoPertence();
    await exigirCargo(usuarios, ctx.empresaId, entrada.papel);
    exigirPodeMexerEmSuperAdmin({
      papelAntes: antes.papel,
      papelDepois: entrada.papel,
      papelDeQuemPede: ctx.papel,
      plataforma: ctx.plataforma,
    });

    const mudouEmail = conta.email !== entrada.email;
    const mudouNome = (conta.nome ?? "") !== entrada.nome;
    if (mudouEmail || mudouNome) {
      exigirPodeAlterarLogin(alvo, mudouEmail ? "e-mail" : "nome e e-mail");
      if (mudouEmail && (await usuarios.contaPorEmail(entrada.email))) {
        throw conflito("Já existe um usuário com este e-mail.");
      }
    }
    const umVinculoSo = alvo.empresasDoAlvo.length === 1;
    const contaDepois = {
      nome: entrada.nome,
      email: entrada.email,
      ativo: umVinculoSo ? entrada.ativo : conta.ativo,
    };
    if (entrada.ativo !== antes.ativo || contaDepois.ativo !== conta.ativo) {
      exigirPodeMudarAtivo(alvo);
    }
    if (mudouEmail || mudouNome || contaDepois.ativo !== conta.ativo) {
      await usuarios.alterarConta(usuarioId, contaDepois);
      const mudanca = mudancaParaAuditoria({
        acao: "alterar",
        antes: { nome: conta.nome, email: conta.email, ativo: conta.ativo },
        depois: contaDepois,
      });
      if (mudanca) {
        await auditoria.registrar(ator, {
          empresaId: ctx.empresaId,
          acao: "alterar",
          entidade: "usuario",
          entidadeId: usuarioId,
          resumo: null,
          ...mudanca,
        });
      }
    }

    const depois: VinculoGravado = { papel: entrada.papel, ativo: entrada.ativo };
    await usuarios.gravarVinculo(ctx.empresaId, usuarioId, depois, ator.usuarioId);
    await registrarVinculo(auditoria, ator, ctx.empresaId, usuarioId, antes, depois);
  });
}

/**
 * Exceções de permissão de uma pessoa ("Sim"/"Não"; sem linha = "Padrão", herda o cargo). Só o
 * admin da empresa (ou a Plataforma) ajusta, ninguém ajusta as próprias, e fica em Logs.
 * origem: set_member_permission_overrides (construgarden)
 */
export async function definirExcecoes(
  db: Db,
  ctx: ContextoUsuarios,
  ator: Ator,
  usuarioId: string,
  pedidas: readonly ExcecaoDePermissao[],
): Promise<void> {
  exigirPodeAjustarExcecoes({
    quemPede: ator.usuarioId,
    alvo: usuarioId,
    papelDeQuemPede: ctx.papel,
    plataforma: ctx.plataforma,
  });
  const excecoes = validarExcecoes(pedidas);
  await db(async ({ usuarios, auditoria }) => {
    if (!(await usuarios.vinculo(ctx.empresaId, usuarioId))) throw naoPertence();
    const antes = (await usuarios.excecoes(ctx.empresaId)).filter((e) => e.usuarioId === usuarioId);
    await usuarios.trocarExcecoes(ctx.empresaId, usuarioId, excecoes, ator.usuarioId);
    const mudanca = mudancaParaAuditoria({
      acao: "alterar",
      antes: excecoesComoTexto(antes),
      depois: {
        ...Object.fromEntries(antes.map((e) => [e.permissao, null])),
        ...excecoesComoTexto(excecoes),
      },
    });
    if (!mudanca) return;
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "alterar",
      entidade: "permissao_usuario",
      entidadeId: usuarioId,
      resumo: null,
      ...mudanca,
    });
  });
}

/**
 * Manda um link de convite novo (o anterior deixa de valer). Quem já criou a senha não precisa:
 * troca pela "Definir senha" ou pelo "Esqueci a senha". Fica registrado em Logs (Q32).
 * origem: resendInvite (users.functions.ts, sistema atual)
 */
export async function reenviarConvite(
  deps: DependenciasUsuarios,
  db: Db,
  ctx: ContextoUsuarios,
  ator: Ator,
  usuarioId: string,
): Promise<void> {
  await db(async ({ usuarios, auth, auditoria }) => {
    const conta = await usuarios.conta(usuarioId);
    if (!conta || !(await usuarios.vinculo(ctx.empresaId, usuarioId))) throw naoPertence();
    if (conta.temSenha) {
      throw conflito(
        "Este usuário já criou a senha. Para trocar, use “Definir senha” ou peça que ele use “Esqueci a senha”.",
      );
    }
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "reenviar_convite",
      entidade: "usuario",
      entidadeId: usuarioId,
      resumo: `Convite reenviado para ${conta.email}`,
      antes: null,
      depois: null,
    });
    const link = await emitirConvite(deps, auth, usuarioId);
    await deps.correio.enviar(
      emailDeConvite({
        para: conta.email,
        nome: conta.nome,
        empresa: ctx.empresaNome,
        link,
        validadeHoras: VALIDADE_CONVITE_HORAS,
      }),
    );
  });
}

/**
 * Senha definida pelo admin: mesmas regras do login de outra pessoa; derruba as sessões abertas
 * da pessoa e fica registrado em Logs sem o valor (Q32).
 * origem: setUserPassword (users.functions.ts, sistema atual)
 */
export async function definirSenha(
  deps: DependenciasUsuarios,
  db: Db,
  global: Global,
  ctx: ContextoUsuarios,
  ator: Ator,
  usuarioId: string,
  senha: string,
): Promise<void> {
  const pertence = await db(({ usuarios }) => usuarios.vinculo(ctx.empresaId, usuarioId));
  if (!pertence) throw naoPertence();
  exigirPodeAlterarLogin(await alvoDoLogin(global, ctx, usuarioId), "senha");
  const hash = await deps.senhas.gerarHash(senha);
  await db(async ({ auth, auditoria }) => {
    await auth.definirSenha(usuarioId, hash, null);
    await auth.revogarSessoesDoUsuario(usuarioId, "senha_redefinida", deps.agora());
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "definir_senha",
      entidade: "usuario",
      entidadeId: usuarioId,
      resumo: "Senha definida pelo administrador",
      antes: null,
      depois: null,
    });
  });
}
