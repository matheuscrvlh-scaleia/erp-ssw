/** XML CT-e, BI2 e SSW (de-para "XML CT-e, BI2, SSW"), com as retenções do modelo. */
import {
  bi2Bruto,
  bi2Sincronizacoes,
  sswSincronizacoes,
  sswWebhookEventos,
  xmlCteArquivos,
  xmlCteItens,
  xmlCteOrfaos,
  xmlFtpSincronizacoes,
} from "@erp/db/schema";

import { definirTabela, descartar, migrar, semApoio } from "../motor/tipos";
import { daLista, disparadoPor } from "../transformacoes/diversas";
import { smallint } from "../transformacoes/numeros";
import {
  daEmpresa,
  ESCOPO_DA_EMPRESA,
  nosUltimosDias,
  ou,
  PELO_ID,
  referenciaEmpresa,
  referenciaPorId,
} from "./comum";

const DIAS_DE_XML = 180;
const DIAS_DE_EXECUCAO = 90;
const DIAS_DE_BI2 = 400;
const DIAS_DE_ORFAO_RESOLVIDO = 30;

interface OrigemXmlArquivo {
  id: string;
  nome_arquivo: string;
  sha256: string;
  tipo: string;
  status: string;
  erro_mensagem: string | null;
  ctrcs_processados: number | null;
  cancelamentos: number | null;
  xmls_pulados: number | null;
  created_at: string;
  empresa_id: string;
}

export const passoXmlCteArquivos = definirTabela({
  nome: "xml_cte_arquivos",
  origem: "public.xml_cte_arquivos_processados (180 dias)",
  tabela: xmlCteArquivos,
  consulta: {
    colunas: "o.*",
    de: "public.xml_cte_arquivos_processados o",
    onde: [daEmpresa("o.empresa_id"), nosUltimosDias("o.created_at", DIAS_DE_XML)],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemXmlArquivo) => o.id,
  preparar: semApoio,
  transformar: (o) =>
    migrar({
      id: o.id,
      empresaId: o.empresa_id,
      nomeArquivo: o.nome_arquivo,
      sha256: o.sha256,
      tipo: daLista(o.tipo, ["zip", "xml"] as const, "tipo"),
      status: daLista(o.status, ["sucesso", "erro", "parcial", "duplicado"] as const, "status"),
      erroMensagem: o.erro_mensagem,
      ctesProcessados: ou(o.ctrcs_processados, 0),
      cancelamentos: ou(o.cancelamentos, 0),
      xmlsPulados: ou(o.xmls_pulados, 0),
      criadoEm: o.created_at,
    }),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(xmlCteArquivos, "empresaId")],
});

interface OrigemXmlItem {
  id: string;
  arquivo_id: string | null;
  sha256_xml: string;
  nome_xml: string;
  tipo: string;
  status: string;
  numero_ctrc: string | null;
  chave_cte: string | null;
  erro_mensagem: string | null;
  created_at: string;
  empresa_id: string;
}

export const passoXmlCteItens = definirTabela({
  nome: "xml_cte_itens",
  origem: "public.xml_cte_itens_processados (180 dias)",
  tabela: xmlCteItens,
  consulta: {
    colunas: "o.*",
    de: "public.xml_cte_itens_processados o",
    onde: [daEmpresa("o.empresa_id"), nosUltimosDias("o.created_at", DIAS_DE_XML)],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemXmlItem) => o.id,
  preparar: semApoio,
  transformar: (o) =>
    migrar({
      id: o.id,
      empresaId: o.empresa_id,
      arquivoId: o.arquivo_id,
      sha256Xml: o.sha256_xml,
      nomeXml: o.nome_xml,
      tipo: daLista(o.tipo, ["cte", "can", "unknown"] as const, "tipo"),
      status: daLista(o.status, ["sucesso", "erro", "orfao"] as const, "status"),
      numeroCte: o.numero_ctrc,
      chaveCte: o.chave_cte,
      erroMensagem: o.erro_mensagem,
      criadoEm: o.created_at,
    }),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    referenciaEmpresa(xmlCteItens, "empresaId"),
    referenciaPorId(xmlCteItens, "arquivoId", "erp.xml_cte_arquivos", {
      anular: "arquivoId",
      motivo: "arquivo fora da janela de 180 dias (vira nulo)",
    }),
  ],
});

