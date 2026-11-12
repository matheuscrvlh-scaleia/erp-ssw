import { atribuicoes, type Sql, sql, type Transacao, valoresDeInsercao } from "@erp/db";
import { decimalEmUnidades, type SituacaoPrevista } from "@erp/dominio/ranking";
import { type Regra } from "@erp/shared/contratos/ranking";

import { ondeDoFiltro } from "../performance/consultas";
import { type ConsultaDoRanking, type RepositorioRanking } from "./ranking.service";

/** Teto da lista de CT-e para atribuir (igual a hoje). */
const LIMITE_PARA_ATRIBUIR = 500;

type Retorno<K extends keyof RepositorioRanking> = Awaited<ReturnType<RepositorioRanking[K]>>;

const SELECT_EQUIPE = sql`
  select id, nome, unidade_id as "unidadeId", ativo, token_publico_hash as "tokenPublicoHash",
         token_publico_revogado as "tokenPublicoRevogado"
  from erp.equipes`;

const SELECT_MEMBRO = sql`
  select id, equipe_id as "equipeId", nome, papel, cpf, posicao, data_saida as "dataSaida"
  from erp.equipe_membros`;

/** `c` = `erp.ctes`, o apelido que o `WHERE` da Performance espera. */
function chaveDoGrupo(grupo: "pagador" | "cidade"): Sql {
  return grupo === "cidade"
    ? sql`upper(btrim(coalesce(c.cidade_destino, '')))`
    : sql`coalesce(c.pagador_cnpj_digitos, '')`;
}

/** Universo e filtros da Performance, só os CT-e com chave do grupo. */
function ondeDoRanking({ filtro, contexto }: ConsultaDoRanking, chave: Sql): Sql {
  return sql`${ondeDoFiltro(filtro, contexto)} and ${chave} <> ''`;
}

interface LinhaDaRegra {
  id: string;
  nome: string;
  descricao: string | null;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  ativo: boolean;
}

interface LinhaDoCriterio {
  id: string;
  regraId: string;
  criterio: Regra["criterios"][number]["criterio"];
  parametros: unknown;
  ordem: number;
}

