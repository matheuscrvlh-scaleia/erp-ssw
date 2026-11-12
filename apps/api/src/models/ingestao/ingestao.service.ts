/**
 * Telas de ingestão (Admin › Importação SSW e Admin › XML CT-e) na empresa ativa. A ingestão é do
 * worker-ssw (ADR 0012): as leituras puras (pipeline, aplicações, arquivos XML, histórico do FTP)
 * vêm do banco; as ações e o estado do FTP passam pelo HTTP interno dele, com a auditoria gravada
 * antes de chamar. Quem grava e decide é o worker-ssw. Spec 06 §3.13 e §5.
 */
import {
  type ArquivoXml,
  type contratosIngestao as c,
  type SincronizacaoDoFtp,
} from "@erp/shared/contratos/ingestao";
import {
  cicloDescartado,
  cicloRetomado,
  ok,
  pedidoDeAplicacao,
  pedidoDeDescarte,
  pedidoDeFtpAtivo,
  pedidoDeRelatorio,
  pedidoDeXml,
  relatorioImportado,
  resultadoDaAplicacao,
  resultadoDoXml,
  type SituacaoDoFtp,
  situacaoDoFtp,
} from "@erp/shared/contratos/worker-ssw";
import { JOBS_DE_INGESTAO } from "@erp/shared/ingestao";
import { z } from "@erp/shared/zod";

import {
  type ClienteWorkerSsw,
  exigirWorkerSsw,
  type OperacaoManual,
  type PedidoDeOperacao,
} from "../../infra/worker-ssw";
import { type Ator, type EventoDeAuditoria } from "../auditoria/auditoria.service";
import { conflito } from "../erros";
import { type Executor } from "../repositorios";

// --- Portas -----------------------------------------------------------------------------------

export interface CicloLido {
  cicloChave: string;
  status: string;
  motivo: string | null;
  faltantes: string[];
  totais: Record<string, unknown>;
  arquivosImportados: number;
  linhasImportadas: number;
  primeiroArquivoEm: Date;
  ultimoArquivoEm: Date;
  fechadoEm: Date | null;
  aplicadoEm: Date | null;
}

export interface ArquivoLido {
  nomeArquivo: string;
  cicloChave: string | null;
  relatorio: string | null;
  unidade: string | null;
  status: string;
  linhas: number;
  mensagem: string | null;
  vistoEm: Date;
  importadoEm: Date | null;
}

export interface AplicacaoLida {
  id: string;
  status: "em_andamento" | "concluido" | "erro";
  simulacao: boolean;
  totalInseridos: number;
  totalAtualizados: number;
  totalOcorrencias: number;
  totalIgnorados: number;
  erro: string | null;
  iniciadoEm: Date;
  finalizadoEm: Date | null;
}

export type SincronizacaoLida = Omit<SincronizacaoDoFtp, "executadoEm" | "finalizadoEm"> & {
  executadoEm: Date;
  finalizadoEm: Date | null;
};

export type ArquivoXmlLido = Omit<ArquivoXml, "criadoEm"> & { criadoEm: Date };

export interface RelatorioEsperado {
  relatorio: string;
  porUnidade: boolean;
  unidadesEsperadas: string[];
  obrigatorioNoCiclo: boolean;
  ativo: boolean;
}

export interface EstatisticasDosOrfaos {
  pendentes: number;
  expirados: number;
  casados: number;
  maisAntigo: Date | null;
}

export interface FilaDeAplicacao {
  pendentes: number;
  rodando: boolean;
}

export interface PipelineDaIngestao {
  ciclos: CicloLido[];
  arquivos: ArquivoLido[];
  esperados: RelatorioEsperado[];
  fila: FilaDeAplicacao;
}

export interface FtpDaIngestao {
  situacao: SituacaoDoFtp;
  historico: SincronizacaoLida[];
}

export interface ArquivosXmlDaIngestao {
  arquivos: ArquivoXmlLido[];
  orfaos: EstatisticasDosOrfaos;
}

export interface RepositorioIngestao {
  ultimosCiclos(empresaId: string, limite: number): Promise<CicloLido[]>;
  ultimosArquivos(empresaId: string, limite: number): Promise<ArquivoLido[]>;
  relatoriosEsperados(empresaId: string): Promise<RelatorioEsperado[]>;
  ultimasAplicacoes(empresaId: string, limite: number): Promise<AplicacaoLida[]>;
  /** `ftp_sync_ativo` da empresa (ou o global); ausente = ligado. Só sem o worker-ssw. */
  ftpAtivo(empresaId: string): Promise<boolean>;
  ultimasSincronizacoes(empresaId: string, limite: number): Promise<SincronizacaoLida[]>;
  ultimosArquivosXml(empresaId: string, limite: number): Promise<ArquivoXmlLido[]>;
  estatisticasDosOrfaos(empresaId: string): Promise<EstatisticasDosOrfaos>;
}

