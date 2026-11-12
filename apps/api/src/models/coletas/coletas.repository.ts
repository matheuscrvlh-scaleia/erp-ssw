import { comInstantes, type Linha, type Sql, sql, type Transacao } from "@erp/db";
import {
  type EtapaDeColeta,
  type FiltrosDeColetas,
  type StatusDaLista,
  type StatusDePrazo,
} from "@erp/shared/contratos/coletas";

import { diaNoFuso, textos, tipoDocumentoEfetivo } from "../cte/sql-cte";
import { type ColetaLida, type RepositorioColetas } from "./coletas.service";
import { criarRepositorioGravacao050 } from "./gravacao-050";

const numero = (valor: string | null) => (valor === null ? null : Number(valor));

const COLUNAS = sql`
  coletas.unidade, coletas.numero, coletas.tipo, coletas.situacao, coletas.etapa,
  coletas.situacao_em as "situacaoEm", coletas.limite_em as "limiteEm",
  coletas.cadastrada_em as "cadastradaEm", coletas.dia_cadastro as "diaCadastro",
  coletas.coletada_em as "coletadaEm", coletas.cancelada_em as "canceladaEm",
  coletas.solicitante, coletas.remetente_cnpj as "remetenteCnpj",
  coletas.remetente_nome as "remetenteNome", coletas.remetente_cidade as "remetenteCidade",
  coletas.destinatario_nome as "destinatarioNome", coletas.destino_cidade as "destinoCidade",
  coletas.motorista, coletas.placa, coletas.volumes, coletas.peso_kg as "pesoKg",
  coletas.valor_mercadoria as "valorMercadoria", coletas.tipo_frete as "tipoFrete",
  coletas.notas_fiscais as "notasFiscais", coletas.observacao, coletas.cte_sigla as "cteSigla",
  coletas.cte_numero as "cteNumero", ctes.tipo_documento_455 as "cteTipoDocumento455",
  ctes.tipo_documento as "cteTipoDocumento", ctes.data_emissao as "cteEmissao",
  coletas.prejudicada_horario as "prejudicadaHorario",
  coletas.historico -> 0 ->> 'texto' as "ultimoEvento"`;

/** Sigla + número identificam um CT-e só: a coleta não duplica (Q24 do dono). */
const COLETAS_COM_CTE = sql`
  erp.coletas
  left join erp.ctes
    on ctes.empresa_id = coletas.empresa_id and ctes.sigla = coletas.cte_sigla
      and ctes.numero = coletas.cte_numero`;

function ondeDasColetas(empresaId: string, f: FiltrosDeColetas): Sql {
  return sql.e(
    sql`coletas.empresa_id = ${empresaId}`,
    sql`coletas.dia_cadastro between ${f.inicio} and ${f.fim}`,
    f.unidades.length > 0 ? sql`coletas.unidade = any(${textos(f.unidades)})` : undefined,
    f.solicitantes.length > 0
      ? sql`coalesce(coletas.solicitante, '') = any(${textos(f.solicitantes)})`
      : undefined,
    f.tipo ? sql`coletas.tipo = ${f.tipo}` : undefined,
  );
}

type LinhaDoBanco = Omit<ColetaLida, "diaCadastro" | "pesoKg" | "valorMercadoria"> & {
  diaCadastro: string | null;
  pesoKg: string | null;
  valorMercadoria: string | null;
};

/** Instantes da coleta: o `pg` os entrega em texto. */
const INSTANTES: (keyof LinhaDoBanco)[] = [
  "situacaoEm",
  "limiteEm",
  "cadastradaEm",
  "coletadaEm",
  "canceladaEm",
];

function lida(linha: Linha): ColetaLida[] {
  const [l] = comInstantes<LinhaDoBanco>([linha], INSTANTES);
  return !l || l.diaCadastro === null
    ? []
    : [
        {
          ...l,
          diaCadastro: l.diaCadastro,
          pesoKg: numero(l.pesoKg),
          valorMercadoria: numero(l.valorMercadoria),
        },
      ];
}

/**
 * Mesma regra de `statusDoPrazo` (dominio/coletas), em SQL para a lista paginar no banco.
 * origem: vw_coletas.status_prazo (sistema atual)
 */
function statusDoPrazoSql(p: { agora: Date; hoje: string; fuso: string }): Sql {
  const situacao = sql`coalesce(coletas.situacao, '')`;
  const coletadaEm = sql`coalesce(coletas.coletada_em, coletas.situacao_em)`;
  return sql`(case
    when ${situacao} like 'CANCEL%' then 'cancelada'
    when ${situacao} like 'COLETAD%' then (case
      when coletas.limite_em is null then 'no_prazo'
      when ${coletadaEm} <= coletas.limite_em then 'no_prazo'
      else 'atrasada' end)
    when coletas.limite_em is null then 'a_vencer'
    when coletas.limite_em < ${p.agora} then 'vencida'
    when ${diaNoFuso(sql`coletas.limite_em`, p.fuso)} = ${p.hoje}::date then 'vence_hoje'
    else 'a_vencer'
  end)`;
}

/** Mesma regra do status do card (`CASA_STATUS` de dominio/coletas). */
function casaStatus(status: StatusDaLista, prazo: Sql): Sql | undefined {
  const etapa = (e: EtapaDeColeta) => sql`coletas.etapa = ${e}`;
  const prazoIgual = (p: StatusDePrazo) => sql`${prazo} = ${p}`;
  switch (status) {
    case "todas":
      return undefined;
    case "coletadas":
      return etapa("coletada");
    case "no_prazo":
      return prazoIgual("no_prazo");
    case "atrasadas":
      return prazoIgual("atrasada");
    case "abertas":
      return sql`coletas.etapa in ('cadastrada', 'comandada')`;
    case "cadastradas":
      return etapa("cadastrada");
    case "comandadas":
      return etapa("comandada");
    case "vencidas":
      return prazoIgual("vencida");
    case "vence_hoje":
      return prazoIgual("vence_hoje");
    case "a_vencer":
      return prazoIgual("a_vencer");
    case "canceladas":
      return etapa("cancelada");
    case "com_ctrc":
      return sql`coletas.cte_numero is not null`;
    case "prejudicadas":
      return sql`coletas.prejudicada_horario`;
  }
}

