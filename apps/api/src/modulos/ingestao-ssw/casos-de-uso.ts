/**
 * Ingestão SSW na API: faixa de saúde da SSW API, Admin › Ingestão SSW (BI2 0017, credenciais,
 * eventos do webhook) e Plataforma › Diagnóstico SSW. O trabalho pesado é do worker: aqui só se
 * lê o que ele gravou, enfileira execuções manuais e grava credenciais.
 * Especificação: docs/regras/06-ingestao.md §3.15–§3.18, §5.
 */
import { contextoDoSegredo, type SegredoCifrado } from "@erp/db/segredos";
import { saudeDaIntegracaoSsw, TTL_DO_TOKEN_MS } from "@erp/dominio/ingestao/ssw-api";
import { type EntradaDe, type SaidaDe } from "@erp/shared/contrato";
import {
  type ContagemWebhook,
  type contratosIngestaoSsw,
  type EventoWebhook,
  type ResultadoDoTesteSsw,
  resultadoDoTesteSsw,
  type SincronizacaoBi2,
  sincronizacaoBi2,
  type StatusDoJob,
} from "@erp/shared/contratos/ingestao-ssw";
import {
  type IntegracaoDaIngestao,
  JOBS_DE_INGESTAO,
  type NomeDoJobDeIngestao,
} from "@erp/shared/ingestao";

import { conflito, naoEncontrado } from "../../http/erros";
import { type Executor } from "../../repositorios";
import { type Ator } from "../auditoria/auditoria";
import { type EmpresaDoWebhook, type EventoRecebido } from "./webhook";

// --- Portas -----------------------------------------------------------------------------------

export interface IntegracaoLida {
  ativo: boolean;
  parametros: Record<string, unknown>;
  temSegredo: boolean;
  segredo: SegredoCifrado | null;
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
}

export interface SincronizacaoLida extends Omit<SincronizacaoBi2, "iniciadoEm" | "finalizadoEm"> {
  iniciadoEm: Date;
  finalizadoEm: Date | null;
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
  eventosComMotivo(motivo: string, limite: number): Promise<string[]>;
  contagemWebhook(desde: Date): Promise<ContagemWebhook>;
  ultimaAtividadeWebhook(): Promise<Date | null>;
  semVinculo(desde: Date, limite: number): Promise<{ total: number; recentes: EventoLido[] }>;
  xmlOrfaos(): Promise<{ pendentes: number; expirados: number }>;
  /** Última aplicação do ciclo de arquivos do SSW (o "Dados atualizados em"). */
  ultimaAplicacao(): Promise<Date | null>;
  /** Marca o evento como reenviado à fila (a tela mostra "processando" até o worker gravar). */
  marcarReprocesso(id: string): Promise<void>;
  // Recepção do webhook (rota pública).
  /** Todas as empresas com a integração do webhook (contexto da Plataforma). */
  empresasComWebhook(): Promise<EmpresaDoWebhook[]>;
  /** Grava o evento recebido (contexto da empresa do evento). */
  registrarEvento(evento: EventoRecebido): Promise<string>;
  marcarEvento(eventoId: string, statusHttp: number, erro: string): Promise<void>;
}

export type ResultadoDaExecucao =
  { tipo: "concluido"; valor: unknown } | { tipo: "falhou"; erro: string } | { tipo: "pendente" };

export interface StatusDaFila {
  agendado: boolean;
  proximaExecucao: Date | null;
  aguardando: number;
  ativos: number;
  atrasados: number;
  falhos: number;
  ultimaConclusao: Date | null;
  ultimasFalhas: { id: string; quando: Date | null; erro: string; tentativas: number }[];
}

/** Filas do BullMQ e o token da SSW API no Redis. Nulo = API sem Redis (desenvolvimento). */
export interface FilasDeIngestao {
  enfileirar(
    job: NomeDoJobDeIngestao,
    dados: Readonly<Record<string, unknown>>,
    opcoes: { deduplicar: string | null },
  ): Promise<string>;
  aguardar(job: NomeDoJobDeIngestao, jobId: string, prazoMs: number): Promise<ResultadoDaExecucao>;
  status(job: NomeDoJobDeIngestao, empresaId: string): Promise<StatusDaFila>;
  tokenSswGeradoEm(empresaId: string): Promise<Date | null>;
  esquecerTokenSsw(empresaId: string): Promise<void>;
}