export interface DependenciasIngestao {
  /** Nulo (testes) ou sem configuração em Plataforma › Integrações: as ações respondem 503. */
  workerSsw: ClienteWorkerSsw | null;
}

type Db = Executor<"ingestao" | "auditoria">;

/** Horário do FTP em português (Q37: o de produção, igual para todas as empresas). */
const CRON_DO_FTP = JOBS_DE_INGESTAO.find((j) => j.job === "sincronizar-ftp")?.cron ?? "";
const DESCRICAO_DA_AGENDA = `A cada minuto, exceto :00 e :30 (${CRON_DO_FTP} UTC)`;

/** Espera do "reprocessar órfãos": o teto do HTTP interno. */
const PRAZO_DOS_ORFAOS_MS = 60_000;

/** Resultado do job "reprocessar-xml-orfaos" no worker-ssw (o contrato interno não o declara). */
const resultadoDosOrfaos = z.object({
  expirados: z.number().int(),
  tentados: z.number().int(),
  casados: z.number().int(),
});

type Registro = Omit<EventoDeAuditoria, "empresaId" | "antes">;

/**
 * Operação manual: confere a configuração, grava a auditoria (quem pediu) e só então chama o
 * worker-ssw. Nada roda sem rastro; se a chamada falhar, a auditoria mostra a tentativa.
 */
async function auditarEPedir<T extends z.ZodType>(
  db: Db,
  deps: DependenciasIngestao,
  ator: Ator,
  empresaId: string,
  registro: Registro,
  operacao: OperacaoManual,
  saida: T,
  pedido?: PedidoDeOperacao,
): Promise<z.output<T>> {
  const workerSsw = exigirWorkerSsw(deps.workerSsw);
  await db(({ auditoria }) => auditoria.registrar(ator, { ...registro, empresaId, antes: null }));
  return workerSsw.operacao(empresaId, operacao, saida, pedido);
}

/** Fila de aplicação no worker-ssw; fora ou não configurado = vazia (a tela continua). */
async function filaDeAplicacao(
  deps: DependenciasIngestao,
  empresaId: string,
): Promise<FilaDeAplicacao> {
  if (deps.workerSsw === null) return { pendentes: 0, rodando: false };
  try {
    const { jobs, aplicacao } = await deps.workerSsw.situacao(empresaId);
    const ciclos = jobs.find((j) => j.job === "aplicar-ciclos");
    return {
      pendentes: aplicacao.pendentes,
      rodando: aplicacao.rodando || ciclos?.estado === "rodando",
    };
  } catch {
    return { pendentes: 0, rodando: false };
  }
}

// --- Importação SSW -----------------------------------------------------------------------------

/** Últimos ciclos e arquivos, relatórios esperados e a fila de aplicação (do worker-ssw). */
export async function lerPipeline(
  db: Db,
  deps: DependenciasIngestao,
  empresaId: string,
): Promise<PipelineDaIngestao> {
  const dados = await db(async ({ ingestao }) => ({
    ciclos: await ingestao.ultimosCiclos(empresaId, 10),
    arquivos: await ingestao.ultimosArquivos(empresaId, 25),
    esperados: await ingestao.relatoriosEsperados(empresaId),
  }));
  return { ...dados, fila: await filaDeAplicacao(deps, empresaId) };
}

export async function lerAplicacoes(db: Db, empresaId: string): Promise<AplicacaoLida[]> {
  return db(({ ingestao }) => ingestao.ultimasAplicacoes(empresaId, 20));
}

export function retomarCiclo(
  db: Db,
  deps: DependenciasIngestao,
  ator: Ator,
  empresaId: string,
  chave: string,
): Promise<z.output<typeof cicloRetomado>> {
  return auditarEPedir(
    db,
    deps,
    ator,
    empresaId,
    {
      acao: "retomar",
      entidade: "ingestao_ciclos",
      entidadeId: chave,
      resumo: `Ciclo ${chave} retomado`,
      depois: {},
    },
    "retomarCiclo",
    cicloRetomado,
    { parametros: { chave } },
  );
}

