/**
 * Casos de uso das telas de ingestão (Admin › Importação SSW e Admin › XML CT-e) na empresa ativa.
 * A regra da ingestão é de `@erp/ingestao`; aqui só se junta o que a tela mostra, com as travas,
 * o progresso e a fila de `ServicosDaIngestao`. Spec 06 §3.13 e §5.
 */
import { ErroDeNegocio } from "@erp/dominio/erros";
import {
  aplicar036,
  aplicarBloco,
  type DependenciasDoCiclo,
  importarArquivoXml,
  LEASE_DO_CICLO_MS,
  travaDoCiclo,
  travaDoFtp,
} from "@erp/ingestao/casos-de-uso";
import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosIngestao as c } from "@erp/shared/contratos/ingestao";
import { filaDoJob, idDeExecucao, JOBS_DE_INGESTAO } from "@erp/shared/ingestao";

import { type ServicosDaIngestao } from "./servicos";

/** A ingestão de uma empresa, com o ator da requisição já nas dependências. */
export interface IngestaoDaEmpresa {
  empresaId: string;
  deps: DependenciasDoCiclo;
  servicos: ServicosDaIngestao;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const isoObrigatorio = (d: Date) => d.toISOString();

/** Horário do FTP em português (Q37: o de produção, igual para todas as empresas). */
const CRON_DO_FTP = JOBS_DE_INGESTAO.find((j) => j.job === "sincronizar-ftp")?.cron ?? "";
const DESCRICAO_DA_AGENDA = `A cada minuto, exceto :00 e :30 (${CRON_DO_FTP} UTC)`;

/** Últimos ciclos e arquivos, relatórios esperados, fila pendente e se há aplicação rodando. */
export async function lerPipeline({
  empresaId,
  deps,
  servicos,
}: IngestaoDaEmpresa): Promise<SaidaDe<typeof c.pipeline>> {
  const dados = await deps.executar(async (r) => ({
    ciclos: await r.ultimosCiclos(10),
    arquivos: await r.ultimosArquivos(25),
    esperados: await r.relatoriosEsperados(),
  }));
  return {
    ciclos: dados.ciclos.map((x) => ({
      ...x,
      primeiroArquivoEm: isoObrigatorio(x.primeiroArquivoEm),
      ultimoArquivoEm: isoObrigatorio(x.ultimoArquivoEm),
      fechadoEm: iso(x.fechadoEm),
      aplicadoEm: iso(x.aplicadoEm),
    })),
    arquivos: dados.arquivos.map((a) => ({
      nomeArquivo: a.nomeArquivo,
      cicloChave: a.cicloChave,
      relatorio: a.relatorio,
      unidade: a.unidade,
      status: a.status,
      linhas: a.linhas,
      mensagem: a.mensagem,
      vistoEm: isoObrigatorio(a.vistoEm),
      importadoEm: iso(a.importadoEm),
    })),
    esperados: dados.esperados,
    filaPendente: await servicos.fila.contar(empresaId),
    aplicacaoRodando: await servicos.travas.ativa(travaDoCiclo(empresaId)),
  };
}

/**
 * Aplicação manual de um bloco. A de verdade não roda junto com o ciclo automático (mesma trava);
 * o romaneio pelo 036 só no último bloco, e a manual não roda as partes do 455 (spec §3.13).
 */
export async function aplicarManualmente(
  { empresaId, deps, servicos }: IngestaoDaEmpresa,
  pedido: { dryRun: boolean; limite: number; offset: number },
  usuarioId: string,
): Promise<SaidaDe<typeof c.aplicar>> {
  const { dryRun, limite, offset } = pedido;
  const token = dryRun
    ? null
    : await servicos.travas.adquirir(travaDoCiclo(empresaId), LEASE_DO_CICLO_MS);
  if (!dryRun && token === null) {
    throw new ErroDeNegocio(
      "CONFLITO",
      "A aplicação automática está rodando agora. Tente de novo em instantes.",
    );
  }
  try {
    const r = await aplicarBloco(deps, { dryRun, limite, offset, usuarioId });
    const temMais = dryRun ? r.processados === limite : r.pendentes > 0 && r.processados > 0;
    const romaneio036 = temMais ? null : (await aplicar036(deps, dryRun)).alterados;
    return { ...r, temMais, romaneio036 };
  } finally {
    if (token) await servicos.travas.liberar(travaDoCiclo(empresaId), token);
  }
}

export async function lerAplicacoes({
  deps,
}: IngestaoDaEmpresa): Promise<SaidaDe<typeof c.aplicacoes>> {
  const lista = await deps.executar((r) => r.ultimasAplicacoes(20));
  return {
    aplicacoes: lista.map(({ aplicadoPor: _, ...a }) => ({
      ...a,
      iniciadoEm: isoObrigatorio(a.iniciadoEm),
      finalizadoEm: iso(a.finalizadoEm),
    })),
  };
}

/** Situação da sincronização do FTP: pausa, agenda, trava, progresso e histórico. */
export async function lerFtp({
  empresaId,
  deps,
  servicos,
}: IngestaoDaEmpresa): Promise<SaidaDe<typeof c.ftp>> {
  const { config, historico } = await deps.executar(async (r) => ({
    config: await r.configuracoes(["ftp_sync_ativo"]),
    historico: await r.ultimasSincronizacoes(10),
  }));
  const p = await servicos.progressos.ler(empresaId);
  return {
    ativo: config.get("ftp_sync_ativo") !== "false",
    agenda: DESCRICAO_DA_AGENDA,
    travaAtiva: await servicos.travas.ativa(travaDoFtp(empresaId)),
    progresso: p && {
      ...p,
      iniciadoEm: iso(p.iniciadoEm),
      heartbeatEm: iso(p.heartbeatEm),
      finalizadoEm: iso(p.finalizadoEm),
    },
    historico: historico.map((h) => ({
      ...h,
      executadoEm: isoObrigatorio(h.executadoEm),
      finalizadoEm: iso(h.finalizadoEm),
    })),
  };
}

/**
 * "Rodar agora" ignora a pausa; singleton por empresa (disparo repetido é descartado). O job só
 * entra na fila depois que a auditoria foi gravada: se a transação falha, nada roda sem rastro.
 */
export async function rodarFtpAgora({ empresaId, deps, servicos }: IngestaoDaEmpresa) {
  await deps.executar((r) =>
    r.auditar({
      acao: "executar",
      entidade: "empresa_integracoes",
      entidadeId: "sftp",
      resumo: "Sincronização do FTP disparada",
      depois: {},
    }),
  );
  await servicos.enfileirador.enfileirar(
    filaDoJob("sincronizar-ftp"),
    "sincronizar-ftp",
    { empresaId, manual: true },
    { deduplicacao: idDeExecucao("sincronizar-ftp", empresaId) },
  );
}

export async function pausarOuRetomarFtp({ deps }: IngestaoDaEmpresa, ativo: boolean) {
  await deps.executar(async (r) => {
    await r.gravarConfiguracao("ftp_sync_ativo", String(ativo));
    await r.auditar({
      acao: ativo ? "retomar" : "pausar",
      entidade: "configuracoes",
      entidadeId: "ftp_sync_ativo",
      resumo: ativo ? "Sincronização do FTP retomada" : "Sincronização do FTP pausada",
      depois: { ativo },
    });
  });
}

export async function liberarTravaDoFtp({ empresaId, deps, servicos }: IngestaoDaEmpresa) {
  await servicos.travas.forcarLiberacao(travaDoFtp(empresaId));
  await servicos.progressos.limpar(empresaId);
  await deps.executar((r) =>
    r.auditar({
      acao: "liberar_trava",
      entidade: "empresa_integracoes",
      entidadeId: "sftp",
      resumo: "Trava do FTP liberada à mão",
      depois: {},
    }),
  );
}

/** XML enviado pela tela, em base64 (com ou sem o prefixo `data:`). */
export function importarXmlDaTela(
  { deps }: IngestaoDaEmpresa,
  arquivo: { nome: string; base64: string },
  agora: Date,
) {
  const { nome, base64 } = arquivo;
  const texto = base64.includes(",") ? (base64.split(",", 2)[1] ?? "") : base64;
  return importarArquivoXml(
    deps.executar,
    { nome, bytes: new Uint8Array(Buffer.from(texto, "base64")) },
    agora,
  );
}

export async function lerArquivosXml({
  deps,
}: IngestaoDaEmpresa): Promise<SaidaDe<typeof c.arquivosXml>> {
  const { arquivos, orfaos } = await deps.executar(async (r) => ({
    arquivos: await r.ultimosArquivosXml(50),
    orfaos: await r.estatisticasDosOrfaos(),
  }));
  return {
    arquivos: arquivos.map((a) => ({ ...a, criadoEm: isoObrigatorio(a.criadoEm) })),
    orfaos: { ...orfaos, maisAntigo: iso(orfaos.maisAntigo) },
  };
}
