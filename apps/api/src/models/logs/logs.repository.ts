import { comInstantes, type Sql, sql, type Transacao } from "@erp/db";

import {
  type AlteracaoGravada,
  type EscopoDosLogs,
  type Execucao,
  type RepositorioLogs,
} from "./logs.service";

/** `%` e `_` digitados são texto, não curinga. */
function trecho(texto: string): string {
  return `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function doEscopo(escopo: EscopoDosLogs): Sql {
  if (escopo.tipo === "empresa") return sql`and a.empresa_id = ${escopo.empresaId}`;
  if (escopo.tipo === "plataforma") return sql`and a.empresa_id is null`;
  return sql.vazio();
}

/** `and <coluna> >= de and <coluna> <= ate`, só com os limites dados. */
function noPeriodo(coluna: Sql, periodo: { de: Date | null; ate: Date | null }): Sql {
  const de = periodo.de ? sql`and ${coluna} >= ${periodo.de}` : sql.vazio();
  const ate = periodo.ate ? sql`and ${coluna} <= ${periodo.ate}` : sql.vazio();
  return sql`${de} ${ate}`;
}

/**
 * Como cada origem vira uma execução: a tabela, a coluna do "quando" (filtro e ordem), o "quando"
 * mostrado e os campos crus de `dados`.
 */
const ORIGENS: Record<
  Parameters<RepositorioLogs["execucoes"]>[1],
  { tabela: Sql; filtro: Sql; quando: Sql; status: Sql; erro: Sql; dados: Sql }
> = {
  sftp_xml: {
    tabela: sql`erp.xml_ftp_sincronizacoes`,
    filtro: sql`executado_em`,
    quando: sql`executado_em`,
    status: sql`status`,
    erro: sql`mensagem`,
    dados: sql`jsonb_build_object('arquivosProcessados', arquivos_processados,
      'ctesProcessados', ctes_processados, 'arquivosComErro', arquivos_com_erro,
      'disparadoPor', disparado_por)`,
  },
  relatorio_ssw: {
    tabela: sql`erp.ingestao_arquivos`,
    filtro: sql`visto_em`,
    quando: sql`coalesce(importado_em, visto_em)`,
    status: sql`status`,
    erro: sql`mensagem`,
    dados: sql`jsonb_build_object('relatorio', relatorio, 'nomeArquivo', nome_arquivo,
      'linhas', linhas)`,
  },
  aplicacao_ssw: {
    tabela: sql`erp.ingestao_aplicacoes`,
    filtro: sql`iniciado_em`,
    quando: sql`iniciado_em`,
    status: sql`status`,
    erro: sql`erro`,
    dados: sql`jsonb_build_object('inseridos', total_inseridos, 'atualizados', total_atualizados,
      'ocorrencias', total_ocorrencias, 'ignorados', total_ignorados, 'simulacao', simulacao)`,
  },
  ciclo_ssw: {
    tabela: sql`erp.ingestao_ciclos`,
    filtro: sql`primeiro_arquivo_em`,
    quando: sql`coalesce(aplicado_em, fechado_em, ultimo_arquivo_em, primeiro_arquivo_em)`,
    status: sql`status`,
    erro: sql`motivo`,
    dados: sql`jsonb_build_object('ciclo', ciclo_chave, 'arquivos', arquivos_importados,
      'linhas', linhas_importadas, 'faltantes', faltantes)`,
  },
  webhook_ssw: {
    tabela: sql`erp.ssw_webhook_eventos`,
    filtro: sql`recebido_em`,
    quando: sql`recebido_em`,
    // Mesma classificação da Ingestão SSW: rejeitado (auth/4xx), erro (5xx), sem vínculo (202).
    status: sql`case when not autenticado or status_http between 400 and 499 then 'rejeitado'
      when status_http >= 500 then 'erro' when status_http = 202 then 'sem vínculo'
      else 'processado' end`,
    erro: sql`coalesce(erro_processamento, motivo_rejeicao)`,
    dados: sql`jsonb_build_object('statusHttp', status_http, 'numero', coalesce(
      nullif(payload_bruto->'cte'->>'numeroCTe', ''),
      nullif(nullif(payload_bruto->'cte'->>'numeroSSW', ''), '0'),
      payload_bruto->'nf'->>'numeroNFe'))`,
  },
  xml_upload: {
    tabela: sql`erp.xml_cte_arquivos`,
    filtro: sql`criado_em`,
    quando: sql`criado_em`,
    status: sql`status`,
    erro: sql`erro_mensagem`,
    dados: sql`jsonb_build_object('nomeArquivo', nome_arquivo, 'tipo', tipo,
      'ctes', ctes_processados, 'cancelamentos', cancelamentos, 'pulados', xmls_pulados)`,
  },
  bi2: {
    tabela: sql`erp.bi2_sincronizacoes`,
    filtro: sql`iniciado_em`,
    quando: sql`iniciado_em`,
    status: sql`status`,
    erro: sql`erro`,
    dados: sql`jsonb_build_object('codigo', codigo_relatorio, 'dataAlvo', data_alvo,
      'modo', modo, 'linhas', total_linhas, 'criados', criados, 'atualizados', atualizados)`,
  },
};

export function criarRepositorioLogs(tx: Transacao): RepositorioLogs {
  return {
    auditoria: async (f) => {
      const linhas = comInstantes<Omit<AlteracaoGravada, "id"> & { id: string }>(
        await tx.consultar(sql`
          select a.id, a.empresa_id as "empresaId", e.nome as "empresaNome",
                 a.ator_email as "atorEmail", a.ator_tipo as "atorTipo", a.acao, a.entidade,
                 a.entidade_id as "entidadeId", a.resumo, a.antes, a.depois, a.ip,
                 a.criado_em as "criadoEm"
          from erp.auditoria a
          left join erp.empresas e on e.id = a.empresa_id
          where true ${doEscopo(f.escopo)}
            ${f.ator ? sql`and a.ator_email ilike ${trecho(f.ator)}` : sql.vazio()}
            ${f.entidade ? sql`and a.entidade = ${f.entidade}` : sql.vazio()}
            ${f.acao ? sql`and a.acao = ${f.acao}` : sql.vazio()}
            ${noPeriodo(sql`a.criado_em`, f)}
          order by a.criado_em desc, a.id desc
          limit ${f.limite}`),
        ["criadoEm"],
      );
      // bigint chega do pg em texto.
      return linhas.map((l) => ({ ...l, id: Number(l.id) }));
    },

    execucoes: async (empresaId, origem, periodo, limite) => {
      const o = ORIGENS[origem];
      return comInstantes<Execucao>(
        await tx.consultar(sql`
          select id::text as id, ${o.quando} as quando, ${o.status} as status, ${o.erro} as erro,
                 ${o.dados} as dados
          from ${o.tabela}
          where empresa_id = ${empresaId} ${noPeriodo(o.filtro, periodo)}
          order by ${o.filtro} desc
          limit ${limite}`),
        ["quando"],
      );
    },
  };
}
