import { sql, type Transacao } from "@erp/db";

import { comoCte } from "../cte/cte.repository";
import { type RepositorioRecalculo } from "./recalculation.service";

export function criarRepositorioRecalculo(tx: Transacao): RepositorioRecalculo {
  return {
    propagarClassificacao: (empresaId, codigo, limite) => {
      const divergem = sql`
        c.empresa_id = o.empresa_id and c.codigo = o.codigo
        and (o.penaliza is distinct from c.penaliza or o.responsavel is distinct from c.responsavel)`;
      return tx.executar(sql`
        update erp.ocorrencias o
        set penaliza = c.penaliza, responsavel = c.responsavel
        from erp.codigos_ocorrencia c
        where o.id in (
            select o.id from erp.ocorrencias o
            join erp.codigos_ocorrencia c on ${divergem}
            where o.empresa_id = ${empresaId} and o.codigo = ${codigo}
            limit ${limite})
          and ${divergem}`);
    },

    ctesDoCodigo: async (empresaId, codigo, aposId, limite) => {
      const linhas = await tx.consultar(sql`
        select * from erp.ctes
        where empresa_id = ${empresaId}
          and (${aposId}::uuid is null or id > ${aposId})
          and (ocorr_efetiva_codigo_num = ${codigo}
            or exists (select 1 from erp.ocorrencias o
                       where o.empresa_id = ${empresaId} and o.cte_id = ctes.id
                         and o.codigo = ${codigo}))
        order by id
        limit ${limite}`);
      return linhas.map(comoCte);
    },
  };
}
