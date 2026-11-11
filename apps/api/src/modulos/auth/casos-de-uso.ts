import { randomUUID } from "node:crypto";

import { CONTEXTO_VAZIO } from "@erp/db";
import {
  duracaoDoBloqueioMs,
  FALHAS_TOLERADAS_POR_CONTA,
  FALHAS_TOLERADAS_POR_IP,
  normalizarEmail,
} from "@erp/dominio/autenticacao";
import { ErroDeNegocio } from "@erp/dominio/erros";
import { type TokenEmitido } from "@erp/shared/contratos/auth";

import {
  muitasTentativas,
  naoAutenticado,
  naoEncontrado,
  semPermissao,
  sessaoExpirada,
} from "../../http/erros";
import { gerarTokenOpaco, hashDoToken } from "../../infra/aleatorio";
import { type Correio } from "../../infra/correio";
import { type IdentidadeGoogle } from "../../infra/google";
import { type LimitadorDeFalhas } from "../../infra/limitador";
import { type AlgoritmoSenha, type ServicoDeSenhas } from "../../infra/senhas";
import { type EmissorDeTokens, type SessaoDoToken } from "../../infra/tokens";
import { type ExecutorComContexto } from "../../repositorios";
import {
  carregarAcesso,
  type DependenciasAcesso,
  empresaDaSessao,
  lerIdentidade,
  vinculoVale,
} from "../acesso/casos-de-uso";
import { type Ator } from "../auditoria/auditoria";
import { emailDeRedefinicao } from "./emails";

export interface UsuarioParaLogin {
  id: string;
  email: string;
  nome: string | null;
  ativo: boolean;
  senhaHash: string | null;
  senhaAlgoritmo: AlgoritmoSenha | null;
  bloqueadoAte: Date | null;
}

export interface SessaoGravada {
  id: string;
  usuarioId: string;
  familiaId: string;
  empresaAtivaId: string | null;
  expiraEm: Date;
  substituidaEm: Date | null;
  revogadaEm: Date | null;
}

export interface NovaSessao {
  usuarioId: string;
  familiaId: string;
  tokenHash: string;
  empresaAtivaId: string | null;
  expiraEm: Date;
  ip: string | null;
  userAgent: string | null;
}

export type TipoTokenSenha = "redefinicao" | "convite";
type MotivoRevogacao = "logout" | "reuso_detectado" | "senha_redefinida";

export interface TokenSenhaGravado {
  id: string;
  usuarioId: string;
  usuarioEmail: string;
  expiraEm: Date;
  usadoEm: Date | null;
}

export interface RepositorioAuth {
  usuarioPorEmail(email: string): Promise<UsuarioParaLogin | null>;
  /** Soma uma falha seguida e devolve o total. */
  contarFalha(usuarioId: string): Promise<number>;
  bloquear(usuarioId: string, ate: Date): Promise<void>;
  /** Zera falhas e bloqueio, marca o último login e, se veio, regrava a senha em argon2id. */
  registrarEntrada(usuarioId: string, agora: Date, novoHash: string | null): Promise<void>;
  criarSessao(sessao: NovaSessao): Promise<void>;
  sessaoPorHash(tokenHash: string): Promise<SessaoGravada | null>;
  substituirSessao(sessaoId: string, agora: Date): Promise<void>;
  revogarFamilia(familiaId: string, motivo: MotivoRevogacao, agora: Date): Promise<void>;
  revogarSessoesDoUsuario(usuarioId: string, motivo: MotivoRevogacao, agora: Date): Promise<void>;
  trocarEmpresaDaFamilia(familiaId: string, empresaId: string): Promise<void>;
  definirEmpresaPreferida(usuarioId: string, empresaId: string): Promise<void>;
  /** Grava o token novo e invalida os anteriores do mesmo tipo ainda não usados. */
  emitirTokenSenha(
    novo: { usuarioId: string; tipo: TipoTokenSenha; tokenHash: string; expiraEm: Date },
    agora: Date,
  ): Promise<void>;
  tokenSenhaPorHash(tokenHash: string, tipo: TipoTokenSenha): Promise<TokenSenhaGravado | null>;
  /** Marca como usado só se ainda não foi (dois cliques no mesmo link: só um vale). */
  consumirTokenSenha(tokenId: string, agora: Date): Promise<boolean>;
  definirSenha(usuarioId: string, hash: string, nome: string | null): Promise<void>;
  usuarioPorIdentidade(provedor: "google", sujeito: string): Promise<string | null>;
  vincularIdentidade(
    usuarioId: string,
    provedor: "google",
    sujeito: string,
    email: string,
  ): Promise<void>;
  adminsDaEmpresa(empresaId: string): Promise<{ nome: string | null; email: string }[]>;
}

