/**
 * Telas de ingestão (Admin › Importação SSW e Admin › XML CT-e) na empresa ativa. A ingestão é do
 * worker-ssw (ADR 0012): as leituras vêm do banco (tabelas compartilhadas) e da situação dos jobs
 * no HTTP interno dele; as ações pedem execuções a ele, com a auditoria gravada antes do pedido.
 * Spec 06 §3.13 e §5.
 */
import { ErroDeNegocio } from "@erp/dominio/erros";
import { type SaidaDe } from "@erp/shared/contrato";
import { contratosIngestao as c } from "@erp/shared/contratos/ingestao";
import { JOBS_DE_INGESTAO } from "@erp/shared/ingestao";
import { registro036 } from "@erp/shared/relatorios-ssw";

import { conflito, naoEncontrado } from "../../http/erros";
import { type ClienteWorkerSsw, exigirWorkerSsw } from "../../infra/worker-ssw";
import { type Executor } from "../../repositorios";
import { type Ator } from "../auditoria/auditoria";

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

export type SincronizacaoLida = Omit<
  SaidaDe<typeof c.ftp>["historico"][number],
  "executadoEm" | "finalizadoEm"
> & { executadoEm: Date; finalizadoEm: Date | null };

export type ArquivoXmlLido = Omit<SaidaDe<typeof c.arquivosXml>["arquivos"][number], "criadoEm"> & {
  criadoEm: Date;
};

/** Linha de staging apagada pelo descarte (o que ela trouxe às projeções do Romaneio). */
export interface LinhaApagada {
  relatorio: string;
  sigla: string | null;
  numero: string | null;
  dados: unknown;
}

export interface RepositorioIngestao {
  ultimosCiclos(empresaId: string, limite: number): Promise<CicloLido[]>;
  ultimosArquivos(empresaId: string, limite: number): Promise<ArquivoLido[]>;
  relatoriosEsperados(empresaId: string): Promise<SaidaDe<typeof c.pipeline>["esperados"]>;
  ultimasAplicacoes(empresaId: string, limite: number): Promise<AplicacaoLida[]>;
  /** `ftp_sync_ativo` da empresa (ou o global); ausente = ligado. */
  ftpAtivo(empresaId: string): Promise<boolean>;
  gravarFtpAtivo(empresaId: string, ativo: boolean, usuarioId: string): Promise<void>;
  ultimasSincronizacoes(empresaId: string, limite: number): Promise<SincronizacaoLida[]>;
  ultimosArquivosXml(empresaId: string, limite: number): Promise<ArquivoXmlLido[]>;
  estatisticasDosOrfaos(empresaId: string): Promise<{
    pendentes: number;
    expirados: number;
    casados: number;
    maisAntigo: Date | null;
  }>;
  ciclo(empresaId: string, cicloChave: string): Promise<CicloLido | null>;
  /** Apaga as linhas e os erros de staging dos arquivos do ciclo; devolve as linhas apagadas. */
  apagarStagingDoCiclo(
    empresaId: string,
    cicloChave: string,
  ): Promise<{ linhas: number; erros: number; apagadas: LinhaApagada[] }>;
  marcarCicloDescartado(empresaId: string, cicloChave: string, motivo: string): Promise<void>;
}

export interface DependenciasIngestao {
  /** Nulo = `WORKER_SSW_URL`/`WORKER_SSW_TOKEN` não configurados: as ações respondem 503. */
  workerSsw: ClienteWorkerSsw | null;
}

type Db = Executor<"ingestao" | "auditoria">;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Horário do FTP em português (Q37: o de produção, igual para todas as empresas). */
const CRON_DO_FTP = JOBS_DE_INGESTAO.find((j) => j.job === "sincronizar-ftp")?.cron ?? "";
const DESCRICAO_DA_AGENDA = `A cada minuto, exceto :00 e :30 (${CRON_DO_FTP} UTC)`;

/** Espera do "reprocessar órfãos": o teto do HTTP interno. */
const PRAZO_DOS_ORFAOS_MS = 60_000;

/** Teto de chaves por pedido de projeção do Romaneio (o zod do job no worker-ssw). */
const MAX_CHAVES_POR_PROJECAO = 50_000;

/**
 * Ações que eram feitas aqui e passaram para o worker-ssw sem pedido no contrato do ADR 0012
 * (importar relatório ou XML pela tela, aplicação manual, retomar ciclo, liberar a trava do FTP).
 */
export function acaoSemPedidoNoWorkerSsw(): never {
  throw new ErroDeNegocio(
    "INDISPONIVEL",
    "Esta ação agora é feita pelo worker do SSW e ainda não pode ser pedida por esta tela. Fale com o suporte.",
  );
}