export interface CifradorDeSegredos {
  cifrar(textoPuro: string, contexto: string): SegredoCifrado;
}

export interface DependenciasIngestaoSsw {
  filas: FilasDeIngestao | null;
  cifrador: CifradorDeSegredos | null;
  agora: () => Date;
}

type Db = Executor<"ingestaoSsw" | "auditoria">;

const PRAZO_DO_TESTE_MS = 30_000;
const PRAZO_DO_BI2_MS = 60_000;
const DIA_MS = 24 * 3_600_000;

const iso = (d: Date | null) => (d === null ? null : d.toISOString());

function filasOuErro(filas: FilasDeIngestao | null): FilasDeIngestao {
  if (filas === null) {
    throw conflito("A fila de processamento não está disponível. Tente de novo em instantes.");
  }
  return filas;
}

function texto(parametros: Record<string, unknown>, chave: string): string {
  const v = parametros[chave];
  return typeof v === "string" ? v.trim() : "";
}

// --- Faixa de saúde ---------------------------------------------------------------------------

/** origem: getSswHealth (sistema atual) */
export async function saudeSsw(
  db: Db,
  deps: DependenciasIngestaoSsw,
  empresaId: string,
): Promise<SaidaDe<typeof contratosIngestaoSsw.saude>> {
  const integracao = await db(({ ingestaoSsw }) => ingestaoSsw.integracao(empresaId, "ssw_api"));
  const ativa = integracao?.ativo ?? false;
  const tokenGeradoEm = ativa && deps.filas ? await deps.filas.tokenSswGeradoEm(empresaId) : null;
  const p = integracao?.parametros ?? {};
  const s = saudeDaIntegracaoSsw({
    ativa,
    configurado: Boolean(texto(p, "usuario") && integracao?.temSegredo),
    tokenGeradoEm,
    agora: deps.agora(),
  });
  return { ...s, tokenAtualizadoEm: iso(s.tokenAtualizadoEm) };
}

/**
 * Selo das telas. A contagem de XML aguardando é só da Plataforma (como hoje).
 * origem: getUltimaAtualizacao + getXmlOrfaosStats (sistema atual)
 */
export async function atualizacaoDosDados(
  db: Db,
  plataforma: boolean,
): Promise<SaidaDe<typeof contratosIngestaoSsw.atualizacao>> {
  return db(async ({ ingestaoSsw }) => ({
    atualizadoEm: iso(await ingestaoSsw.ultimaAplicacao()),
    xmlAguardando: plataforma ? await ingestaoSsw.xmlOrfaos() : null,
  }));
}

// --- BI2 0017 ---------------------------------------------------------------------------------

const paraSaida = (s: SincronizacaoLida): SincronizacaoBi2 => ({
  ...s,
  iniciadoEm: s.iniciadoEm.toISOString(),
  finalizadoEm: iso(s.finalizadoEm),
});

export async function statusBi2(db: Db): Promise<SaidaDe<typeof contratosIngestaoSsw.bi2Status>> {
  const recentes = (await db(({ ingestaoSsw }) => ingestaoSsw.sincronizacoesBi2("17", 10))).map(
    paraSaida,
  );
  return { ultima: recentes[0] ?? null, recentes };
}

