/**
 * Ingestão SSW na API: faixa de saúde da SSW API, Admin › Ingestão SSW (BI2 0017, credenciais,
 * eventos do webhook) e Plataforma › Diagnóstico SSW. O trabalho é do worker-ssw (ADR 0012): aqui
 * se lê o que ele gravou no banco, grava credenciais e pede execuções pelo HTTP interno dele (a
 * auditoria fica no ERP, gravada antes do pedido).
 * Especificação: docs/regras/06-ingestao.md §3.15–§3.18, §5.
 */
import { createHash } from "node:crypto";

import { contextoDoSegredo, type SegredoCifrado } from "@erp/db/secrets";
import {
  type SaudeDaIntegracaoSsw,
  saudeDaIntegracaoSsw,
  TTL_DO_TOKEN_MS,
} from "@erp/domain/ingestion/ssw-api";
import { type EntradaDe } from "@erp/shared/contract";
import {
  type ContagemWebhook,
  type contratosIngestaoSsw,
  type ResultadoDoTesteSsw,
  resultadoDoTesteSsw,
  type SincronizacaoBi2,
  type StatusDoJob,
} from "@erp/shared/contracts/ssw-ingestion";
import { type IntegracaoDaIngestao, JOBS_DE_INGESTAO } from "@erp/shared/ingestion";

import { type ClienteWorkerSsw, exigirWorkerSsw } from "../../infra/worker-ssw";
import { type Ator } from "../audit/audit.service";
import { conflito, naoEncontrado } from "../errors";
import { type Executor } from "../repositories";

// --- Portas -----------------------------------------------------------------------------------

export interface IntegracaoLida {
  ativo: boolean;
  parametros: Record<string, unknown>;
  temSegredo: boolean;
  segredo: SegredoCifrado | null;
  /** Segredo trocado por último (webhook): o reprocesso aceita eventos assinados com ele. */
  segredoAnterior: SegredoCifrado | null;
  ultimoTesteEm: Date | null;
  ultimoTesteOk: boolean | null;
  ultimoTesteMsg: string | null;
  atualizadoEm: Date | null;
}

export interface EventoLido {
  id: string;
  recebidoEm: Date;
  statusHttp: number;
  autenticado: boolean;
  motivoRejeicao: string | null;
  erroProcessamento: string | null;
  cteId: string | null;
  numeroCte: string | null;
  temPayload: boolean;
  /** SHA-256 dos candidatos a token da chamada (nunca o token). */
  tokenSha256: string[] | null;
}

export interface SincronizacaoLida extends Omit<SincronizacaoBi2, "iniciadoEm" | "finalizadoEm"> {
  iniciadoEm: Date;
  finalizadoEm: Date | null;
}

/** Saúde da SSW API com o instante do token em ISO (a faixa e o Painel da Plataforma). */
type SaudeSsw = Omit<SaudeDaIntegracaoSsw, "tokenAtualizadoEm"> & {
  tokenAtualizadoEm: string | null;
};

export interface AtualizacaoDosDados {
  atualizadoEm: Date | null;
  /** Só para a Plataforma; nulo para os demais. */
  xmlAguardando: { pendentes: number; expirados: number } | null;
}

export interface RodadaDoBi2 {
  enfileirado: boolean;
  /** O job não terminou a tempo. */
  pendente: boolean;
  resultado: SincronizacaoLida | null;
}

export interface CredenciaisDaSsw {
  ativo: boolean;
  dominio: string;
  usuario: string;
  cnpjEdi: string;
  temSenha: boolean;
  tokenStatus: "valido" | "expirado" | "ausente";
  tokenAtualizadoEm: Date | null;
  tokenExpiraEm: Date | null;
  ttlHoras: number;
  atualizadoEm: Date | null;
  ultimaVerificacao: { em: Date; ok: boolean; mensagem: string | null } | null;
}

export interface EventosDoWebhook {
  ultimaAtividade: Date | null;
  eventos: EventoLido[];
}

export interface DiagnosticoDaSsw {
  /** `false` = worker-ssw não configurado ou fora. */
  filasDisponiveis: boolean;
  jobs: StatusDoJob[];
  sincronizacoes: SincronizacaoLida[];
  webhook: {
    ultimaAtividade: Date | null;
    ultimas24h: ContagemWebhook;
    ultimos7d: ContagemWebhook;
  };
  orfaos: {
    webhookSemVinculo7d: number;
    recentes: EventoLido[];
    xmlPendentes: number;
  };
}