export interface DependenciasAuth {
  executar: ExecutorComContexto<"acesso" | "auth" | "auditoria">;
  senhas: ServicoDeSenhas;
  tokens: EmissorDeTokens;
  limitador: LimitadorDeFalhas;
  correio: Correio;
  agora: () => Date;
  refreshDias: number;
  /** Origem pública do ERP (Plataforma › Integrações › Domínio) para os links dos e-mails. */
  webUrl: () => Promise<string>;
  urlDoLogo: (caminho: string | null) => string | null;
}

export interface Origem {
  ip: string | null;
  userAgent: string | null;
}

export interface SessaoEmitida extends TokenEmitido {
  refresh: { token: string; expiraEm: Date };
}

/** Duas abas renovando juntas mandam o mesmo refresh: dentro desta janela não é ataque. */
export const JANELA_DE_RENOVACAO_CONCORRENTE_MS = 10_000;
const VALIDADE_REDEFINICAO_MS = 60 * 60_000;

const credenciaisInvalidas = () =>
  new ErroDeNegocio("NAO_AUTENTICADO", "E-mail ou senha incorretos.");

/** Conta desativada não entra nem renova a sessão (a senha já conferiu: não revela nada novo). */
const contaDesativada = () =>
  new ErroDeNegocio("SEM_PERMISSAO", "Sua conta foi desativada por um administrador.");

const linkInvalido = (tipo: TipoTokenSenha) =>
  new ErroDeNegocio(
    "ENTRADA_INVALIDA",
    tipo === "convite"
      ? "Convite inválido ou expirado. Peça um novo convite ao administrador da sua empresa."
      : "Link inválido ou expirado. Peça um novo em “Esqueci a senha”.",
  );

function depsDoAcesso(deps: DependenciasAuth): DependenciasAcesso {
  return { executar: deps.executar, agora: deps.agora, urlDoLogo: deps.urlDoLogo };
}

async function emitirAcesso(deps: DependenciasAuth, sessao: SessaoDoToken): Promise<TokenEmitido> {
  return {
    tokenAcesso: await deps.tokens.emitir(sessao),
    expiraEmSegundos: deps.tokens.validadeSegundos,
  };
}

/** Escolhe a empresa, grava a sessão (família nova) e registra o login na auditoria. */
async function abrirSessao(
  deps: DependenciasAuth,
  usuarioId: string,
  origem: Origem,
  novoHash: string | null,
): Promise<SessaoEmitida> {
  const { usuario, adminPlataforma, vinculos } = await lerIdentidade(depsDoAcesso(deps), usuarioId);
  if (!usuario) throw naoAutenticado();
  if (!usuario.ativo) throw contaDesativada();
  const empresaId = empresaDaSessao(usuario.empresaPreferidaId, adminPlataforma, vinculos);
  const agora = deps.agora();
  const refresh = gerarTokenOpaco();
  const familiaId = randomUUID();
  const expiraEm = new Date(agora.getTime() + deps.refreshDias * 86_400_000);
  const ator: Ator = { usuarioId, email: usuario.email, plataforma: adminPlataforma, ...origem };

  await deps.executar(
    { empresaId, usuarioId, plataforma: adminPlataforma },
    async ({ auth, auditoria }) => {
      await auth.registrarEntrada(usuarioId, agora, novoHash);
      await auth.criarSessao({
        usuarioId,
        familiaId,
        tokenHash: hashDoToken(refresh),
        empresaAtivaId: empresaId,
        expiraEm,
        ...origem,
      });
      await auditoria.registrar(ator, {
        empresaId,
        acao: "login",
        entidade: "usuario",
        entidadeId: usuarioId,
        resumo: "Entrou no sistema",
        antes: null,
        depois: null,
      });
    },
  );
  return {
    ...(await emitirAcesso(deps, { usuarioId, empresaId, familiaId })),
    refresh: { token: refresh, expiraEm },
  };
}