/** Descarta um ciclo não aplicado (Q51 b); o worker-ssw recalcula as projeções afetadas. */
export function descartarCiclo(
  db: Db,
  deps: DependenciasIngestao,
  ator: Ator,
  empresaId: string,
  chave: string,
  motivo: string,
): Promise<z.output<typeof cicloDescartado>> {
  return auditarEPedir(
    db,
    deps,
    ator,
    empresaId,
    {
      acao: "descartar",
      entidade: "ingestao_ciclos",
      entidadeId: chave,
      resumo: `Ciclo ${chave} descartado`,
      depois: { motivo },
    },
    "descartarCiclo",
    cicloDescartado,
    { parametros: { chave }, corpo: pedidoDeDescarte.parse({ motivo }) },
  );
}

/** Relatório colado na tela: vai ao worker-ssw como o texto em UTF-8, em base64. */
export function importarRelatorio(
  db: Db,
  deps: DependenciasIngestao,
  ator: Ator,
  empresaId: string,
  entrada: z.output<typeof c.importarRelatorio.entrada>,
): Promise<z.output<typeof relatorioImportado>> {
  const corpo = pedidoDeRelatorio.parse({
    relatorio: entrada.relatorio,
    nomeArquivo: entrada.nome,
    conteudoBase64: Buffer.from(entrada.conteudo, "utf8").toString("base64"),
    aceitarDivergencia: entrada.aceitarDivergencia,
  });
  return auditarEPedir(
    db,
    deps,
    ator,
    empresaId,
    {
      acao: "importar",
      entidade: "ingestao_arquivos",
      entidadeId: entrada.nome,
      resumo: `Relatório ${entrada.relatorio} importado à mão`,
      depois: { relatorio: entrada.relatorio, aceitarDivergencia: entrada.aceitarDivergencia },
    },
    "importarRelatorio",
    relatorioImportado,
    { corpo },
  );
}

/** Aplicação manual de um bloco, ou só a simulação (`dryRun`). */
export function aplicar(
  db: Db,
  deps: DependenciasIngestao,
  ator: Ator,
  empresaId: string,
  entrada: z.output<typeof c.aplicar.entrada>,
): Promise<z.output<typeof resultadoDaAplicacao>> {
  const { dryRun, limite, offset } = entrada;
  return auditarEPedir(
    db,
    deps,
    ator,
    empresaId,
    {
      acao: dryRun ? "simular" : "aplicar",
      entidade: "ingestao_aplicacoes",
      entidadeId: null,
      resumo: dryRun ? "Simulou a aplicação manual" : "Aplicação manual de um bloco",
      depois: { limite, offset },
    },
    "aplicar",
    resultadoDaAplicacao,
    { corpo: pedidoDeAplicacao.parse({ simular: dryRun, limite, offset }) },
  );
}

// --- FTP ----------------------------------------------------------------------------------------

async function situacaoDoFtpNoWorker(deps: DependenciasIngestao, empresaId: string) {
  if (deps.workerSsw === null) return null;
  try {
    return await deps.workerSsw.operacao(empresaId, "ftp", situacaoDoFtp);
  } catch {
    return null;
  }
}

/**
 * Situação do FTP: pausa, trava e progresso vêm do worker-ssw (o progresso vive no Redis dele) e
 * o histórico das sincronizações, do banco. Worker-ssw fora ou não configurado: a tela continua,
 * com a pausa gravada no banco, sem trava nem progresso.
 */
export async function lerFtp(
  db: Db,
  deps: DependenciasIngestao,
  empresaId: string,
): Promise<FtpDaIngestao> {
  const { ativo, historico } = await db(async ({ ingestao }) => ({
    ativo: await ingestao.ftpAtivo(empresaId),
    historico: await ingestao.ultimasSincronizacoes(empresaId, 10),
  }));
  const situacao = (await situacaoDoFtpNoWorker(deps, empresaId)) ?? {
    ativo,
    agenda: DESCRICAO_DA_AGENDA,
    travaAtiva: false,
    progresso: null,
  };
  return { situacao, historico };
}

/**
 * "Rodar agora" ignora a pausa; uma por empresa (disparo repetido é descartado pelo worker-ssw).
 * O pedido só sai depois que a auditoria foi gravada: nada roda sem rastro.
 */
