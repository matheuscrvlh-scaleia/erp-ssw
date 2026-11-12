import { type Transacao } from "@erp/db";
import { coletas, ctes } from "@erp/db/schema";
import {
  type EtapaDeColeta,
  type FiltrosDeColetas,
  type StatusDaLista,
  type StatusDePrazo,
} from "@erp/shared/contratos/coletas";
import {
  and,
  type AnyColumn,
  asc,
  between,
  count,
  eq,
  inArray,
  isNotNull,
  type SQL,
  sql,
} from "drizzle-orm";

import { diaNoFuso, tipoDocumentoEfetivo } from "../cte/sql-cte";
import { type ColetaLida, type RepositorioColetas } from "./coletas.service";
import { criarRepositorioGravacao050 } from "./gravacao-050";

const numero = (valor: string | null) => (valor === null ? null : Number(valor));

const COLUNAS = {
  unidade: coletas.unidade,
  numero: coletas.numero,
  tipo: coletas.tipo,
  situacao: coletas.situacao,
  etapa: coletas.etapa,
  situacaoEm: coletas.situacaoEm,
  limiteEm: coletas.limiteEm,
  cadastradaEm: coletas.cadastradaEm,
  diaCadastro: coletas.diaCadastro,
  coletadaEm: coletas.coletadaEm,
  canceladaEm: coletas.canceladaEm,
  solicitante: coletas.solicitante,
  remetenteCnpj: coletas.remetenteCnpj,
  remetenteNome: coletas.remetenteNome,
  remetenteCidade: coletas.remetenteCidade,
  destinatarioNome: coletas.destinatarioNome,
  destinoCidade: coletas.destinoCidade,
  motorista: coletas.motorista,
  placa: coletas.placa,
  volumes: coletas.volumes,
  pesoKg: coletas.pesoKg,
  valorMercadoria: coletas.valorMercadoria,
  tipoFrete: coletas.tipoFrete,
  notasFiscais: coletas.notasFiscais,
  observacao: coletas.observacao,
  cteSigla: coletas.cteSigla,
  cteNumero: coletas.cteNumero,
  cteTipoDocumento455: ctes.tipoDocumento455,
  cteTipoDocumento: ctes.tipoDocumento,
  cteEmissao: ctes.dataEmissao,
  prejudicadaHorario: coletas.prejudicadaHorario,
  ultimoEvento: sql<string | null>`${coletas.historico} -> 0 ->> 'texto'`,
};

/** Sigla + número identificam um CT-e só: a coleta não duplica (Q24 do dono). */
const cteDaColeta = and(
  eq(ctes.empresaId, coletas.empresaId),
  eq(ctes.sigla, coletas.cteSigla),
  eq(ctes.numero, coletas.cteNumero),
);

function ondeDasColetas(empresaId: string, f: FiltrosDeColetas): SQL | undefined {
  return and(
    eq(coletas.empresaId, empresaId),
    between(coletas.diaCadastro, f.inicio, f.fim),
    f.unidades.length > 0 ? inArray(coletas.unidade, f.unidades) : undefined,
    f.solicitantes.length > 0
      ? inArray(sql`coalesce(${coletas.solicitante}, '')`, f.solicitantes)
      : undefined,
    f.tipo ? eq(coletas.tipo, f.tipo) : undefined,
  );
}

type LinhaDoBanco = Omit<ColetaLida, "diaCadastro" | "pesoKg" | "valorMercadoria"> & {
  diaCadastro: string | null;
  pesoKg: string | null;
  valorMercadoria: string | null;
};

function lida(l: LinhaDoBanco): ColetaLida[] {
  return l.diaCadastro === null
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
function statusDoPrazoSql(p: { agora: Date; hoje: string; fuso: string }): SQL {
  const situacao = sql`coalesce(${coletas.situacao}, '')`;
  const coletadaEm = sql`coalesce(${coletas.coletadaEm}, ${coletas.situacaoEm})`;
  return sql`(case
    when ${situacao} like 'CANCEL%' then 'cancelada'
    when ${situacao} like 'COLETAD%' then (case
      when ${coletas.limiteEm} is null then 'no_prazo'
      when ${coletadaEm} <= ${coletas.limiteEm} then 'no_prazo'
      else 'atrasada' end)
    when ${coletas.limiteEm} is null then 'a_vencer'
    when ${coletas.limiteEm} < ${p.agora} then 'vencida'
    when ${diaNoFuso(coletas.limiteEm, p.fuso)} = ${p.hoje}::date then 'vence_hoje'
    else 'a_vencer'
  end)`;
}

/** Mesma regra do status do card (`CASA_STATUS` de dominio/coletas). */
function casaStatus(status: StatusDaLista, prazo: SQL): SQL | undefined {
  const etapa = (e: EtapaDeColeta) => eq(coletas.etapa, e);
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
      return inArray(coletas.etapa, ["cadastrada", "comandada"]);
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
      return isNotNull(coletas.cteNumero);
    case "prejudicadas":
      return eq(coletas.prejudicadaHorario, true);
  }
}

