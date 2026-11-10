/**
 * Jobs da ingestão SSW (spec 06 §4). Desligados por padrão: só agendam com
 * `AGENDAMENTOS_LIGADOS=true` **e** `INGESTAO_AGENDADA=true`, e só nas empresas com a integração
 * `sftp` ligada. Singleton por empresa + tipo pelas travas do Redis (FTP 4 min, ciclo 180 s).
 */
import {
  AGENDA_DA_INGESTAO,
  type ClienteSftp,
  type CredenciaisDaEmpresa,
  type DependenciasDoFtp,
  type Enfileirador,
  type FilaDeAplicacao,
  FILAS_DA_INGESTAO,
  JOBS_DA_INGESTAO,
  LIMITE_PADRAO_DOS_ORFAOS,
  limparIngestao,
  type Progressos,
  reprocessarOrfaos,
  rodarCiclos,
  sincronizarFtp,
  type Transacional,
  type Travas,
  unidadePelo455Recente,
} from "@erp/ingestao/casos-de-uso";
import { z } from "@erp/shared/zod";

import { type ContextoDoJob, definirJob } from "../registro";

/** O que os jobs da ingestão usam além do banco (Redis, SFTP, fila de jobs). */
export interface ServicosDaIngestao {
  fila: FilaDeAplicacao;
  travas: Travas;
  progressos: Progressos;
  enfileirador: Enfileirador;
  sftp: ClienteSftp;
  credenciais: CredenciaisDaEmpresa;
  esperar: (ms: number) => Promise<void>;
  /** `INGESTAO_AGENDADA`: sem ele os jobs só rodam sob demanda (tela, rota pública). */
  agendada: boolean;
}

const porEmpresa = z.object({ empresaId: z.uuid() });
const doFtp = porEmpresa.extend({ manual: z.boolean().optional() });

function empresaDoJob(ctx: ContextoDoJob): string {
  if (!ctx.empresaId) throw new Error("Job da ingestão sem empresa.");
  return ctx.empresaId;
}

function dependencias(ctx: ContextoDoJob, s: ServicosDaIngestao): DependenciasDoFtp {
  const empresaId = empresaDoJob(ctx);
  const executar: Transacional = (fn) => ctx.executar((r) => fn(r.ingestao(empresaId)));
  return {
    empresaId,
    executar,
    fila: s.fila,
    travas: s.travas,
    enfileirador: s.enfileirador,
    agora: ctx.agora,
    sftp: s.sftp,
    credenciais: s.credenciais,
    progressos: s.progressos,
    relogio: { agora: ctx.agora, esperar: s.esperar },
  };
}

export function criarJobsDaIngestao(s: ServicosDaIngestao) {
  const agenda = (cron: string) => (s.agendada ? cron : null);

  const ftp = definirJob({
    nome: JOBS_DA_INGESTAO.ftp,
    fila: FILAS_DA_INGESTAO.ftp,
    escopo: "empresa",
    integracao: "sftp",
    dados: doFtp,
    agendamento: agenda(AGENDA_DA_INGESTAO.ftp),
    async processar(ctx, dados) {
      const r = await sincronizarFtp(dependencias(ctx, s), {
        manual: dados.manual ?? false,
        retroativo: false,
      });
      ctx.log.info(r, "sincronização do FTP");
    },
  });

  const ftpRetroativo = definirJob({
    nome: JOBS_DA_INGESTAO.ftpRetroativo,
    fila: FILAS_DA_INGESTAO.ftp,
    escopo: "empresa",
    integracao: "sftp",
    dados: porEmpresa,
    agendamento: agenda(AGENDA_DA_INGESTAO.ftpRetroativo),
    async processar(ctx) {
      const r = await sincronizarFtp(dependencias(ctx, s), { manual: false, retroativo: true });
      ctx.log.info(r, "revarredura retroativa do FTP");
    },
  });

  const ciclo = definirJob({
    nome: JOBS_DA_INGESTAO.ciclo,
    fila: FILAS_DA_INGESTAO.ciclo,
    escopo: "empresa",
    integracao: "sftp",
    dados: porEmpresa,
    agendamento: agenda(AGENDA_DA_INGESTAO.ciclo),
    async processar(ctx) {
      const r = await rodarCiclos(dependencias(ctx, s));
      if (r.resultados.length > 0 || r.status !== "ok") ctx.log.info(r, "ciclo de aplicação");
    },
  });

  const unidadePelo455 = definirJob({
    nome: JOBS_DA_INGESTAO.unidadePelo455,
    fila: FILAS_DA_INGESTAO.manutencao,
    escopo: "empresa",
    integracao: "sftp",
    dados: porEmpresa,
    agendamento: agenda(AGENDA_DA_INGESTAO.unidadePelo455),
    async processar(ctx) {
      const alterados = await unidadePelo455Recente(dependencias(ctx, s));
      ctx.log.info({ alterados }, "unidade pelo 455");
      // TODO(prazo): `calcular_sla_arquivos` roda depois deste job (spec de prazo/SLA).
    },
  });

  const limpeza = definirJob({
    nome: JOBS_DA_INGESTAO.limpeza,
    fila: FILAS_DA_INGESTAO.manutencao,
    escopo: "plataforma",
    dados: z.object({}),
    agendamento: agenda(AGENDA_DA_INGESTAO.limpeza),
    async processar(ctx) {
      const r = await ctx.executar((rep) => limparIngestao(rep.retencaoDaIngestao, ctx.agora()));
      ctx.log.info(r, "limpeza da ingestão");
    },
  });

  const xmlOrfaos = definirJob({
    nome: JOBS_DA_INGESTAO.xmlOrfaos,
    fila: FILAS_DA_INGESTAO.manutencao,
    escopo: "empresa",
    dados: porEmpresa.extend({ limite: z.number().int().min(1).max(1000).optional() }),
    agendamento: null,
    async processar(ctx, dados) {
      const r = await reprocessarOrfaos(
        dependencias(ctx, s).executar,
        dados.limite ?? LIMITE_PADRAO_DOS_ORFAOS,
        ctx.agora(),
      );
      ctx.log.info(r, "órfãos de XML reprocessados");
    },
  });

  return [ftp, ftpRetroativo, ciclo, unidadePelo455, limpeza, xmlOrfaos];
}