async function exigirIpLiberado(deps: DependenciasAuth, chaveIp: string): Promise<void> {
  if ((await deps.limitador.bloqueioRestanteMs(chaveIp)) > 0) throw muitasTentativas();
}

/**
 * Login com e-mail e senha. A resposta de erro é a mesma para e-mail inexistente e senha errada,
 * e o bloqueio progressivo vale para os dois (conta no banco; e-mail inexistente e IP no Redis).
 */
export async function entrar(
  deps: DependenciasAuth,
  entrada: { email: string; senha: string },
  origem: Origem,
): Promise<SessaoEmitida> {
  const email = normalizarEmail(entrada.email);
  const chaveIp = `ip:${origem.ip ?? "desconhecido"}`;
  await exigirIpLiberado(deps, chaveIp);

  const usuario = await deps.executar(CONTEXTO_VAZIO, ({ auth }) => auth.usuarioPorEmail(email));
  if (!usuario?.senhaHash || !usuario.senhaAlgoritmo) {
    const chaveEmail = `email:${hashDoToken(email)}`;
    if ((await deps.limitador.bloqueioRestanteMs(chaveEmail)) > 0) throw muitasTentativas();
    await deps.senhas.gastarTempo(entrada.senha);
    await deps.limitador.registrarFalha(chaveEmail, FALHAS_TOLERADAS_POR_CONTA);
    await deps.limitador.registrarFalha(chaveIp, FALHAS_TOLERADAS_POR_IP);
    throw credenciaisInvalidas();
  }

  const agora = deps.agora();
  if (usuario.bloqueadoAte && usuario.bloqueadoAte > agora) throw muitasTentativas();

  if (!(await deps.senhas.conferir(entrada.senha, usuario.senhaHash, usuario.senhaAlgoritmo))) {
    await deps.executar(CONTEXTO_VAZIO, async ({ auth }) => {
      const duracao = duracaoDoBloqueioMs(await auth.contarFalha(usuario.id));
      if (duracao > 0) await auth.bloquear(usuario.id, new Date(agora.getTime() + duracao));
    });
    await deps.limitador.registrarFalha(chaveIp, FALHAS_TOLERADAS_POR_IP);
    throw credenciaisInvalidas();
  }

  // Senha do sistema antigo (bcrypt): confere e regrava em argon2id sem o usuário perceber.
  const novoHash =
    usuario.senhaAlgoritmo === "bcrypt" ? await deps.senhas.gerarHash(entrada.senha) : null;
  return abrirSessao(deps, usuario.id, origem, novoHash);
}

/**
 * Login pelo Google: só entra quem já é usuário (cadastro fechado). Na primeira vez liga a conta
 * Google ao usuário pelo e-mail verificado; depois, pelo `sub`. Devolve nulo se não tem acesso.
 */
export async function entrarComGoogle(
  deps: DependenciasAuth,
  identidade: IdentidadeGoogle,
  origem: Origem,
): Promise<SessaoEmitida | null> {
  if (!identidade.emailVerificado) return null;
  const email = normalizarEmail(identidade.email);
  const usuarioId = await deps.executar(CONTEXTO_VAZIO, async ({ auth }) => {
    const ligado = await auth.usuarioPorIdentidade("google", identidade.sujeito);
    if (ligado) return ligado;
    const usuario = await auth.usuarioPorEmail(email);
    if (!usuario) return null;
    await auth.vincularIdentidade(usuario.id, "google", identidade.sujeito, email);
    return usuario.id;
  });
  return usuarioId ? abrirSessao(deps, usuarioId, origem, null) : null;
}

type SituacaoDoRefresh = { tipo: "valida"; sessao: SessaoGravada } | { tipo: "invalida" };