/** Jobs rodando agora no worker-ssw; fora ou não configurado = nenhum (a tela continua). */
async function jobsRodando(deps: DependenciasIngestao, empresaId: string): Promise<Set<string>> {
  if (deps.workerSsw === null) return new Set();
  try {
    const { jobs } = await deps.workerSsw.situacao(empresaId);
    return new Set(jobs.filter((j) => j.estado === "rodando").map((j) => j.job));
  } catch {
    return new Set();
  }
}

// --- Importação SSW -----------------------------------------------------------------------------

/**
 * Últimos ciclos e arquivos, relatórios esperados e se há aplicação rodando. A fila de aplicação
 * vive no Redis do worker-ssw e não está no contrato: a contagem sai zerada.
 */
export async function lerPipeline(
  db: Db,
  deps: DependenciasIngestao,
  empresaId: string,
): Promise<SaidaDe<typeof c.pipeline>> {
  const dados = await db(async ({ ingestao }) => ({
    ciclos: await ingestao.ultimosCiclos(empresaId, 10),
    arquivos: await ingestao.ultimosArquivos(empresaId, 25),
    esperados: await ingestao.relatoriosEsperados(empresaId),
  }));
  const rodando = await jobsRodando(deps, empresaId);
  return {
    ciclos: dados.ciclos.map((x) => ({
      ...x,
      primeiroArquivoEm: x.primeiroArquivoEm.toISOString(),
      ultimoArquivoEm: x.ultimoArquivoEm.toISOString(),
      fechadoEm: iso(x.fechadoEm),
      aplicadoEm: iso(x.aplicadoEm),
    })),
    arquivos: dados.arquivos.map((a) => ({
      ...a,
      vistoEm: a.vistoEm.toISOString(),
      importadoEm: iso(a.importadoEm),
    })),
    esperados: dados.esperados,
    filaPendente: 0,
    aplicacaoRodando: rodando.has("aplicar-ciclos"),
  };
}

export async function lerAplicacoes(
  db: Db,
  empresaId: string,
): Promise<SaidaDe<typeof c.aplicacoes>> {
  const lista = await db(({ ingestao }) => ingestao.ultimasAplicacoes(empresaId, 20));
  return {
    aplicacoes: lista.map((a) => ({
      ...a,
      iniciadoEm: a.iniciadoEm.toISOString(),
      finalizadoEm: iso(a.finalizadoEm),
    })),
  };
}

/** Relatórios que alimentam as projeções do Romaneio. */
const RELATORIOS_DAS_PROJECOES: ReadonlySet<string> = new Set(["036", "306", "038", "455csv"]);

interface LinhasDescartadas {
  sigla: string;
  numero: string;
  relatorios: string[];
  romaneios: string[];
  dias: string[];
}

/** Agrupa por CT-e o que as linhas apagadas trouxeram para as projeções do Romaneio. */
function descartadasPorCte(apagadas: readonly LinhaApagada[]): LinhasDescartadas[] {
  const porCte = new Map<
    string,
    { sigla: string; numero: string; r: Set<string>; rom: Set<string>; dias: Set<string> }
  >();
  for (const l of apagadas) {
    if (!RELATORIOS_DAS_PROJECOES.has(l.relatorio) || l.sigla === null || l.numero === null) {
      continue;
    }
    const k = `${l.sigla}|${l.numero}`;
    const d = porCte.get(k) ?? {
      sigla: l.sigla,
      numero: l.numero,
      r: new Set<string>(),
      rom: new Set<string>(),
      dias: new Set<string>(),
    };
    d.r.add(l.relatorio);
    if (l.relatorio === "036") {
      const { romaneio, data_emissao } = registro036.parse(l.dados);
      if (romaneio !== null) d.rom.add(romaneio);
      if (data_emissao !== null) d.dias.add(data_emissao);
    }
    porCte.set(k, d);
  }
  return [...porCte.values()].map((d) => ({
    sigla: d.sigla,
    numero: d.numero,
    relatorios: [...d.r],
    romaneios: [...d.rom],
    dias: [...d.dias],
  }));
}

const formatarDataHora = (d: Date) =>
  d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });

/**
 * Descarta um ciclo não aplicado: apaga as linhas e os erros de todos os arquivos dele (Q51 b),
 * audita e pede ao worker-ssw que as projeções do Romaneio tirem o que essas linhas trouxeram.
 */