export interface RepositorioIngestaoSsw {
  integracao(empresaId: string, tipo: IntegracaoDaIngestao): Promise<IntegracaoLida | null>;
  /** Grava parâmetros (e o segredo, quando vem) da integração; cria desligada se não existe. */
  salvarIntegracao(
    empresaId: string,
    tipo: IntegracaoDaIngestao,
    dados: { parametros: Record<string, unknown>; segredo: SegredoCifrado | null },
    usuarioId: string,
    agora: Date,
  ): Promise<void>;
  sincronizacoesBi2(relatorio: string | null, limite: number): Promise<SincronizacaoLida[]>;
  eventosWebhook(limite: number): Promise<EventoLido[]>;
  evento(id: string): Promise<EventoLido | null>;
  eventosComMotivo(
    motivo: string,
    limite: number,
  ): Promise<{ id: string; tokenSha256: string[] | null }[]>;
  contagemWebhook(desde: Date): Promise<ContagemWebhook>;
  ultimaAtividadeWebhook(): Promise<Date | null>;
  semVinculo(desde: Date, limite: number): Promise<{ total: number; recentes: EventoLido[] }>;
  xmlOrfaos(): Promise<{ pendentes: number; expirados: number }>;
  /** Última aplicação do ciclo de arquivos do SSW (o "Dados atualizados em"). */
  ultimaAplicacao(): Promise<Date | null>;
  /**
   * Marca o evento como reenviado à fila (a tela mostra "processando" até o worker gravar) e
   * autenticado: só chega aqui o que passou pela conferência do token.
   */
  marcarReprocesso(id: string): Promise<void>;
}

export interface CifradorDeSegredos {
  cifrar(textoPuro: string, contexto: string): SegredoCifrado;
  /** `null` se não decifra com as chaves atuais. */
  decifrar(segredo: SegredoCifrado, contexto: string): string | null;
}

export interface DependenciasIngestaoSsw {
  /** Nulo (testes) ou sem configuração em Plataforma › Integrações: as ações respondem 503. */
  workerSsw: ClienteWorkerSsw | null;
  cifrador: CifradorDeSegredos | null;
  agora: () => Date;
}

type Db = Executor<"ingestaoSsw" | "auditoria">;

const PRAZO_DO_TESTE_MS = 30_000;
const PRAZO_DO_BI2_MS = 60_000;
const DIA_MS = 24 * 3_600_000;

const iso = (d: Date | null) => (d === null ? null : d.toISOString());