interface OrigemOrfao {
  id: string;
  sha256_xml: string;
  nome_xml: string;
  tipo: string;
  chave_cte: string | null;
  xml_conteudo: string;
  status: string | null;
  tentativas: number | null;
  ultima_tentativa: string | null;
  ultimo_erro: string | null;
  casado_em: string | null;
  numero_ctrc: string | null;
  expira_em: string | null;
  created_at: string;
  updated_at: string | null;
  empresa_id: string;
}

export const passoXmlCteOrfaos = definirTabela({
  nome: "xml_cte_orfaos",
  origem: "public.xml_cte_orfaos (pendentes + resolvidos de 30 dias)",
  tabela: xmlCteOrfaos,
  consulta: {
    colunas: "o.*",
    de: "public.xml_cte_orfaos o",
    onde: [
      daEmpresa("o.empresa_id"),
      `coalesce(o.status, 'pendente') = 'pendente'
        or ${nosUltimosDias("coalesce(o.updated_at, o.created_at)", DIAS_DE_ORFAO_RESOLVIDO)}`,
    ],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemOrfao) => o.id,
  preparar: semApoio,
  transformar: (o) => {
    if (o.expira_em === null) return descartar("órfão sem data de expiração");
    return migrar({
      id: o.id,
      empresaId: o.empresa_id,
      sha256Xml: o.sha256_xml,
      nomeXml: o.nome_xml,
      tipo: daLista(o.tipo, ["cte", "can"] as const, "tipo"),
      chaveCte: o.chave_cte,
      numeroCte: o.numero_ctrc,
      xmlConteudo: o.xml_conteudo,
      status: daLista(
        o.status ?? "pendente",
        ["pendente", "casado", "expirado"] as const,
        "status",
      ),
      tentativas: ou(o.tentativas, 0),
      ultimaTentativa: o.ultima_tentativa,
      ultimoErro: o.ultimo_erro,
      casadoEm: o.casado_em,
      expiraEm: o.expira_em,
      criadoEm: o.created_at,
      atualizadoEm: o.updated_at ?? o.created_at,
    });
  },
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(xmlCteOrfaos, "empresaId")],
});

interface OrigemFtpXml {
  id: string;
  executado_em: string;
  finalizado_em: string | null;
  status: string;
  triggered_by: string | null;
  arquivos_processados: number | null;
  arquivos_removidos: number | null;
  arquivos_com_erro: number | null;
  ctrcs_processados: number | null;
  duracao_ms: number | null;
  mensagem: string | null;
  erros: string | null;
  arquivos_movidos: number | null;
  pastas_limpas: number | null;
  empresa_id: string;
}

export const passoXmlFtpSincronizacoes = definirTabela({
  nome: "xml_ftp_sincronizacoes",
  origem: "public.ftp_xml_sync_log (90 dias)",
  tabela: xmlFtpSincronizacoes,
  consulta: {
    colunas: "o.*",
    de: "public.ftp_xml_sync_log o",
    onde: [daEmpresa("o.empresa_id"), nosUltimosDias("o.executado_em", DIAS_DE_EXECUCAO)],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemFtpXml) => o.id,
  preparar: semApoio,
  transformar: (o) =>
    migrar({
      id: o.id,
      empresaId: o.empresa_id,
      executadoEm: o.executado_em,
      finalizadoEm: o.finalizado_em,
      status: daLista(o.status, ["ok", "parcial", "erro", "pausado"] as const, "status"),
      disparadoPor: disparadoPor(
        o.triggered_by,
        ["agendamento", "manual"] as const,
        "triggered_by",
      ),
      arquivosProcessados: ou(o.arquivos_processados, 0),
      arquivosRemovidos: ou(o.arquivos_removidos, 0),
      arquivosMovidos: ou(o.arquivos_movidos, 0),
      pastasLimpas: ou(o.pastas_limpas, 0),
      arquivosComErro: ou(o.arquivos_com_erro, 0),
      ctesProcessados: ou(o.ctrcs_processados, 0),
      duracaoMs: ou(o.duracao_ms, 0),
      mensagem: o.mensagem,
      erros: o.erros ?? "[]",
    }),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(xmlFtpSincronizacoes, "empresaId")],
});