/** "Rodar data específica": a execução manual vai para a mesma fila (uma por vez com a do agendador). */
export async function rodarBi2(
  db: Db,
  deps: DependenciasIngestaoSsw,
  ator: Ator,
  empresaId: string,
  data: string,
): Promise<SaidaDe<typeof contratosIngestaoSsw.rodarBi2>> {
  const filas = filasOuErro(deps.filas);
  const jobId = await filas.enfileirar(
    "bi2_0017",
    { empresaId, modo: "manual", data, lookback: 0 },
    { deduplicar: null },
  );
  await db(({ auditoria }) =>
    auditoria.registrar(ator, {
      empresaId,
      acao: "executar",
      entidade: "bi2_0017",
      entidadeId: data,
      resumo: `Rodou o BI2 0017 da data ${data}`,
      antes: null,
      depois: null,
    }),
  );
  const fim = await filas.aguardar("bi2_0017", jobId, PRAZO_DO_BI2_MS);
  if (fim.tipo === "falhou") throw conflito(`O BI2 0017 falhou: ${fim.erro}`);
  if (fim.tipo === "pendente") return { enfileirado: true, pendente: true, resultado: null };
  const ultima = (await db(({ ingestaoSsw }) => ingestaoSsw.sincronizacoesBi2("17", 1)))[0];
  return {
    enfileirado: true,
    pendente: false,
    resultado: ultima ? sincronizacaoBi2.parse(paraSaida(ultima)) : null,
  };
}

// --- Credenciais da SSW API -------------------------------------------------------------------

export async function credenciaisSsw(
  db: Db,
  deps: DependenciasIngestaoSsw,
  empresaId: string,
): Promise<SaidaDe<typeof contratosIngestaoSsw.credenciais>> {
  const integracao = await db(({ ingestaoSsw }) => ingestaoSsw.integracao(empresaId, "ssw_api"));
  const p = integracao?.parametros ?? {};
  const geradoEm = deps.filas ? await deps.filas.tokenSswGeradoEm(empresaId) : null;
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
    tokenAtualizadoEm: iso(geradoEm),
    tokenExpiraEm: iso(expiraEm),
    ttlHoras: TTL_DO_TOKEN_MS / 3_600_000,
    atualizadoEm: iso(integracao?.atualizadoEm ?? null),
    ultimaVerificacao:
      integracao?.ultimoTesteEm && integracao.ultimoTesteOk !== null
        ? {
            em: integracao.ultimoTesteEm.toISOString(),
            ok: integracao.ultimoTesteOk,
            mensagem: integracao.ultimoTesteMsg,
          }
        : null,
  };
}

/**
 * Campos vazios são ignorados (a senha só muda quando vem). Mudou o que autentica: o token
 * guardado deixa de valer e o próximo heartbeat gera outro.
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
  if (tokenInvalidado) await deps.filas?.esquecerTokenSsw(empresaId);
  return { tokenInvalidado };
}

/** "Testar conexão": roda o heartbeat agora, forçando a renovação, e espera o resultado. */
export async function testarConexaoSsw(
  deps: DependenciasIngestaoSsw,
  empresaId: string,
): Promise<ResultadoDoTesteSsw> {
  const filas = filasOuErro(deps.filas);
  const jobId = await filas.enfileirar(
    "ssw_token_check",
    { empresaId, manual: true },
    { deduplicar: null },
  );
  const fim = await filas.aguardar("ssw_token_check", jobId, PRAZO_DO_TESTE_MS);
  if (fim.tipo === "pendente") {
    return {
      ok: false,
      pendente: true,
      renovado: false,
      mensagem: "O teste ainda está rodando. Recarregue em instantes para ver o resultado.",
      tipoFalha: null,
      tokenPrevia: null,
    };
  }
  if (fim.tipo === "falhou") {
    return {
      ok: false,
      pendente: false,
      renovado: false,
      mensagem: fim.erro,
      tipoFalha: null,
      tokenPrevia: null,
    };
  }
  const lido = resultadoDoTesteSsw.omit({ pendente: true }).safeParse(fim.valor);
  if (!lido.success) throw conflito("O teste devolveu uma resposta inesperada. Tente de novo.");
  return { ...lido.data, pendente: false };
}

// --- Webhook ----------------------------------------------------------------------------------

const paraEvento = (e: EventoLido): EventoWebhook => ({
  ...e,
  recebidoEm: e.recebidoEm.toISOString(),
});