export async function descartarCiclo(
  db: Db,
  deps: DependenciasIngestao,
  ator: Ator,
  empresaId: string,
  cicloChave: string,
  motivo: string,
): Promise<SaidaDe<typeof c.descartarCiclo>> {
  const workerSsw = exigirWorkerSsw(deps.workerSsw);
  const apagadas = await db(async ({ ingestao, auditoria }) => {
    const ciclo = await ingestao.ciclo(empresaId, cicloChave);
    if (!ciclo) throw naoEncontrado(`Ciclo ${cicloChave} não encontrado.`);
    if (ciclo.status === "aplicado") {
      const quando = ciclo.aplicadoEm ? formatarDataHora(ciclo.aplicadoEm) : "?";
      throw conflito(
        `Ciclo ${cicloChave} já foi aplicado à produção em ${quando} — descarte não permitido.`,
      );
    }
    const r = await ingestao.apagarStagingDoCiclo(empresaId, cicloChave);
    const total = r.linhas + r.erros;
    await ingestao.marcarCicloDescartado(
      empresaId,
      cicloChave,
      `${motivo} — removidas ${total} linhas de staging: linhas ${r.linhas}, erros ${r.erros}`,
    );
    await auditoria.registrar(ator, {
      empresaId,
      acao: "descartar",
      entidade: "ingestao_ciclos",
      entidadeId: cicloChave,
      resumo: `Ciclo ${cicloChave} descartado (${total} linhas removidas)`,
      antes: null,
      depois: { motivo, linhas: r.linhas, erros: r.erros },
    });
    return r;
  });
  const descartadas = descartadasPorCte(apagadas.apagadas);
  for (let i = 0; i < descartadas.length; i += MAX_CHAVES_POR_PROJECAO) {
    const bloco = descartadas.slice(i, i + MAX_CHAVES_POR_PROJECAO);
    await workerSsw.pedirExecucao(empresaId, {
      job: "projecoes-romaneio",
      dados: { chaves: bloco.map(({ sigla, numero }) => ({ sigla, numero })), descartadas: bloco },
    });
  }
  return { cicloChave, totalRemovido: apagadas.linhas + apagadas.erros };
}

// --- FTP ----------------------------------------------------------------------------------------

/**
 * Situação da sincronização do FTP: pausa, agenda e histórico (banco) e se ela está rodando
 * (worker-ssw). O progresso arquivo a arquivo fica no Redis do worker-ssw, fora do contrato.
 */
export async function lerFtp(
  db: Db,
  deps: DependenciasIngestao,
  empresaId: string,
): Promise<SaidaDe<typeof c.ftp>> {
  const { ativo, historico } = await db(async ({ ingestao }) => ({
    ativo: await ingestao.ftpAtivo(empresaId),
    historico: await ingestao.ultimasSincronizacoes(empresaId, 10),
  }));
  const rodando = await jobsRodando(deps, empresaId);
  return {
    ativo,
    agenda: DESCRICAO_DA_AGENDA,
    travaAtiva: rodando.has("sincronizar-ftp"),
    progresso: null,
    historico: historico.map((h) => ({
      ...h,
      executadoEm: h.executadoEm.toISOString(),
      finalizadoEm: iso(h.finalizadoEm),
    })),
  };
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
    deduplicar: `sincronizar-ftp__${empresaId}`,
  });
}

/** Pausa é configuração da empresa (`ftp_sync_ativo`): o worker-ssw lê a cada execução. */
export async function pausarOuRetomarFtp(db: Db, ator: Ator, empresaId: string, ativo: boolean) {
  await db(async ({ ingestao, auditoria }) => {
    await ingestao.gravarFtpAtivo(empresaId, ativo, ator.usuarioId);
    await auditoria.registrar(ator, {
      empresaId,
      acao: ativo ? "retomar" : "pausar",
      entidade: "configuracoes",
      entidadeId: "ftp_sync_ativo",
      resumo: ativo ? "Sincronização do FTP retomada" : "Sincronização do FTP pausada",
      antes: null,
      depois: { ativo },
    });
  });
}

// --- XML CT-e -----------------------------------------------------------------------------------

export async function lerArquivosXml(
  db: Db,
  empresaId: string,
): Promise<SaidaDe<typeof c.arquivosXml>> {
  const { arquivos, orfaos } = await db(async ({ ingestao }) => ({
    arquivos: await ingestao.ultimosArquivosXml(empresaId, 50),
    orfaos: await ingestao.estatisticasDosOrfaos(empresaId),
  }));
  return {
    arquivos: arquivos.map((a) => ({ ...a, criadoEm: a.criadoEm.toISOString() })),
    orfaos: { ...orfaos, maisAntigo: iso(orfaos.maisAntigo) },
  };
}

/**
 * "Reprocessar órfãos": pede ao worker-ssw e espera o resultado (até 60 s); a auditoria vai antes.
 */
export async function reprocessarOrfaos(
  db: Db,
  deps: DependenciasIngestao,
  ator: Ator,
  empresaId: string,
): Promise<SaidaDe<typeof c.reprocessarOrfaos>> {
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
    deduplicar: `reprocessar-xml-orfaos__${empresaId}`,
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
  const lido = c.reprocessarOrfaos.saida.safeParse(fim.resultado);
  if (!lido.success)
    throw conflito("O reprocessamento devolveu uma resposta inesperada. Tente de novo.");
  return lido.data;
}