/** Mesma regra de `casaBusca` (dominio/coletas), com os termos de `termosDaBusca`. */
function casaBusca(t: { numero: string; cte: string; texto: string }): SQL {
  const contem = (coluna: SQL | AnyColumn) =>
    sql`coalesce(strpos(lower(${coluna}), ${t.texto}) > 0, false)`;
  return sql`(${coletas.numero}::text = ${t.numero}
    or coalesce(${coletas.cteNumero} = ${t.cte}, false)
    or coalesce(lower(${coletas.placa}) = ${t.texto}, false)
    or ${contem(coletas.remetenteNome)} or ${contem(coletas.destinatarioNome)}
    or ${contem(coletas.notasFiscais)} or ${contem(coletas.observacao)})`;
}

export function criarRepositorioColetas(tx: Transacao): RepositorioColetas {
  return {
    ...criarRepositorioGravacao050(tx),
    coletas: async (empresaId, f, limite) => {
      const linhas = await tx
        .select(COLUNAS)
        .from(coletas)
        .leftJoin(ctes, cteDaColeta)
        .where(ondeDasColetas(empresaId, f))
        .limit(limite);
      return linhas.flatMap(lida);
    },

    lista: async (empresaId, f, pedido, pagina) => {
      const status = sql<StatusDePrazo>`${statusDoPrazoSql(pedido)}`;
      const onde = and(
        ondeDasColetas(empresaId, f),
        casaStatus(pedido.status, status),
        pedido.busca ? casaBusca(pedido.busca) : undefined,
      );
      const aberta = sql`${coletas.etapa} in ('cadastrada', 'comandada')`;
      const linhas = await tx
        .select({
          ...COLUNAS,
          statusPrazo: status,
          // CT-e não encontrado ou sem tipo: sem tipo (o agrupamento mostra vazio).
          tipoDaTela: sql<
            string | null
          >`case when ${ctes.dataEmissao} is not null then ${tipoDocumentoEfetivo()} end`,
          total: sql<number>`count(*) over ()`.mapWith(Number),
        })
        .from(coletas)
        .leftJoin(ctes, cteDaColeta)
        .where(onde)
        // Abertas primeiro, pela que vence antes; depois as mais recentes; chave da coleta.
        .orderBy(
          sql`${aberta} desc`,
          sql`case when ${aberta} then ${coletas.limiteEm} end asc nulls last`,
          sql`${coletas.cadastradaEm} desc nulls last`,
          asc(coletas.unidade),
          asc(coletas.numero),
        )
        .limit(pagina.limite)
        .offset(pagina.deslocamento);
      // Página depois da última: o total vem de uma contagem à parte (Q10).
      const contar = async () =>
        (await tx.select({ n: count() }).from(coletas).leftJoin(ctes, cteDaColeta).where(onde))[0]
          ?.n ?? 0;
      const total = linhas[0]?.total ?? (pagina.deslocamento === 0 ? 0 : await contar());
      return {
        total,
        linhas: linhas.flatMap(({ total: _total, statusPrazo, tipoDaTela, ...l }) =>
          lida(l).map((c) => ({ ...c, statusPrazo, tipoDaTela })),
        ),
      };
    },

    resumo: async (empresaId, inicio, fim) => {
      const unidades = await tx
        .selectDistinct({ unidade: coletas.unidade })
        .from(coletas)
        .where(eq(coletas.empresaId, empresaId))
        .orderBy(asc(coletas.unidade));
      const solicitantes = await tx
        .selectDistinct({ solicitante: coletas.solicitante })
        .from(coletas)
        .where(
          and(
            eq(coletas.empresaId, empresaId),
            between(coletas.diaCadastro, inicio, fim),
            isNotNull(coletas.solicitante),
          ),
        )
        .orderBy(asc(coletas.solicitante));
      const [agregado] = await tx
        .select({
          posicaoEm: sql<Date | null>`max(${coletas.relatorioEmitidoEm})`.mapWith(
            coletas.relatorioEmitidoEm,
          ),
          coberturaInicio: sql<string | null>`min(${coletas.diaCadastro})::text`,
          coberturaFim: sql<string | null>`max(${coletas.diaCadastro})::text`,
        })
        .from(coletas)
        .where(eq(coletas.empresaId, empresaId));
      return {
        unidades: unidades.map((u) => u.unidade),
        solicitantes: solicitantes.flatMap((s) => (s.solicitante === null ? [] : [s.solicitante])),
        posicaoEm: agregado?.posicaoEm ?? null,
        coberturaInicio: agregado?.coberturaInicio ?? null,
        coberturaFim: agregado?.coberturaFim ?? null,
      };
    },

    detalhe: async (empresaId, unidade, numeroDaColeta) => {
      const [linha] = await tx
        .select({
          observacao: coletas.observacao,
          mercadoria: coletas.mercadoria,
          setor: coletas.setor,
          romaneio: coletas.romaneio,
          cadastradaPor: coletas.cadastradaPor,
          comandadaEm: coletas.comandadaEm,
          limiteInicial: coletas.limiteInicial,
          relatorioEmitidoEm: coletas.relatorioEmitidoEm,
          historico: coletas.historico,
        })
        .from(coletas)
        .where(
          and(
            eq(coletas.empresaId, empresaId),
            eq(coletas.unidade, unidade),
            eq(coletas.numero, numeroDaColeta),
          ),
        );
      return linha ?? null;
    },
  };
}