export async function eventosWebhook(
  db: Db,
): Promise<SaidaDe<typeof contratosIngestaoSsw.eventosWebhook>> {
  return db(async ({ ingestaoSsw }) => ({
    ultimaAtividade: iso(await ingestaoSsw.ultimaAtividadeWebhook()),
    eventos: (await ingestaoSsw.eventosWebhook(50)).map(paraEvento),
  }));
}

/** O processamento é o do worker: o evento volta para a fila com o payload gravado. */
export async function reprocessarEvento(
  db: Db,
  deps: DependenciasIngestaoSsw,
  ator: Ator,
  empresaId: string,
  id: string,
): Promise<{ enfileirado: boolean }> {
  const filas = filasOuErro(deps.filas);
  const evento = await db(({ ingestaoSsw }) => ingestaoSsw.evento(id));
  if (evento === null) throw naoEncontrado("Evento não encontrado.");
  if (!evento.temPayload) throw conflito("Este evento não guardou o conteúdo recebido.");
  await enfileirarEvento(filas, empresaId, id);
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
  return { enfileirado: true };
}

/** "Reprocessar webhooks rejeitados por token": os eventos `token_incorreto` com payload. */
export async function reprocessarTokenIncorreto(
  db: Db,
  deps: DependenciasIngestaoSsw,
  ator: Ator,
  empresaId: string,
): Promise<{ total: number; enfileirados: number }> {
  const filas = filasOuErro(deps.filas);
  const ids = await db(({ ingestaoSsw }) => ingestaoSsw.eventosComMotivo("token_incorreto", 1000));
  for (const id of ids) await enfileirarEvento(filas, empresaId, id);
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
  return { total: ids.length, enfileirados: ids.length };
}

/** Protocolo do reprocesso: novo, para não colidir com o da ocorrência gravada antes. */
export async function enfileirarEvento(
  filas: FilasDeIngestao,
  empresaId: string,
  eventoId: string,
) {
  const protocolo = `r${Date.now().toString(36)}`.slice(0, 16);
  await filas.enfileirar(
    "ssw_webhook",
    { empresaId, eventoId, protocolo },
    { deduplicar: `ssw_webhook__${eventoId}` },
  );
}

// --- Diagnóstico ------------------------------------------------------------------------------

export async function diagnosticoSsw(
  db: Db,
  deps: DependenciasIngestaoSsw,
  empresaId: string,
): Promise<SaidaDe<typeof contratosIngestaoSsw.diagnostico>> {
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
  const jobs: StatusDoJob[] = [];
  for (const j of JOBS_DE_INGESTAO) {
    const s = deps.filas ? await deps.filas.status(j.job, empresaId) : null;
    jobs.push({
      job: j.job,
      descricao: j.descricao,
      integracao: j.integracao,
      cron: j.cron,
      integracaoLigada: dados.ligadas.get(j.integracao) ?? false,
      agendado: s?.agendado ?? false,
      proximaExecucao: iso(s?.proximaExecucao ?? null),
      aguardando: s?.aguardando ?? 0,
      ativos: s?.ativos ?? 0,
      atrasados: s?.atrasados ?? 0,
      falhos: s?.falhos ?? 0,
      ultimaConclusao: iso(s?.ultimaConclusao ?? null),
      ultimasFalhas: (s?.ultimasFalhas ?? []).map((f) => ({ ...f, quando: iso(f.quando) })),
    });
  }
  return {
    filasDisponiveis: deps.filas !== null,
    jobs,
    sincronizacoes: dados.sincronizacoes.map(paraSaida),
    webhook: {
      ultimaAtividade: iso(dados.ultimaAtividade),
      ultimas24h: dados.ultimas24h,
      ultimos7d: dados.ultimos7d,
    },
    orfaos: {
      webhookSemVinculo7d: dados.semVinculo.total,
      recentes: dados.semVinculo.recentes.map((e) => ({
        id: e.id,
        recebidoEm: e.recebidoEm.toISOString(),
        numero: e.numeroCte,
      })),
      xmlPendentes: dados.xml.pendentes,
    },
  };
}