export function criarRepositorioRanking(tx: Transacao): RepositorioRanking {
  const regrasCom = async (condicao: Sql): Promise<Regra[]> => {
    const linhas = await tx.consultar<LinhaDaRegra>(sql`
      select id, nome, descricao, vigencia_inicio as "vigenciaInicio",
             vigencia_fim as "vigenciaFim", ativo
      from erp.bonificacao_regras
      where ${condicao}
      order by vigencia_inicio desc, nome asc`);
    if (linhas.length === 0) return [];
    const criterios = await tx.consultar<LinhaDoCriterio>(sql`
      select id, regra_id as "regraId", criterio, parametros, ordem
      from erp.bonificacao_regra_criterios
      where regra_id = any(${linhas.map((l) => l.id)}::uuid[])
      order by ordem asc, criado_em asc`);
    return linhas.map((r) => ({
      ...r,
      criterios: criterios
        .filter((c) => c.regraId === r.id)
        .map((c) => ({
          id: c.id,
          criterio: c.criterio,
          parametros: parametrosGravados(c.parametros),
          ordem: c.ordem,
        })),
    }));
  };

  return {
    filiaisProprias: async (empresaId) =>
      (
        await tx.consultar<{ sigla: string }>(sql`
          select sigla from erp.filiais where empresa_id = ${empresaId} and propria`)
      ).map((f) => f.sigla),

    codigosBaixa: async (empresaId) =>
      (
        await tx.consultar<{ codigo: number }>(sql`
          select codigo from erp.codigos_ocorrencia
          where empresa_id = ${empresaId} and tipo_ssw = 'BAIXA'`)
      ).map((c) => c.codigo),

    baldes: async (consulta, grupo) => {
      const chave = chaveDoGrupo(grupo);
      const linhas = await tx.consultar<{
        chave: string;
        temDataEntrega: boolean;
        codigoEfetivo: number | null;
        noPrazo: boolean | null;
        responsabilidadeCliente: boolean | null;
        prevista: SituacaoPrevista;
        quantidade: number;
        peso: string | null;
        volumes: string | null;
        frete: string | null;
      }>(sql`
        select ${chave} as chave, c.data_entrega_realizada is not null as "temDataEntrega",
          c.ocorr_efetiva_codigo_num as "codigoEfetivo", c.no_prazo as "noPrazo",
          c.responsabilidade_cliente as "responsabilidadeCliente",
          case
            when c.data_prevista_entrega is null then 'sem_previsao'
            when c.data_prevista_entrega < ${consulta.contexto.hoje} then 'vencida'
            else 'no_prazo' end as prevista,
          count(*)::int as quantidade, sum(c.peso)::text as peso,
          sum(c.volumes)::text as volumes, sum(c.valor_frete)::text as frete
        from erp.ctes c
        where ${ondeDoRanking(consulta, chave)}
        -- Por posição: a mesma expressão com parâmetro ($n) no SELECT e no GROUP BY não casa.
        group by 1, 2, 3, 4, 5, 6`);
      return linhas.map((l) => ({
        chave: l.chave,
        temDataEntrega: l.temDataEntrega,
        codigoEfetivo: l.codigoEfetivo,
        noPrazo: l.noPrazo,
        responsabilidadeCliente: l.responsabilidadeCliente,
        prevista: l.prevista,
        quantidade: l.quantidade,
        pesoGramas: decimalEmUnidades(l.peso, 3),
        volumes: decimalEmUnidades(l.volumes, 0),
        freteCentavos: decimalEmUnidades(l.frete, 2),
      }));
    },

    rotulos: (consulta, grupo) => {
      const chave = chaveDoGrupo(grupo);
      const origem = grupo === "cidade" ? sql`c.cidade_destino` : sql`c.pagador_nome`;
      return tx.consultar(sql`
        select ${chave} as chave,
          -- Mais frequente; empate = menor (ordem do banco). Nulo não conta.
          mode() within group (order by ${origem}) filter (where ${origem} is not null) as rotulo,
          ${grupo === "cidade" ? sql`max(c.uf_destino)` : sql`null`} as sub
        from erp.ctes c
        where ${ondeDoRanking(consulta, chave)}
        group by 1`);
    },

    equipes: (empresaId) =>
      tx.consultar(sql`${SELECT_EQUIPE} where empresa_id = ${empresaId} order by nome`),

    equipe: async (empresaId, id) => {
      const [linha] = await tx.consultar<NonNullable<Retorno<"equipe">>>(sql`
        ${SELECT_EQUIPE} where empresa_id = ${empresaId} and id = ${id}`);
      return linha ?? null;
    },

    membrosAtivos: (empresaId) =>
      tx.consultar(sql`
        ${SELECT_MEMBRO} where empresa_id = ${empresaId} and data_saida is null`),

    membro: async (empresaId, id) => {
      const [linha] = await tx.consultar<NonNullable<Retorno<"membro">>>(sql`
        ${SELECT_MEMBRO} where empresa_id = ${empresaId} and id = ${id}`);
      return linha ?? null;
    },

    unidades: (empresaId) =>
      tx.consultar(sql`
        select id, nome from erp.unidades where empresa_id = ${empresaId} and ativo
        order by nome`),

    inserirEquipe: async (empresaId, dados) => {
      const [linha] = await tx.consultar<{ id: string }>(sql`
        insert into erp.equipes ${valoresDeInsercao([{ empresaId, ...dados }])} returning id`);
      if (!linha) throw new Error("insert de equipe sem retorno");
      return linha.id;
    },

    alterarEquipe: async (id, dados) => {
      await tx.executar(sql`
        update erp.equipes set ${atribuicoes(dados)}, atualizado_em = now() where id = ${id}`);
    },

    inserirMembro: async (empresaId, dados) => {
      await tx.executar(sql`
        insert into erp.equipe_membros ${valoresDeInsercao([{ empresaId, ...dados }])}`);
    },

    encerrarMembro: async (id, dataSaida) => {
      await tx.executar(sql`
        update erp.equipe_membros set data_saida = ${dataSaida} where id = ${id}`);
    },

    gravarLink: async (equipeId, link) => {
      await tx.executar(sql`
        update erp.equipes
        set token_publico_hash = ${link.hash}, token_publico_revogado = ${link.revogado},
            atualizado_em = now()
        where id = ${equipeId}`);
    },

    ctesParaAtribuir: (empresaId, filtro) =>
      tx.consultar(sql`
        select id, sigla, numero, data_emissao as "dataEmissao",
               cidade_destino as "cidadeDestino", uf_destino as "ufDestino",
               motorista_nome as "motoristaNome"
        from erp.ctes
        where ${sql.e(
          sql`empresa_id = ${empresaId}`,
          sql`not fora_universo`,
          sql`data_emissao >= ${filtro.inicio}`,
          sql`data_emissao <= ${filtro.fim}`,
          filtro.somenteSemEquipe ? sql`equipe_id is null` : undefined,
          filtro.unidadeId ? sql`unidade_id = ${filtro.unidadeId}` : undefined,
        )}
        order by data_emissao desc
        limit ${LIMITE_PARA_ATRIBUIR}`),

    atribuirEquipe: (empresaId, cteIds, equipeId) =>
      tx.executar(sql`
        update erp.ctes set equipe_id = ${equipeId}, atualizado_em = now()
        where empresa_id = ${empresaId} and id = any(${cteIds}::uuid[])`),

    regras: (empresaId) => regrasCom(sql`empresa_id = ${empresaId}`),

    regra: async (empresaId, id) => {
      const [regra] = await regrasCom(sql`empresa_id = ${empresaId} and id = ${id}`);
      return regra ?? null;
    },

    inserirRegra: async (empresaId, dados) => {
      const [linha] = await tx.consultar<{ id: string }>(sql`
        insert into erp.bonificacao_regras ${valoresDeInsercao([{ empresaId, ...dados }])}
        returning id`);
      if (!linha) throw new Error("insert de regra sem retorno");
      return linha.id;
    },

    alterarRegra: async (id, dados) => {
      await tx.executar(sql`
        update erp.bonificacao_regras set ${atribuicoes(dados)}, atualizado_em = now()
        where id = ${id}`);
    },

    substituirCriterios: async (empresaId, regraId, criterios) => {
      await tx.executar(sql`
        delete from erp.bonificacao_regra_criterios where regra_id = ${regraId}`);
      if (criterios.length === 0) return;
      const linhas = criterios.map((c, ordem) => ({
        empresaId,
        regraId,
        criterio: c.criterio,
        parametros: sql.json(c.parametros),
        ordem,
      }));
      await tx.executar(sql`
        insert into erp.bonificacao_regra_criterios ${valoresDeInsercao(linhas)}`);
    },

    excluirRegra: async (id) => {
      await tx.executar(sql`delete from erp.bonificacao_regras where id = ${id}`);
    },

    totaisPorEquipe: async (empresaId, equipeIds, periodo) => {
      if (equipeIds.length === 0) return new Map();
      const doPeriodo = sql`
        ctes.empresa_id = ${empresaId} and ctes.equipe_id = any(${equipeIds}::uuid[])
        and ctes.data_emissao >= ${periodo.inicio} and ctes.data_emissao <= ${periodo.fim}`;
      // Entrega no prazo: dia da entrega no fuso da empresa (Q11) até o prazo.
      const totais = await tx.consultar<{
        equipeId: string;
        totalEntregas: number;
        entregasNoPrazo: number;
      }>(sql`
        select ctes.equipe_id as "equipeId", count(*)::int as "totalEntregas",
          (count(*) filter (where ctes.data_entrega_realizada is not null
            and ctes.prazo_entrega is not null
            and (ctes.data_entrega_realizada at time zone ${periodo.fuso})::date <= ctes.prazo_entrega))::int
            as "entregasNoPrazo"
        from erp.ctes
        where ${doPeriodo}
        group by ctes.equipe_id`);
      // Ocorrências penalizantes dos CT-e da equipe; em quarentena não contam (Q21).
      const penalizantes = await tx.consultar<{ equipeId: string; quantidade: number }>(sql`
        select ctes.equipe_id as "equipeId", count(*)::int as quantidade
        from erp.ocorrencias
        join erp.ctes on ctes.id = ocorrencias.cte_id
        where ${doPeriodo} and ocorrencias.penaliza and not ocorrencias.quarentena
        group by ctes.equipe_id`);
      return new Map(
        totais.map((t) => [
          t.equipeId,
          {
            totalEntregas: t.totalEntregas,
            entregasNoPrazo: t.entregasNoPrazo,
            penalizantes: penalizantes.find((p) => p.equipeId === t.equipeId)?.quantidade ?? 0,
          },
        ]),
      );
    },

    equipePorToken: async (hash) => {
      const [linha] = await tx.consultar<{ id: string; empresaId: string }>(sql`
        select id, empresa_id as "empresaId" from erp.equipes
        where token_publico_hash = ${hash} and not token_publico_revogado`);
      return linha ?? null;
    },
  };
}

/** Parâmetros gravados (jsonb): só número e texto passam para o cálculo. */
function parametrosGravados(valor: unknown): Record<string, string | number> {
  if (typeof valor !== "object" || valor === null) return {};
  return Object.fromEntries(
    Object.entries(valor).filter(
      (par): par is [string, string | number] =>
        typeof par[1] === "string" || typeof par[1] === "number",
    ),
  );
}
