import { comInstantes, sql, type Transacao } from "@erp/db";
import { type RegistroDeAuditoria } from "@erp/dominio/ocorrencias/codigos-admin";

import {
  type CodigoGravado,
  type RepositorioCodigosOcorrencia,
} from "./codigos-ocorrencia.service";

const SELECT_CODIGO = sql`
  select c.codigo, c.descricao, c.responsavel, c.penaliza,
         c.letra_responsavel as "letraResponsavel", c.ativo,
         c.pendente_classificacao as "pendenteClassificacao", c.notas, c.tipo_ssw as "tipoSsw",
         c.processo_ssw as "processoSsw", c.atualizado_em as "atualizadoEm",
         u.nome as "atualizadoPorNome"
  from erp.codigos_ocorrencia c
  left join erp.usuarios u on u.id = c.atualizado_por`;

export function criarRepositorioCodigosOcorrencia(tx: Transacao): RepositorioCodigosOcorrencia {
  return {
    listar: async (empresaId) =>
      comInstantes<CodigoGravado>(
        await tx.consultar(sql`
          ${SELECT_CODIGO} where c.empresa_id = ${empresaId} order by c.codigo`),
        ["atualizadoEm"],
      ),

    codigos: async (empresaId, codigos) =>
      comInstantes<CodigoGravado>(
        await tx.consultar(sql`
          ${SELECT_CODIGO}
          where c.empresa_id = ${empresaId} and c.codigo = any(${codigos}::int[])`),
        ["atualizadoEm"],
      ),

    ocorrenciasPorCodigo: async (empresaId, desde) => {
      const linhas = await tx.consultar<{ codigo: number; total: number }>(sql`
        select codigo, count(*)::int as total
        from erp.ocorrencias
        where empresa_id = ${empresaId} and data_hora >= ${desde} and not quarentena
        group by codigo`);
      return new Map(linhas.map((l) => [l.codigo, l.total]));
    },

    contarOcorrencias: async (empresaId, codigos) => {
      const [linha] = await tx.consultar<{ total: number }>(sql`
        select count(*)::int as total from erp.ocorrencias
        where empresa_id = ${empresaId} and codigo = any(${codigos}::int[])`);
      return linha?.total ?? 0;
    },

    gravar: async (empresaId, codigo, dados, usuarioId, agora) => {
      await tx.executar(sql`
        insert into erp.codigos_ocorrencia (empresa_id, codigo, descricao, responsavel, penaliza,
          letra_responsavel, ativo, pendente_classificacao, notas, atualizado_por, atualizado_em)
        values (${empresaId}, ${codigo}, ${dados.descricao}, ${dados.responsavel},
          ${dados.penaliza}, ${dados.letraResponsavel}, ${dados.ativo},
          ${dados.pendenteClassificacao}, ${dados.notas}, ${usuarioId}, ${agora})
        on conflict (empresa_id, codigo) do update set
          descricao = excluded.descricao, responsavel = excluded.responsavel,
          penaliza = excluded.penaliza, letra_responsavel = excluded.letra_responsavel,
          ativo = excluded.ativo, pendente_classificacao = excluded.pendente_classificacao,
          notas = excluded.notas, atualizado_por = excluded.atualizado_por,
          atualizado_em = excluded.atualizado_em`);
    },

    // origem: propagate_codigo_changes (sistema atual). Só regrava o que está diferente.
    propagarClassificacao: (empresaId, codigo) =>
      tx.executar(sql`
        update erp.ocorrencias o
        set penaliza = c.penaliza, responsavel = c.responsavel
        from erp.codigos_ocorrencia c
        where o.empresa_id = ${empresaId} and o.codigo = ${codigo}
          and c.empresa_id = o.empresa_id and c.codigo = o.codigo
          and (o.penaliza is distinct from c.penaliza
            or o.responsavel is distinct from c.responsavel)`),

    historico: async (empresaId, codigo, limite) =>
      comInstantes<RegistroDeAuditoria>(
        await tx.consultar(sql`
          select a.id::text as id, a.criado_em as "criadoEm", a.acao, a.antes, a.depois,
                 coalesce(u.nome, a.ator_email) as "autorNome"
          from erp.auditoria a
          left join erp.usuarios u on u.id = a.ator_id
          where a.empresa_id = ${empresaId} and a.entidade = 'codigo_ocorrencia'
            and a.entidade_id = ${String(codigo)}
          order by a.criado_em desc
          limit ${limite}`),
        ["criadoEm"],
      ),
  };
}