export async function rodarFtpAgora(
  db: Db,
  deps: DependenciasIngestao,
  ator: Ator,
  empresaId: string,
) {
  const workerSsw = exigirWorkerSsw(deps.workerSsw);
  await db(({ auditoria }) =>
    auditoria.registrar(ator, {
      empresaId,
      acao: "executar",
      entidade: "empresa_integracoes",
      entidadeId: "sftp",
      resumo: "Sincronização do FTP disparada",
      antes: null,
      depois: {},
    }),
  );
  await workerSsw.pedirExecucao(empresaId, {
    job: "sincronizar-ftp",
    dados: { manual: true },
    deduplicar: true,
  });
}

export async function pausarOuRetomarFtp(
  db: Db,
  deps: DependenciasIngestao,
  ator: Ator,
  empresaId: string,
  ativo: boolean,
) {
  await auditarEPedir(
    db,
    deps,
    ator,
    empresaId,
    {
      acao: ativo ? "retomar" : "pausar",
      entidade: "configuracoes",
      entidadeId: "ftp_sync_ativo",
      resumo: ativo ? "Sincronização do FTP retomada" : "Sincronização do FTP pausada",
      depois: { ativo },
    },
    "pausarFtp",
    ok,
    { corpo: pedidoDeFtpAtivo.parse({ ativo }) },
  );
}

export async function liberarTravaFtp(
  db: Db,
  deps: DependenciasIngestao,
  ator: Ator,
  empresaId: string,
) {
  await auditarEPedir(
    db,
    deps,
    ator,
    empresaId,
    {
      acao: "liberar_trava",
      entidade: "empresa_integracoes",
      entidadeId: "sftp",
      resumo: "Trava do FTP liberada à mão",
      depois: {},
    },
    "liberarTravaFtp",
    ok,
  );
}

// --- XML CT-e -----------------------------------------------------------------------------------

export async function lerArquivosXml(db: Db, empresaId: string): Promise<ArquivosXmlDaIngestao> {
  return db(async ({ ingestao }) => ({
    arquivos: await ingestao.ultimosArquivosXml(empresaId, 50),
    orfaos: await ingestao.estatisticasDosOrfaos(empresaId),
  }));
}

/** XML ou zip enviado pela tela, em base64 (com ou sem o prefixo `data:`). */
export function importarXml(
  db: Db,
  deps: DependenciasIngestao,
  ator: Ator,
  empresaId: string,
  entrada: z.output<typeof c.importarXml.entrada>,
): Promise<z.output<typeof resultadoDoXml>> {
  return auditarEPedir(
    db,
    deps,
    ator,
    empresaId,
    {
      acao: "importar",
      entidade: "xml_cte_arquivos",
      entidadeId: entrada.nome,
      resumo: `XML de CT-e importado à mão (${entrada.nome})`,
      depois: {},
    },
    "importarXml",
    resultadoDoXml,
    { corpo: pedidoDeXml.parse({ nomeArquivo: entrada.nome, conteudoBase64: entrada.base64 }) },
  );
}

/**
 * "Reprocessar órfãos": pede ao worker-ssw e espera o resultado (até 60 s); a auditoria vai antes.
 */
export async function reprocessarOrfaos(
  db: Db,
  deps: DependenciasIngestao,
  ator: Ator,
  empresaId: string,
): Promise<z.output<typeof resultadoDosOrfaos>> {
  const workerSsw = exigirWorkerSsw(deps.workerSsw);
  await db(({ auditoria }) =>
    auditoria.registrar(ator, {
      empresaId,
      acao: "reprocessar",
      entidade: "xml_cte_orfaos",
      entidadeId: null,
      resumo: "Reprocessou os XML de CT-e órfãos",
      antes: null,
      depois: null,
    }),
  );
  const execucaoId = await workerSsw.pedirExecucao(empresaId, {
    job: "reprocessar-xml-orfaos",
    deduplicar: true,
  });
  const fim =
    execucaoId === null
      ? null
      : await workerSsw.consultarExecucao(
          "reprocessar-xml-orfaos",
          execucaoId,
          PRAZO_DOS_ORFAOS_MS,
        );
  if (fim?.estado === "falhou") throw conflito(fim.erro ?? "O reprocessamento falhou.");
  if (fim?.estado !== "concluida") {
    throw conflito(
      "O reprocessamento ainda está rodando. Recarregue em instantes para ver o resultado.",
    );
  }
  const lido = resultadoDosOrfaos.safeParse(fim.resultado);
  if (!lido.success)
    throw conflito("O reprocessamento devolveu uma resposta inesperada. Tente de novo.");
  return lido.data;
}