interface OrigemBi2 {
  numero_ctrc: string;
  data_alvo: string;
  codigo_relatorio: string;
  payload: string;
  atualizado_em: string | null;
  empresa_id: string;
}

/** Último payload por CT-e e relatório: sem retenção por tempo. */
export const passoBi2Bruto = definirTabela({
  nome: "bi2_bruto",
  origem: "public.bi2_raw",
  tabela: bi2Bruto,
  consulta: {
    colunas: "o.*",
    de: "public.bi2_raw o",
    onde: [daEmpresa("o.empresa_id")],
    chave: [
      { expressao: "o.empresa_id", tipo: "uuid" },
      { expressao: "o.numero_ctrc", tipo: "text" },
      { expressao: "o.codigo_relatorio", tipo: "text" },
    ],
  },
  chaveDaLinha: (o: OrigemBi2) => `${o.codigo_relatorio}:${o.numero_ctrc}`,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    migrar({
      empresaId: o.empresa_id,
      numero: o.numero_ctrc,
      codigoRelatorio: o.codigo_relatorio,
      dataAlvo: o.data_alvo,
      payload: o.payload,
      atualizadoEm: o.atualizado_em ?? filtros.instante,
    }),
  conflito: ["empresaId", "numero", "codigoRelatorio"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(bi2Bruto, "empresaId")],
});

interface OrigemBi2Log {
  id: string;
  data_alvo: string;
  modo: string | null;
  status: string | null;
  total_linhas: number | null;
  criados: number | null;
  atualizados: number | null;
  erro: string | null;
  iniciado_em: string;
  finalizado_em: string | null;
  codigo_relatorio: string | null;
  data_fechamento_ssw: string | null;
  empresa_id: string;
}

export const passoBi2Sincronizacoes = definirTabela({
  nome: "bi2_sincronizacoes",
  origem: "public.bi2_sync_log (400 dias)",
  tabela: bi2Sincronizacoes,
  consulta: {
    colunas: "o.*",
    de: "public.bi2_sync_log o",
    onde: [daEmpresa("o.empresa_id"), nosUltimosDias("o.iniciado_em", DIAS_DE_BI2)],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemBi2Log) => o.id,
  preparar: semApoio,
  transformar: (o) =>
    o.codigo_relatorio === null
      ? descartar("execução sem código de relatório")
      : migrar({
          id: o.id,
          empresaId: o.empresa_id,
          codigoRelatorio: o.codigo_relatorio,
          dataAlvo: o.data_alvo,
          dataFechamentoSsw: o.data_fechamento_ssw,
          modo: ou(o.modo, "manual"),
          status: ou(o.status, "ok"),
          totalLinhas: ou(o.total_linhas, 0),
          criados: ou(o.criados, 0),
          atualizados: ou(o.atualizados, 0),
          erro: o.erro,
          iniciadoEm: o.iniciado_em,
          finalizadoEm: o.finalizado_em,
        }),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(bi2Sincronizacoes, "empresaId")],
});

interface OrigemWebhook {
  id: string;
  recebido_em: string;
  ip: string | null;
  user_agent: string | null;
  auth_ok: boolean | null;
  motivo_rejeicao: string | null;
  status_http: number;
  payload_bruto: string | null;
  ctrc_id: string | null;
  ocorrencia_id: string | null;
  erro_processamento: string | null;
  empresa_id: string | null;
}