/** Mesma regra de `casaBusca` (dominio/coletas), com os termos de `termosDaBusca`. */
function casaBusca(t: { numero: string; cte: string; texto: string }): Sql {
  const contem = (coluna: Sql) => sql`coalesce(strpos(lower(${coluna}), ${t.texto}) > 0, false)`;
  return sql`(coletas.numero::text = ${t.numero}
    or coalesce(coletas.cte_numero = ${t.cte}, false)
    or coalesce(lower(coletas.placa) = ${t.texto}, false)
    or ${contem(sql`coletas.remetente_nome`)} or ${contem(sql`coletas.destinatario_nome`)}
    or ${contem(sql`coletas.notas_fiscais`)} or ${contem(sql`coletas.observacao`)})`;
}

export function criarRepositorioColetas(tx: Transacao): RepositorioColetas {
  return {
    ...criarRepositorioGravacao050(tx),
    coletas: async (empresaId, f, limite) => {
      const linhas = await tx.consultar(sql`
        select ${COLUNAS} from ${COLETAS_COM_CTE}
        where ${ondeDasColetas(empresaId, f)}
        limit ${limite}`);
      return linhas.flatMap(lida);
    },

    lista: async (empresaId, f, pedido, pagina) => {
      const status = statusDoPrazoSql(pedido);
      const onde = sql.e(
        ondeDasColetas(empresaId, f),
        casaStatus(pedido.status, status),
        pedido.busca ? casaBusca(pedido.busca) : undefined,
      );
      const aberta = sql`coletas.etapa in ('cadastrada', 'comandada')`;
      const linhas = await tx.consultar<
        Linha & { statusPrazo: StatusDePrazo; tipoDaTela: string | null; total: number }
      >(sql`
        select ${COLUNAS}, ${status} as "statusPrazo",
          -- CT-e não encontrado ou sem tipo: sem tipo (o agrupamento mostra vazio).
          case when ctes.data_emissao is not null then ${tipoDocumentoEfetivo()} end
            as "tipoDaTela",
          (count(*) over ())::int as total
        from ${COLETAS_COM_CTE}
        where ${onde}
        -- Abertas primeiro, pela que vence antes; depois as mais recentes; chave da coleta.
        order by ${aberta} desc, case when ${aberta} then coletas.limite_em end asc nulls last,
          coletas.cadastrada_em desc nulls last, coletas.unidade asc, coletas.numero asc
        limit ${pagina.limite}
        offset ${pagina.deslocamento}`);
      // Página depois da última: o total vem de uma contagem à parte (Q10).
      const contar = async () => {
        const [linha] = await tx.consultar<{ n: number }>(sql`
          select count(*)::int as n from ${COLETAS_COM_CTE} where ${onde}`);
        return linha?.n ?? 0;
      };
      const total = linhas[0]?.total ?? (pagina.deslocamento === 0 ? 0 : await contar());
      return {
        total,
        linhas: linhas.flatMap(({ total: _total, statusPrazo, tipoDaTela, ...l }) =>
          lida(l).map((c) => ({ ...c, statusPrazo, tipoDaTela })),
        ),
      };
    },

    resumo: async (empresaId, inicio, fim) => {
      const unidades = await tx.consultar<{ unidade: string }>(sql`
        select distinct unidade from erp.coletas where empresa_id = ${empresaId}
        order by unidade`);
      const solicitantes = await tx.consultar<{ solicitante: string }>(sql`
        select distinct solicitante from erp.coletas
        where empresa_id = ${empresaId} and dia_cadastro between ${inicio} and ${fim}
          and solicitante is not null
        order by solicitante`);
      const [agregado] = comInstantes<{
        posicaoEm: Date | null;
        coberturaInicio: string | null;
        coberturaFim: string | null;
      }>(
        await tx.consultar(sql`
          select max(relatorio_emitido_em) as "posicaoEm",
                 min(dia_cadastro)::text as "coberturaInicio",
                 max(dia_cadastro)::text as "coberturaFim"
          from erp.coletas where empresa_id = ${empresaId}`),
        ["posicaoEm"],
      );
      return {
        unidades: unidades.map((u) => u.unidade),
        solicitantes: solicitantes.map((s) => s.solicitante),
        posicaoEm: agregado?.posicaoEm ?? null,
        coberturaInicio: agregado?.coberturaInicio ?? null,
        coberturaFim: agregado?.coberturaFim ?? null,
      };
    },

    detalhe: async (empresaId, unidade, numeroDaColeta) => {
      const [linha] = comInstantes<NonNullable<Awaited<ReturnType<RepositorioColetas["detalhe"]>>>>(
        await tx.consultar(sql`
          select observacao, mercadoria, setor, romaneio, cadastrada_por as "cadastradaPor",
                 comandada_em as "comandadaEm", limite_inicial as "limiteInicial",
                 relatorio_emitido_em as "relatorioEmitidoEm", historico
          from erp.coletas
          where empresa_id = ${empresaId} and unidade = ${unidade} and numero = ${numeroDaColeta}`),
        ["comandadaEm", "relatorioEmitidoEm"],
      );
      return linha ?? null;
    },
  };
}
