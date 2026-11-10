/**
 * Telas de ingestão (Admin › Importação SSW e Admin › XML CT-e): só a equipe da Plataforma, na
 * empresa ativa. Spec 06 §3.13 (retomar/descartar/aplicar manual) e §5.
 */
import { ErroDeNegocio } from "@erp/dominio/erros";
import {
  AGENDA_DA_INGESTAO,
  aplicar036,
  aplicarBloco,
  descartarCiclo,
  FILAS_DA_INGESTAO,
  idDoJob,
  importarArquivoXml,
  importarRelatorioManual,
  JOBS_DA_INGESTAO,
  LEASE_DO_CICLO_MS,
  LIMITE_PADRAO_DOS_ORFAOS,
  reprocessarOrfaos,
  retomarCiclo,
  travaDoCiclo,
  travaDoFtp,
} from "@erp/ingestao/casos-de-uso";
import { contratosIngestao as c } from "@erp/shared/contratos/ingestao";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../../http/contexto";
import { exigirAdminPlataforma, exigirEmpresa } from "../../http/guardas";
import { atorDa } from "../../plugins/sessao";
import { dependenciasDaEmpresa, type ServicosDaIngestao } from "./servicos";

const LIMITE_COM_ARQUIVO = 64 * 1024 * 1024;
const soPlataforma = [exigirEmpresa, exigirAdminPlataforma];

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const isoObrigatorio = (d: Date) => d.toISOString();

/** Horário do FTP em português (Q37: o de produção, igual para todas as empresas). */
const DESCRICAO_DA_AGENDA = `A cada minuto, exceto :00 e :30 (${AGENDA_DA_INGESTAO.ftp})`;