export const passoSswWebhookEventos = definirTabela({
  nome: "ssw_webhook_eventos",
  origem: "public.ssw_webhook_eventos (90 dias)",
  tabela: sswWebhookEventos,
  consulta: {
    colunas: "o.*",
    de: "public.ssw_webhook_eventos o",
    onde: [daEmpresa("o.empresa_id"), nosUltimosDias("o.recebido_em", DIAS_DE_EXECUCAO)],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemWebhook) => o.id,
  preparar: semApoio,
  transformar: (o) =>
    o.empresa_id === null
      ? descartar("empresa_id nulo (aviso rejeitado antes de achar a empresa)")
      : migrar({
          id: o.id,
          empresaId: o.empresa_id,
          recebidoEm: o.recebido_em,
          ip: o.ip,
          userAgent: o.user_agent,
          autenticado: ou(o.auth_ok, false),
          motivoRejeicao: o.motivo_rejeicao,
          statusHttp: smallint(o.status_http, "status_http") ?? o.status_http,
          payloadBruto: o.payload_bruto,
          // O sistema atual não guarda o resumo do token: evento antigo recusado não é reprocessado.
          tokenSha256: null,
          cteId: o.ctrc_id,
          ocorrenciaId: o.ocorrencia_id,
          erroProcessamento: o.erro_processamento,
        }),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    referenciaEmpresa(sswWebhookEventos, "empresaId"),
    referenciaPorId(sswWebhookEventos, "cteId", "erp.ctes", {
      anular: "cteId",
      motivo: "CT-e não migrou (vira nulo)",
    }),
    referenciaPorId(sswWebhookEventos, "ocorrenciaId", "erp.ocorrencias", {
      anular: "ocorrenciaId",
      motivo: "ocorrência não migrou (vira nula)",
    }),
  ],
});

interface OrigemSyncLog {
  id: string;
  executado_em: string;
  modo: string;
  status: string;
  ctrcs_processados: number | null;
  ocorrencias_processadas: number | null;
  duracao_ms: number | null;
  erros: string | null;
  mensagem: string | null;
  triggered_by: string | null;
  finalizado_em: string | null;
  empresa_id: string;
}

export const passoSswSincronizacoes = definirTabela({
  nome: "ssw_sincronizacoes",
  origem: "public.sync_log (90 dias)",
  tabela: sswSincronizacoes,
  consulta: {
    colunas: `o.id, o.executado_em, o.modo, o.status, o.ctrcs_processados, o.ocorrencias_processadas,
      o.duracao_ms, o.erros, o.mensagem, o.triggered_by, o.finalizado_em, o.empresa_id`,
    de: "public.sync_log o",
    onde: [daEmpresa("o.empresa_id"), nosUltimosDias("o.executado_em", DIAS_DE_EXECUCAO)],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemSyncLog) => o.id,
  preparar: semApoio,
  transformar: (o) =>
    migrar({
      id: o.id,
      empresaId: o.empresa_id,
      modo: daLista(o.modo, ["historico", "delta"] as const, "modo"),
      status: daLista(o.status, ["ok", "erro", "parcial", "em_andamento"] as const, "status"),
      disparadoPor: disparadoPor(
        o.triggered_by,
        ["agendamento", "manual", "api"] as const,
        "triggered_by",
      ),
      executadoEm: o.executado_em,
      finalizadoEm: o.finalizado_em,
      ctesProcessados: ou(o.ctrcs_processados, 0),
      ocorrenciasProcessadas: ou(o.ocorrencias_processadas, 0),
      duracaoMs: ou(o.duracao_ms, 0),
      mensagem: o.mensagem,
      erros: o.erros ?? "[]",
    }),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(sswSincronizacoes, "empresaId")],
});
