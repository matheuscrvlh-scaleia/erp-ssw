/**
 * Leituras das telas de ingestão nas tabelas que o worker-ssw grava (ADR 0012). Toda consulta leva
 * a empresa (além do RLS).
 */
import { comInstantes, sql, type Transacao } from "@erp/db";
import { configuracoesVigentes } from "@erp/dominio/configuracoes";

import { type ArquivoLido, type CicloLido, type RepositorioIngestao } from "./ingestao.service";

const FTP_ATIVO = "ftp_sync_ativo";

type Retorno<K extends keyof RepositorioIngestao> = Awaited<ReturnType<RepositorioIngestao[K]>>;

/** jsonb `faltantes` e `totais` podem vir em qualquer formato: só lista e objeto valem. */
type LinhaDoCiclo = Omit<CicloLido, "faltantes" | "totais"> & {
  faltantes: unknown;
  totais: unknown;
};

function comoCiclo(c: LinhaDoCiclo): CicloLido {
  return {
    ...c,
    faltantes: Array.isArray(c.faltantes) ? c.faltantes.map(String) : [],
    totais:
      typeof c.totais === "object" && c.totais !== null && !Array.isArray(c.totais)
        ? (c.totais as Record<string, unknown>)
        : {},
  };
}

export function criarRepositorioIngestao(tx: Transacao): RepositorioIngestao {
  return {
    async ultimosCiclos(empresaId, limite) {
      const linhas = comInstantes<LinhaDoCiclo>(
        await tx.consultar(sql`
          select ciclo_chave as "cicloChave", status, motivo, faltantes, totais,
                 arquivos_importados as "arquivosImportados",
                 linhas_importadas as "linhasImportadas",
                 primeiro_arquivo_em as "primeiroArquivoEm",
                 ultimo_arquivo_em as "ultimoArquivoEm", fechado_em as "fechadoEm",
                 aplicado_em as "aplicadoEm"
          from erp.ingestao_ciclos
          where empresa_id = ${empresaId}
          order by ciclo_chave desc
          limit ${limite}`),
        ["primeiroArquivoEm", "ultimoArquivoEm", "fechadoEm", "aplicadoEm"],
      );
      return linhas.map(comoCiclo);
    },

    ultimosArquivos: async (empresaId, limite) =>
      comInstantes<ArquivoLido>(
        await tx.consultar(sql`
          select nome_arquivo as "nomeArquivo", ciclo_chave as "cicloChave", relatorio, unidade,
                 status, linhas, mensagem, visto_em as "vistoEm", importado_em as "importadoEm"
          from erp.ingestao_arquivos
          where empresa_id = ${empresaId}
          order by visto_em desc
          limit ${limite}`),
        ["vistoEm", "importadoEm"],
      ),

    relatoriosEsperados: (empresaId) =>
      tx.consultar(sql`
        select relatorio, por_unidade as "porUnidade", unidades_esperadas as "unidadesEsperadas",
               obrigatorio_no_ciclo as "obrigatorioNoCiclo", ativo
        from erp.ingestao_relatorios_esperados
        where empresa_id = ${empresaId}`),

    ultimasAplicacoes: async (empresaId, limite) =>
      comInstantes<Retorno<"ultimasAplicacoes">[number]>(
        await tx.consultar(sql`
          select id, status, simulacao, total_inseridos as "totalInseridos",
                 total_atualizados as "totalAtualizados",
                 total_ocorrencias as "totalOcorrencias", total_ignorados as "totalIgnorados",
                 erro, iniciado_em as "iniciadoEm", finalizado_em as "finalizadoEm"
          from erp.ingestao_aplicacoes
          where empresa_id = ${empresaId}
          order by iniciado_em desc
          limit ${limite}`),
        ["iniciadoEm", "finalizadoEm"],
      ),

    async ftpAtivo(empresaId) {
      const linhas = await tx.consultar<{ empresaId: string | null; chave: string; valor: string }>(
        sql`
          select empresa_id as "empresaId", chave, valor from erp.configuracoes
          where chave = ${FTP_ATIVO} and (empresa_id = ${empresaId} or empresa_id is null)`,
      );
      return configuracoesVigentes(linhas).get(FTP_ATIVO) !== "false";
    },

    async ultimasSincronizacoes(empresaId, limite) {
      const linhas = comInstantes<
        Omit<Retorno<"ultimasSincronizacoes">[number], "erros"> & { erros: unknown }
      >(
        await tx.consultar(sql`
          select executado_em as "executadoEm", finalizado_em as "finalizadoEm", status,
                 disparado_por as "disparadoPor", arquivos_processados as "arquivosProcessados",
                 arquivos_movidos as "arquivosMovidos", pastas_limpas as "pastasLimpas",
                 arquivos_com_erro as "arquivosComErro", duracao_ms as "duracaoMs", mensagem,
                 erros
          from erp.xml_ftp_sincronizacoes
          where empresa_id = ${empresaId}
          order by executado_em desc
          limit ${limite}`),
        ["executadoEm", "finalizadoEm"],
      );
      return linhas.map((l) => ({
        ...l,
        erros: Array.isArray(l.erros) ? l.erros.map(String) : [],
      }));
    },

    ultimosArquivosXml: async (empresaId, limite) =>
      comInstantes<Retorno<"ultimosArquivosXml">[number]>(
        await tx.consultar(sql`
          select id, nome_arquivo as "nomeArquivo", tipo, status,
                 erro_mensagem as "erroMensagem", ctes_processados as "ctesProcessados",
                 cancelamentos, xmls_pulados as "xmlsPulados", criado_em as "criadoEm"
          from erp.xml_cte_arquivos
          where empresa_id = ${empresaId}
          order by criado_em desc
          limit ${limite}`),
        ["criadoEm"],
      ),

    async estatisticasDosOrfaos(empresaId) {
      const [r] = await tx.consultar<{
        pendentes: number;
        expirados: number;
        casados: number;
        maisAntigo: string | null;
      }>(sql`
        select count(*) filter (where status = 'pendente')::int as pendentes,
               count(*) filter (where status = 'expirado')::int as expirados,
               count(*) filter (where status = 'casado')::int as casados,
               min(criado_em) filter (where status = 'pendente') as "maisAntigo"
        from erp.xml_cte_orfaos
        where empresa_id = ${empresaId}`);
      return {
        pendentes: r?.pendentes ?? 0,
        expirados: r?.expirados ?? 0,
        casados: r?.casados ?? 0,
        maisAntigo: r?.maisAntigo ? new Date(r.maisAntigo) : null,
      };
    },
  };
}