/**
 * Troca o refresh por um novo (rotação) e emite access token. Refresh já trocado reaparecendo
 * fora da janela de concorrência = reuso (token vazado): a família inteira é revogada.
 */
export async function renovar(
  deps: DependenciasAuth,
  refreshToken: string,
  origem: Origem,
): Promise<SessaoEmitida> {
  const agora = deps.agora();
  const situacao = await deps.executar(
    CONTEXTO_VAZIO,
    async ({ auth }): Promise<SituacaoDoRefresh> => {
      const sessao = await auth.sessaoPorHash(hashDoToken(refreshToken));
      if (!sessao || sessao.revogadaEm || sessao.expiraEm <= agora) return { tipo: "invalida" };
      const reuso =
        sessao.substituidaEm !== null &&
        agora.getTime() - sessao.substituidaEm.getTime() > JANELA_DE_RENOVACAO_CONCORRENTE_MS;
      if (reuso) {
        // Retorna (não lança) para a revogação ser gravada: lançar desfaria a transação.
        await auth.revogarFamilia(sessao.familiaId, "reuso_detectado", agora);
        return { tipo: "invalida" };
      }
      return { tipo: "valida", sessao };
    },
  );
  if (situacao.tipo === "invalida") throw sessaoExpirada();
  const { sessao } = situacao;

  const { usuario, adminPlataforma, vinculos } = await lerIdentidade(
    depsDoAcesso(deps),
    sessao.usuarioId,
  );
  if (!usuario?.ativo) throw sessaoExpirada();
  const empresaId = empresaDaSessao(sessao.empresaAtivaId, adminPlataforma, vinculos);
  const novo = gerarTokenOpaco();
  const expiraEm = new Date(agora.getTime() + deps.refreshDias * 86_400_000);

  await deps.executar(CONTEXTO_VAZIO, async ({ auth }) => {
    if (!sessao.substituidaEm) await auth.substituirSessao(sessao.id, agora);
    await auth.criarSessao({
      usuarioId: sessao.usuarioId,
      familiaId: sessao.familiaId,
      tokenHash: hashDoToken(novo),
      empresaAtivaId: empresaId,
      expiraEm,
      ...origem,
    });
  });
  return {
    ...(await emitirAcesso(deps, {
      usuarioId: sessao.usuarioId,
      empresaId,
      familiaId: sessao.familiaId,
    })),
    refresh: { token: novo, expiraEm },
  };
}

/** Logout: revoga a família do refresh (todas as rotações daquele login). */
export async function sair(deps: DependenciasAuth, refreshToken: string | undefined) {
  if (!refreshToken) return;
  await deps.executar(CONTEXTO_VAZIO, async ({ auth }) => {
    const sessao = await auth.sessaoPorHash(hashDoToken(refreshToken));
    if (sessao) await auth.revogarFamilia(sessao.familiaId, "logout", deps.agora());
  });
}

/**
 * Troca a empresa ativa da sessão (valida o vínculo, registra na auditoria) e reemite o access
 * token com a empresa nova.
 * origem: trocar_empresa_ativa (função SQL, sistema atual)
 */
export async function trocarEmpresa(
  deps: DependenciasAuth,
  sessao: SessaoDoToken,
  empresaId: string,
  origem: Origem,
): Promise<TokenEmitido> {
  const { usuarioId, familiaId } = sessao;
  const { usuario, adminPlataforma, vinculos } = await lerIdentidade(depsDoAcesso(deps), usuarioId);
  if (!usuario) throw naoAutenticado();
  const temVinculo = vinculos.some((v) => v.empresaId === empresaId && vinculoVale(v));
  if (!adminPlataforma && !temVinculo) throw semPermissao("Você não tem acesso a esta empresa.");

  await deps.executar(
    { empresaId, usuarioId, plataforma: adminPlataforma },
    async ({ acesso, auth, auditoria }) => {
      if (!(await acesso.empresa(empresaId))) throw naoEncontrado("Empresa não encontrada.");
      await auth.trocarEmpresaDaFamilia(familiaId, empresaId);
      await auth.definirEmpresaPreferida(usuarioId, empresaId);
      await auditoria.registrar(
        { usuarioId, email: usuario.email, plataforma: adminPlataforma, ...origem },
        {
          empresaId,
          acao: "trocar_empresa",
          entidade: "empresa",
          entidadeId: empresaId,
          resumo: null,
          antes: { empresa_id: sessao.empresaId },
          depois: { empresa_id: empresaId },
        },
      );
    },
  );
  return emitirAcesso(deps, { usuarioId, empresaId, familiaId });
}