/** SHA-256 em hex: o que o worker-ssw guarda da credencial recebida e o que o reprocesso compara. */
function resumoDoSegredo(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

/**
 * Quando o token da SSW API foi gerado (situação do worker-ssw). É leitura: worker-ssw fora ou não
 * configurado = token desconhecido, e a tela continua.
 */
async function tokenSswGeradoEm(
  deps: DependenciasIngestaoSsw,
  empresaId: string,
): Promise<Date | null> {
  if (deps.workerSsw === null) return null;
  try {
    const { tokenSswGeradoEm: em } = await deps.workerSsw.situacao(empresaId);
    return em ? new Date(em) : null;
  } catch {
    return null;
  }
}

function texto(parametros: Record<string, unknown>, chave: string): string {
  const v = parametros[chave];
  return typeof v === "string" ? v.trim() : "";
}

// --- Faixa de saúde ---------------------------------------------------------------------------

/** Saúde da SSW API pela integração gravada e pelo token do worker-ssw (faixa e Dashboard). */
export function saudeDaIntegracao(
  integracao: IntegracaoLida | null,
  tokenGeradoEm: Date | null,
  agora: Date,
): SaudeSsw {
  const p = integracao?.parametros ?? {};
  const s = saudeDaIntegracaoSsw({
    ativa: integracao?.ativo ?? false,
    configurado: Boolean(texto(p, "usuario") && integracao?.temSegredo),
    tokenGeradoEm,
    agora,
  });
  return { ...s, tokenAtualizadoEm: iso(s.tokenAtualizadoEm) };
}

/** origem: getSswHealth (sistema atual) */
export async function saudeSsw(
  db: Db,
  deps: DependenciasIngestaoSsw,
  empresaId: string,
): Promise<SaudeSsw> {
  const integracao = await db(({ ingestaoSsw }) => ingestaoSsw.integracao(empresaId, "ssw_api"));
  const tokenGeradoEm = integracao?.ativo ? await tokenSswGeradoEm(deps, empresaId) : null;
  return saudeDaIntegracao(integracao, tokenGeradoEm, deps.agora());
}

/**
 * Selo das telas. A contagem de XML aguardando é só da Plataforma (como hoje).
 * origem: getUltimaAtualizacao + getXmlOrfaosStats (sistema atual)
 */
export async function atualizacaoDosDados(
  db: Db,
  plataforma: boolean,
): Promise<AtualizacaoDosDados> {
  return db(async ({ ingestaoSsw }) => ({
    atualizadoEm: await ingestaoSsw.ultimaAplicacao(),
    xmlAguardando: plataforma ? await ingestaoSsw.xmlOrfaos() : null,
  }));
}

// --- BI2 0017 ---------------------------------------------------------------------------------

/** Últimas sincronizações do BI2 0017, da mais recente para a mais antiga. */
export async function statusBi2(db: Db): Promise<SincronizacaoLida[]> {
  return db(({ ingestaoSsw }) => ingestaoSsw.sincronizacoesBi2("17", 10));
}

/** "Rodar data específica": a execução manual vai para a mesma fila (uma por vez com a do agendador). */
export async function rodarBi2(
  db: Db,
  deps: DependenciasIngestaoSsw,
  ator: Ator,
  empresaId: string,
  data: string,
): Promise<RodadaDoBi2> {
  const workerSsw = exigirWorkerSsw(deps.workerSsw);
  await db(({ auditoria }) =>
    auditoria.registrar(ator, {
      empresaId,
      acao: "executar",
      entidade: "bi2-0017",
      entidadeId: data,
      resumo: `Rodou o BI2 0017 da data ${data}`,
      antes: null,
      depois: null,
    }),
  );
  const execucaoId = await workerSsw.pedirExecucao(empresaId, {
    job: "bi2-0017",
    dados: { modo: "manual", data, lookback: 0 },
  });
  if (execucaoId === null) return { enfileirado: true, pendente: true, resultado: null };
  const fim = await workerSsw.consultarExecucao("bi2-0017", execucaoId, PRAZO_DO_BI2_MS);
  if (fim.estado === "falhou") throw conflito(`O BI2 0017 falhou: ${fim.erro ?? "erro"}`);
  if (fim.estado !== "concluida") return { enfileirado: true, pendente: true, resultado: null };
  const ultima = (await db(({ ingestaoSsw }) => ingestaoSsw.sincronizacoesBi2("17", 1)))[0];
  return { enfileirado: true, pendente: false, resultado: ultima ?? null };
}

// --- Credenciais da SSW API -------------------------------------------------------------------

export async function credenciaisSsw(
  db: Db,
  deps: DependenciasIngestaoSsw,
  empresaId: string,
): Promise<CredenciaisDaSsw> {
  const integracao = await db(({ ingestaoSsw }) => ingestaoSsw.integracao(empresaId, "ssw_api"));
  const p = integracao?.parametros ?? {};
  const geradoEm = await tokenSswGeradoEm(deps, empresaId);
  const expiraEm = geradoEm === null ? null : new Date(geradoEm.getTime() + TTL_DO_TOKEN_MS);
  const tokenStatus =
    expiraEm === null ? "ausente" : expiraEm > deps.agora() ? "valido" : "expirado";
  return {
    ativo: integracao?.ativo ?? false,
    dominio: texto(p, "dominio"),
    usuario: texto(p, "usuario"),
    cnpjEdi: texto(p, "cnpj_edi"),
    temSenha: integracao?.temSegredo ?? false,
    tokenStatus,
    tokenAtualizadoEm: geradoEm,
    tokenExpiraEm: expiraEm,
    ttlHoras: TTL_DO_TOKEN_MS / 3_600_000,
    atualizadoEm: integracao?.atualizadoEm ?? null,
    ultimaVerificacao:
      integracao?.ultimoTesteEm && integracao.ultimoTesteOk !== null
        ? {
            em: integracao.ultimoTesteEm,
            ok: integracao.ultimoTesteOk,
            mensagem: integracao.ultimoTesteMsg,
          }
        : null,
  };
}

/**
 * Campos vazios são ignorados (a senha só muda quando vem). Mudou o que autentica: pede ao
 * worker-ssw a verificação forçada, que gera o token com as credenciais novas (sem o worker-ssw,
 * o token antigo vale até vencer e o heartbeat agendado gera o novo).
 * origem: setSswCredentials (sistema atual)
 */
export async function salvarCredenciaisSsw(
  db: Db,
  deps: DependenciasIngestaoSsw,
  ator: Ator,
  empresaId: string,
  entrada: EntradaDe<typeof contratosIngestaoSsw.salvarCredenciais>,
): Promise<{ tokenInvalidado: boolean }> {
  const dominio = entrada.dominio?.trim() ?? "";
  const usuario = entrada.usuario?.trim() ?? "";
  const cnpjEdi = (entrada.cnpjEdi ?? "").replace(/\D/g, "");
  const senha = entrada.senha ?? "";
  if (!dominio && !usuario && !cnpjEdi && !senha) {
    throw conflito("Preencha ao menos um campo para salvar.");
  }
  if (senha && deps.cifrador === null) {
    throw conflito("A chave dos segredos não está configurada no servidor. Fale com o suporte.");
  }
  const tokenInvalidado = await db(async ({ ingestaoSsw, auditoria }) => {
    const atual = await ingestaoSsw.integracao(empresaId, "ssw_api");
    const antes = atual?.parametros ?? {};
    const parametros = {
      ...antes,
      ...(dominio ? { dominio } : {}),
      ...(usuario ? { usuario } : {}),
      ...(cnpjEdi ? { cnpj_edi: cnpjEdi } : {}),
    };
    const segredo =
      senha && deps.cifrador
        ? deps.cifrador.cifrar(senha, contextoDoSegredo(empresaId, "ssw_api"))
        : null;
    await ingestaoSsw.salvarIntegracao(
      empresaId,
      "ssw_api",
      { parametros, segredo },
      ator.usuarioId,
      deps.agora(),
    );
    await auditoria.registrar(ator, {
      empresaId,
      acao: "alterar",
      entidade: "integracao_ssw_api",
      entidadeId: null,
      resumo: "Alterou as credenciais da SSW API",
      antes: {
        dominio: texto(antes, "dominio"),
        usuario: texto(antes, "usuario"),
        cnpj_edi: texto(antes, "cnpj_edi"),
      },
      depois: {
        dominio: texto(parametros, "dominio"),
        usuario: texto(parametros, "usuario"),
        cnpj_edi: texto(parametros, "cnpj_edi"),
        senha_alterada: Boolean(senha),
      },
    });
    return (
      Boolean(senha) ||
      ["dominio", "usuario", "cnpj_edi"].some((c) => texto(antes, c) !== texto(parametros, c))
    );
  });
  if (tokenInvalidado && deps.workerSsw) {
    await deps.workerSsw
      .pedirExecucao(empresaId, { job: "verificar-token-ssw", dados: { manual: true } })
      .catch(() => null);
  }
  return { tokenInvalidado };
}

/** "Testar conexão": roda o heartbeat agora, forçando a renovação, e espera o resultado. */
export async function testarConexaoSsw(
  deps: DependenciasIngestaoSsw,
  empresaId: string,
): Promise<ResultadoDoTesteSsw> {
  const workerSsw = exigirWorkerSsw(deps.workerSsw);
  const execucaoId = await workerSsw.pedirExecucao(empresaId, {
    job: "verificar-token-ssw",
    dados: { manual: true },
  });
  const fim =
    execucaoId === null
      ? null
      : await workerSsw.consultarExecucao("verificar-token-ssw", execucaoId, PRAZO_DO_TESTE_MS);
  if (fim === null || fim.estado === "na_fila" || fim.estado === "rodando") {
    return {
      ok: false,
      pendente: true,
      renovado: false,
      mensagem: "O teste ainda está rodando. Recarregue em instantes para ver o resultado.",
      tipoFalha: null,
      tokenPrevia: null,
    };
  }
  if (fim.estado === "falhou") {
    return {
      ok: false,
      pendente: false,
      renovado: false,
      mensagem: fim.erro ?? "O teste falhou. Tente de novo.",
      tipoFalha: null,
      tokenPrevia: null,
    };
  }
  const lido = resultadoDoTesteSsw.omit({ pendente: true }).safeParse(fim.resultado);
  if (!lido.success) throw conflito("O teste devolveu uma resposta inesperada. Tente de novo.");
  return { ...lido.data, pendente: false };
}

// --- Webhook ----------------------------------------------------------------------------------

export async function eventosWebhook(db: Db): Promise<EventosDoWebhook> {
  return db(async ({ ingestaoSsw }) => ({
    ultimaAtividade: await ingestaoSsw.ultimaAtividadeWebhook(),
    eventos: await ingestaoSsw.eventosWebhook(50),
  }));
}

/**
 * Reenvia um evento ao processamento do worker. Marca e audita na transação e só enfileira
 * depois do commit: se o worker terminasse antes, a marca "reenviado" apagaria o resultado dele.
 * Evento não autenticado só volta se o resumo do token bater com o segredo atual ou o anterior.
 */
export async function reprocessarEvento(
  db: Db,
  deps: DependenciasIngestaoSsw,
  ator: Ator,
  empresaId: string,
  id: string,
): Promise<{ enfileirado: boolean }> {
  const workerSsw = exigirWorkerSsw(deps.workerSsw);
  const evento = await db(({ ingestaoSsw }) => ingestaoSsw.evento(id));
  if (evento === null) throw naoEncontrado("Evento não encontrado.");
  if (!evento.temPayload) throw conflito("Este evento não guardou o conteúdo recebido.");
  if (!evento.autenticado) {
    const aceitos = await resumosAceitos(db, deps, empresaId);
    if (!assinadoPorSegredoConhecido(evento.tokenSha256, aceitos)) {
      throw conflito(
        "O token deste evento não confere com o segredo atual nem com o anterior: ele não é reprocessado.",
      );
    }
  }
  await db(async ({ ingestaoSsw, auditoria }) => {
    await ingestaoSsw.marcarReprocesso(id);
    await auditoria.registrar(ator, {
      empresaId,
      acao: "reprocessar",
      entidade: "ssw_webhook_evento",
      entidadeId: id,
      resumo: "Reprocessou um evento do webhook SSW",
      antes: null,
      depois: null,
    });
  });
  await pedirProcessamento(workerSsw, empresaId, id);
  return { enfileirado: true };
}

/**
 * "Reprocessar webhooks rejeitados por token": os eventos `token_incorreto` com payload cujo
 * token (pelo SHA-256 guardado) é o segredo atual ou o anterior — o SSW trocou o token antes de
 * nós, ou nós antes dele. Os demais nunca viram dado.
 */
export async function reprocessarTokenIncorreto(
  db: Db,
  deps: DependenciasIngestaoSsw,
  ator: Ator,
  empresaId: string,
): Promise<{ total: number; enfileirados: number }> {
  const workerSsw = exigirWorkerSsw(deps.workerSsw);
  const aceitos = await resumosAceitos(db, deps, empresaId);
  const eventos = await db(({ ingestaoSsw }) =>
    ingestaoSsw.eventosComMotivo("token_incorreto", 1000),
  );
  const ids = eventos
    .filter((e) => assinadoPorSegredoConhecido(e.tokenSha256, aceitos))
    .map((e) => e.id);
  await db(async ({ ingestaoSsw, auditoria }) => {
    for (const id of ids) await ingestaoSsw.marcarReprocesso(id);
    await auditoria.registrar(ator, {
      empresaId,
      acao: "reprocessar",
      entidade: "ssw_webhook_evento",
      entidadeId: null,
      resumo: `Reprocessou ${ids.length} evento(s) do webhook rejeitados por token`,
      antes: null,
      depois: null,
    });
  });
  for (const id of ids) await pedirProcessamento(workerSsw, empresaId, id);
  return { total: eventos.length, enfileirados: ids.length };
}

/** SHA-256 do segredo atual e do anterior do webhook, decifrados agora. */
async function resumosAceitos(
  db: Db,
  deps: DependenciasIngestaoSsw,
  empresaId: string,
): Promise<ReadonlySet<string>> {
  const cifrador = deps.cifrador;
  if (cifrador === null) {
    throw conflito("A chave dos segredos não está configurada no servidor. Fale com o suporte.");
  }
  const integracao = await db(({ ingestaoSsw }) =>
    ingestaoSsw.integracao(empresaId, "ssw_webhook"),
  );
  const contexto = contextoDoSegredo(empresaId, "ssw_webhook");
  const resumos = new Set<string>();
  for (const segredo of [integracao?.segredo ?? null, integracao?.segredoAnterior ?? null]) {
    if (segredo === null) continue;
    const texto = cifrador.decifrar(segredo, contexto)?.trim() ?? "";
    if (texto) resumos.add(resumoDoSegredo(texto));
  }
  return resumos;
}

function assinadoPorSegredoConhecido(
  resumosDoEvento: readonly string[] | null,
  aceitos: ReadonlySet<string>,
): boolean {
  return (resumosDoEvento ?? []).some((r) => aceitos.has(r));
}

/**
 * Protocolo do reprocesso: novo, para não colidir com o da ocorrência gravada antes. O worker-ssw
 * descarta o pedido repetido enquanto o do mesmo evento está na fila.
 */
async function pedirProcessamento(
  workerSsw: ClienteWorkerSsw,
  empresaId: string,
  eventoId: string,
) {
  const protocolo = `r${Date.now().toString(36)}`.slice(0, 16);
  await workerSsw.pedirExecucao(empresaId, {
    job: "processar-webhook-ssw",
    dados: { eventoId, protocolo },
    deduplicar: true,
  });
}

// --- Diagnóstico ------------------------------------------------------------------------------

/** Situação dos jobs pelo worker-ssw; `null` = não configurado ou fora (a tela avisa). */
async function situacaoDosJobs(deps: DependenciasIngestaoSsw, empresaId: string) {
  if (deps.workerSsw === null) return null;
  try {
    const { jobs } = await deps.workerSsw.situacao(empresaId);
    return new Map<string, (typeof jobs)[number]>(jobs.map((j) => [j.job, j]));
  } catch {
    return null;
  }
}

export async function diagnosticoSsw(
  db: Db,
  deps: DependenciasIngestaoSsw,
  empresaId: string,
): Promise<DiagnosticoDaSsw> {
  const agora = deps.agora().getTime();
  const dados = await db(async ({ ingestaoSsw }) => {
    const ligadas = new Map<string, boolean>();
    for (const tipo of new Set(JOBS_DE_INGESTAO.map((j) => j.integracao))) {
      ligadas.set(tipo, (await ingestaoSsw.integracao(empresaId, tipo))?.ativo ?? false);
    }
    const semVinculo = await ingestaoSsw.semVinculo(new Date(agora - 7 * DIA_MS), 10);
    return {
      ligadas,
      sincronizacoes: await ingestaoSsw.sincronizacoesBi2(null, 10),
      ultimaAtividade: await ingestaoSsw.ultimaAtividadeWebhook(),
      ultimas24h: await ingestaoSsw.contagemWebhook(new Date(agora - DIA_MS)),
      ultimos7d: await ingestaoSsw.contagemWebhook(new Date(agora - 7 * DIA_MS)),
      semVinculo,
      xml: await ingestaoSsw.xmlOrfaos(),
    };
  });
  // O worker-ssw informa a fila e as falhas recentes de cada job (ADR 0012, `/situacao`).
  const situacao = await situacaoDosJobs(deps, empresaId);
  const jobs: StatusDoJob[] = JOBS_DE_INGESTAO.map((j) => {
    const s = situacao?.get(j.job);
    return {
      job: j.job,
      descricao: j.descricao,
      integracao: j.integracao,
      cron: j.cron,
      integracaoLigada: dados.ligadas.get(j.integracao) ?? false,
      agendado: s?.agendado ?? false,
      proximaExecucao: s?.proximaExecucao ?? null,
      aguardando: s?.naFila ?? 0,
      ativos: s?.rodando ?? 0,
      atrasados: s?.atrasados ?? 0,
      falhos: s?.falhos ?? 0,
      ultimaConclusao:
        s?.ultimaExecucao?.estado === "concluida" ? s.ultimaExecucao.terminadaEm : null,
      ultimasFalhas: (s?.ultimasFalhas ?? []).map(({ execucaoId, ...falha }) => ({
        id: execucaoId,
        ...falha,
      })),
    };
  });
  return {
    filasDisponiveis: situacao !== null,
    jobs,
    sincronizacoes: dados.sincronizacoes,
    webhook: {
      ultimaAtividade: dados.ultimaAtividade,
      ultimas24h: dados.ultimas24h,
      ultimos7d: dados.ultimos7d,
    },
    orfaos: {
      webhookSemVinculo7d: dados.semVinculo.total,
      recentes: dados.semVinculo.recentes,
      xmlPendentes: dados.xml.pendentes,
    },
  };
}
