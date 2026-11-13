import { comInstantes, sql, type Transacao, valoresDeInsercao } from "@erp/db";
import {
  CODIGO_CHEGADA_NA_UNIDADE,
  type OcorrenciaDoCte,
  type RegraDePrazo,
} from "@erp/domain/core";

import {
  type CteDoRecalculo,
  FONTES_DE_REGRA,
  type RepositorioPrazosDoJob,
} from "./deadline-recalculation.service";

export function criarRepositorioPrazosDoJob(tx: Transacao): RepositorioPrazosDoJob {
  return {
    regras: async (empresaId) =>
      comInstantes<RegraDePrazo>(
        await tx.consultar(sql`
          select id, tipo, unidade_codigo as "unidadeCodigo",
                 unidade_destino_codigo as "unidadeDestinoCodigo", parceiro_cnpj as "parceiroCnpj",
                 prazo_horas as "prazoHoras", prazo_dias as "prazoDias", ativo,
                 criado_em as "criadoEm"
          from erp.prazos_configurados where empresa_id = ${empresaId}`),
        ["criadoEm"],
      ),

    candidatos: async (empresaId, filtro, aposId, limite) => {
      const parceiros =
        filtro.parceiros.length > 0
          ? sql`or parceiro_cnpj = any(${filtro.parceiros}::text[])`
          : sql.vazio();
      const filiais =
        filtro.filiais.length > 0 ? sql`or filial = any(${filtro.filiais}::text[])` : sql.vazio();
      return comInstantes<CteDoRecalculo>(
        await tx.consultar(sql`
          select id, parceiro_cnpj as "parceiroCnpj", filial, data_emissao as "dataEmissao",
                 data_prevista_entrega as "dataPrevistaEntrega", prazo_fonte as "prazoFonte",
                 data_base_prazo as "dataBasePrazo", previsao_ssw_data as "previsaoSswData",
                 previsao_ssw_fonte as "previsaoSswFonte",
                 previsao_ssw_data_base as "previsaoSswDataBase"
          from erp.ctes
          where empresa_id = ${empresaId}
            ${aposId ? sql`and id > ${aposId}` : sql.vazio()}
            and (prazo_fonte = any(${[...FONTES_DE_REGRA]}::text[]) ${parceiros} ${filiais})
          order by id
          limit ${limite}`),
        ["dataBasePrazo", "previsaoSswDataBase"],
      );
    },

    chegadas: async (empresaId, cteIds) => {
      const porCte = new Map<string, OcorrenciaDoCte[]>();
      if (cteIds.length === 0) return porCte;
      const linhas = comInstantes<OcorrenciaDoCte & { cteId: string }>(
        await tx.consultar(sql`
          select cte_id as "cteId", id, codigo, descricao, data_hora as "dataHora", filial,
                 origem, quarentena, criado_em as "criadoEm"
          from erp.ocorrencias
          where empresa_id = ${empresaId} and codigo = ${CODIGO_CHEGADA_NA_UNIDADE}
            and cte_id = any(${cteIds}::uuid[])`),
        ["dataHora", "criadoEm"],
      );
      for (const { cteId, ...ocorrencia } of linhas) {
        porCte.set(cteId, [...(porCte.get(cteId) ?? []), ocorrencia]);
      }
      return porCte;
    },

    gravar: async (empresaId, novas) => {
      for (const n of novas) {
        await tx.executar(sql`
          update erp.ctes
          set data_prevista_entrega = ${n.dataPrevistaEntrega}, prazo_fonte = ${n.prazoFonte},
              data_base_prazo = ${n.dataBasePrazo}, previsao_ssw_data = ${n.previsaoSswData},
              previsao_ssw_fonte = ${n.previsaoSswFonte},
              previsao_ssw_data_base = ${n.previsaoSswDataBase}, atualizado_em = now()
          where empresa_id = ${empresaId} and id = ${n.cteId}`);
      }
      const historico = novas.flatMap((n) =>
        n.troca ? [{ empresaId, cteId: n.cteId, ...n.troca }] : [],
      );
      if (historico.length === 0) return;
      await tx.executar(sql`insert into erp.cte_prazo_historico ${valoresDeInsercao(historico)}`);
    },
  };
}