/**
 * "Esqueci a senha": se o e-mail é de um usuário ativo, manda o link de uso único. Quem chama
 * responde sempre a mesma coisa e não espera este envio (o tempo não revela se o e-mail existe).
 */
export async function pedirRedefinicao(deps: DependenciasAuth, emailInformado: string) {
  const email = normalizarEmail(emailInformado);
  const usuario = await deps.executar(CONTEXTO_VAZIO, ({ auth }) => auth.usuarioPorEmail(email));
  if (!usuario?.ativo) return;
  const token = gerarTokenOpaco();
  const agora = deps.agora();
  await deps.executar(CONTEXTO_VAZIO, ({ auth }) =>
    auth.emitirTokenSenha(
      {
        usuarioId: usuario.id,
        tipo: "redefinicao",
        tokenHash: hashDoToken(token),
        expiraEm: new Date(agora.getTime() + VALIDADE_REDEFINICAO_MS),
      },
      agora,
    ),
  );
  const link = new URL("/redefinir-senha", await deps.webUrl());
  link.searchParams.set("token", token);
  await deps.correio.enviar(
    emailDeRedefinicao({ para: usuario.email, nome: usuario.nome, link: link.href }),
  );
}

/**
 * Consome um token de senha (redefinição ou convite) e grava a senha nova. Na redefinição,
 * derruba todas as sessões abertas.
 */
export async function definirSenhaPorToken(
  deps: DependenciasAuth,
  entrada: { tipo: TipoTokenSenha; token: string; senha: string; nome: string | null },
  origem: Origem,
): Promise<void> {
  const agora = deps.agora();
  const registro = await deps.executar(CONTEXTO_VAZIO, ({ auth }) =>
    auth.tokenSenhaPorHash(hashDoToken(entrada.token), entrada.tipo),
  );
  if (!registro || registro.usadoEm || registro.expiraEm <= agora) {
    throw linkInvalido(entrada.tipo);
  }
  const hash = await deps.senhas.gerarHash(entrada.senha);
  const { usuarioId } = registro;

  await deps.executar(
    { empresaId: null, usuarioId, plataforma: false },
    async ({ auth, auditoria }) => {
      if (!(await auth.consumirTokenSenha(registro.id, agora))) throw linkInvalido(entrada.tipo);
      await auth.definirSenha(usuarioId, hash, entrada.nome);
      if (entrada.tipo === "redefinicao") {
        await auth.revogarSessoesDoUsuario(usuarioId, "senha_redefinida", agora);
      }
      await auditoria.registrar(
        { usuarioId, email: registro.usuarioEmail, plataforma: false, ...origem },
        {
          empresaId: null,
          acao: entrada.tipo === "convite" ? "aceitar_convite" : "redefinir_senha",
          entidade: "usuario",
          entidadeId: usuarioId,
          resumo: null,
          antes: null,
          depois: null,
        },
      );
    },
  );
}

/** Tela "Sem acesso": quem é o usuário, o nível e quem na empresa pode liberar. */
export async function ajudaDeAcesso(deps: DependenciasAuth, sessao: SessaoDoToken) {
  const acesso = await carregarAcesso(depsDoAcesso(deps), sessao);
  const empresaId = acesso.empresa?.id ?? null;
  const admins = empresaId
    ? await deps.executar(
        { empresaId, usuarioId: sessao.usuarioId, plataforma: acesso.adminPlataforma },
        ({ auth }) => auth.adminsDaEmpresa(empresaId),
      )
    : [];
  return {
    ativo: acesso.ativo,
    nome: acesso.usuario.nome,
    email: acesso.usuario.email,
    papelRotulo: acesso.papelRotulo,
    admins,
  };
}