export const rotasAdminDaIngestao: FastifyPluginCallbackZod<{
  servicos: ServicosDaIngestao;
  agora: () => Date;
}> = (app, { servicos, agora }, pronto) => {
  async function daEmpresa(request: FastifyRequest) {
    const { empresa } = await empresaDaRequisicao(request);
    const ator = await atorDa(request);
    return {
      empresaId: empresa.id,
      deps: dependenciasDaEmpresa(servicos, empresa.id, ator, agora),
    };
  }

  app.get(
    c.pipeline.caminho,
    { schema: { response: { 200: c.pipeline.saida } }, preHandler: soPlataforma },
    async (request) => {
      const { empresaId, deps } = await daEmpresa(request);
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
    },
  );

  app.post(
    c.retomarCiclo.caminho,
    {
      schema: { params: c.retomarCiclo.parametros, response: { 200: c.retomarCiclo.saida } },
      preHandler: soPlataforma,
    },
    async (request) => {
      const { deps } = await daEmpresa(request);
      return retomarCiclo(deps, request.params.chave);
    },
  );

  app.post(
    c.descartarCiclo.caminho,
    {
      schema: {
        params: c.descartarCiclo.parametros,
        body: c.descartarCiclo.entrada,
        response: { 200: c.descartarCiclo.saida },
      },
      preHandler: soPlataforma,
    },
    async (request) => {
      const { deps } = await daEmpresa(request);
      const r = await deps.executar((repo) =>
        descartarCiclo(repo, request.params.chave, request.body.motivo),
      );
      return { cicloChave: r.cicloChave, totalRemovido: r.totalRemovido };
    },
  );

  app.post(
    c.importarRelatorio.caminho,
    {
      bodyLimit: LIMITE_COM_ARQUIVO,
      schema: { body: c.importarRelatorio.entrada, response: { 200: c.importarRelatorio.saida } },
      preHandler: soPlataforma,
    },
    async (request) => {
      const { deps } = await daEmpresa(request);
      return importarRelatorioManual(deps.executar, request.body);
    },
  );

  app.post(
    c.aplicar.caminho,
    {
      schema: { body: c.aplicar.entrada, response: { 200: c.aplicar.saida } },
      preHandler: soPlataforma,
    },
    async (request) => {
      const { empresaId, deps } = await daEmpresa(request);
      const { dryRun, limite, offset } = request.body;
      // A aplicação de verdade não roda junto com o ciclo automático (mesma trava).
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
        const ator = await atorDa(request);
        const r = await aplicarBloco(deps, { dryRun, limite, offset, usuarioId: ator.usuarioId });
        const temMais = dryRun ? r.processados === limite : r.pendentes > 0 && r.processados > 0;
        // Romaneio pelo 036 só no último bloco; a manual não roda as partes do 455 (spec §3.13).
        const romaneio036 = temMais ? null : (await aplicar036(deps, dryRun)).alterados;
        return { ...r, temMais, romaneio036 };
      } finally {
        if (token) await servicos.travas.liberar(travaDoCiclo(empresaId), token);
      }
    },
  );

  app.get(
    c.aplicacoes.caminho,
    { schema: { response: { 200: c.aplicacoes.saida } }, preHandler: soPlataforma },
    async (request) => {
      const { deps } = await daEmpresa(request);
      const lista = await deps.executar((r) => r.ultimasAplicacoes(20));
      return {
        aplicacoes: lista.map(({ aplicadoPor: _, ...a }) => ({
          ...a,
          iniciadoEm: isoObrigatorio(a.iniciadoEm),
          finalizadoEm: iso(a.finalizadoEm),
        })),
      };
    },
  );

  app.get(
    c.ftp.caminho,
    { schema: { response: { 200: c.ftp.saida } }, preHandler: soPlataforma },
    async (request) => {
      const { empresaId, deps } = await daEmpresa(request);
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
    },
  );

  app.post(
    c.rodarFtp.caminho,
    { schema: { response: { 200: c.rodarFtp.saida } }, preHandler: soPlataforma },
    async (request) => {
      const { empresaId, deps } = await daEmpresa(request);
      // "Rodar agora" ignora a pausa; singleton por empresa (disparo repetido é descartado).
      await servicos.enfileirador.enfileirar(
        FILAS_DA_INGESTAO.ftp,
        JOBS_DA_INGESTAO.ftp,
        { empresaId, manual: true },
        { deduplicacao: idDoJob(JOBS_DA_INGESTAO.ftp, empresaId) },
      );
      await deps.executar((r) =>
        r.auditar({
          acao: "ingestao.ftp_rodar",
          entidade: "empresa_integracoes",
          entidadeId: "sftp",
          resumo: "Sincronização do FTP disparada",
          depois: {},
        }),
      );
      return { ok: true as const };
    },
  );

  app.post(
    c.pausarFtp.caminho,
    {
      schema: { body: c.pausarFtp.entrada, response: { 200: c.pausarFtp.saida } },
      preHandler: soPlataforma,
    },
    async (request) => {
      const { deps } = await daEmpresa(request);
      const { ativo } = request.body;
      await deps.executar(async (r) => {
        await r.gravarConfiguracao("ftp_sync_ativo", String(ativo));
        await r.auditar({
          acao: ativo ? "ingestao.ftp_retomar" : "ingestao.ftp_pausar",
          entidade: "configuracoes",
          entidadeId: "ftp_sync_ativo",
          resumo: ativo ? "Sincronização do FTP retomada" : "Sincronização do FTP pausada",
          depois: { ativo },
        });
      });
      return { ok: true as const };
    },
  );

  app.post(
    c.liberarTravaFtp.caminho,
    { schema: { response: { 200: c.liberarTravaFtp.saida } }, preHandler: soPlataforma },
    async (request) => {
      const { empresaId, deps } = await daEmpresa(request);
      await servicos.travas.forcarLiberacao(travaDoFtp(empresaId));
      await servicos.progressos.limpar(empresaId);
      await deps.executar((r) =>
        r.auditar({
          acao: "ingestao.ftp_liberar_trava",
          entidade: "empresa_integracoes",
          entidadeId: "sftp",
          resumo: "Trava do FTP liberada à mão",
          depois: {},
        }),
      );
      return { ok: true as const };
    },
  );

  app.post(
    c.importarXml.caminho,
    {
      bodyLimit: LIMITE_COM_ARQUIVO,
      schema: { body: c.importarXml.entrada, response: { 200: c.importarXml.saida } },
      preHandler: soPlataforma,
    },
    async (request) => {
      const { deps } = await daEmpresa(request);
      const { nome, base64 } = request.body;
      const texto = base64.includes(",") ? (base64.split(",", 2)[1] ?? "") : base64;
      return importarArquivoXml(
        deps.executar,
        { nome, bytes: new Uint8Array(Buffer.from(texto, "base64")) },
        agora(),
      );
    },
  );

  app.get(
    c.arquivosXml.caminho,
    { schema: { response: { 200: c.arquivosXml.saida } }, preHandler: soPlataforma },
    async (request) => {
      const { deps } = await daEmpresa(request);
      const { arquivos, orfaos } = await deps.executar(async (r) => ({
        arquivos: await r.ultimosArquivosXml(50),
        orfaos: await r.estatisticasDosOrfaos(),
      }));
      return {
        arquivos: arquivos.map((a) => ({ ...a, criadoEm: isoObrigatorio(a.criadoEm) })),
        orfaos: { ...orfaos, maisAntigo: iso(orfaos.maisAntigo) },
      };
    },
  );

  app.post(
    c.reprocessarOrfaos.caminho,
    { schema: { response: { 200: c.reprocessarOrfaos.saida } }, preHandler: soPlataforma },
    async (request) => {
      const { deps } = await daEmpresa(request);
      return reprocessarOrfaos(deps.executar, LIMITE_PADRAO_DOS_ORFAOS, agora());
    },
  );

  pronto();
};
