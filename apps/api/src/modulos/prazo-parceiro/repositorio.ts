/**
 * Leitura do Prazo do parceiro: consultas set-based parametrizadas sob o RLS da empresa.
 */
import { type Transacao } from "@erp/db";
import {
  cteDadosRelatorios,
  ctes,
  filiais,
  ocorrencias,
  parceiros,
  unidades,
} from "@erp/db/schema";
import { ErroDeNegocio } from "@erp/dominio/erros";
import { type FiltroDaLista } from "@erp/shared/contratos/prazo-parceiro";
import { MENSAGEM_TEMPO_ESGOTADO } from "@erp/shared/erros";
import { and, asc, desc, eq, type SQL, sql } from "drizzle-orm";

import { lista, tipoDocumentoDoFiltro } from "../../compartilhado/sql-cte";
import {
  type ConsultaPrazo,
  type FatoDoPrazo,
  type RepositorioPrazoParceiro,
} from "./casos-de-uso";

/** Teto de CT-e numa consulta: acima disso, pedir para filtrar mais (nunca cortar calado). */
const LIMITE_DE_CTES = 200_000;

/** Dígitos do CNPJ do expedidor no CT-e. */
const cnpjDoCte = sql<
  string | null
>`nullif(regexp_replace(coalesce(${ctes.parceiroCnpj}, ''), '\\D', '', 'g'), '')`;

/** Tipo efetivo do documento (455 vence o BI2), maiúsculo; sem tipo = `__SEM_TIPO__`. */
const tipoEfetivo = tipoDocumentoDoFiltro();

/** Universo do Prazo do parceiro (§2: coalesce simples, diferente do Romaneio) + filtros. */
function condicoes(c: ConsultaPrazo): SQL[] {
  const conds: (SQL | undefined)[] = [
    sql`not ${ctes.foraUniverso}`,
    sql`coalesce(${ctes.unidadeDestino}, ${ctes.unidadeAtual}, ${ctes.filial}) = any(${lista(c.filiaisProprias)}::text[])`,
    sql`${ctes.dataEmissao} between ${c.periodo.inicio} and ${c.periodo.fim}`,
    c.unidades ? sql`${ctes.unidadeId} = any(${lista(c.unidades)}::uuid[])` : undefined,
    c.parceiros ? sql`${ctes.parceiroId} = any(${lista(c.parceiros)}::uuid[])` : undefined,
    c.tipos ? sql`${tipoEfetivo} = any(${lista(c.tipos)}::text[])` : undefined,
    c.doParceiro
      ? sql`(${ctes.parceiroId} = any(${lista(c.doParceiro.ids)}::uuid[])
          ${c.doParceiro.cnpj ? sql`or ${cnpjDoCte} = ${c.doParceiro.cnpj}` : sql``})`
      : undefined,
  ];
  return conds.filter((x) => x !== undefined);
}

function filtroDaLista(filtro: FiltroDaLista): SQL | undefined {
  switch (filtro) {
    case "nascidos":
      return sql`${ctes.dataPrevistaEntrega} < ${ctes.prazoPadraoData}`;
    case "prazo_parceiro":
      return eq(ctes.prazoOrigem, "parceiro");
    case "todos":
      return undefined;
  }
}

const colunas = {
  id: ctes.id,
  sigla: ctes.sigla,
  numero: ctes.numero,
  dataEmissao: ctes.dataEmissao,
  dataEmbarque: ctes.dataEmbarque,
  dataPrevista: ctes.dataPrevistaEntrega,
  prazoPadraoData: ctes.prazoPadraoData,
  prazoOrigem: ctes.prazoOrigem,
  parceiroId: ctes.parceiroId,
  parceiroCnpj: cnpjDoCte,
  parceiroNome: sql<string | null>`coalesce(${parceiros.nome}, ${ctes.parceiroNome})`,
  penalizado: sql<boolean>`exists (select 1 from ${ocorrencias}
    where ${ocorrencias.cteId} = ${ctes.id} and ${ocorrencias.penaliza})`,
  statusAtual: ctes.statusAtual,
  setor: sql<string | null>`coalesce(${ctes.setor}, ${cteDadosRelatorios.setor})`,
  unidadeNome: sql<string | null>`coalesce(${ctes.filial}, ${unidades.nome})`,
  cidadeDestino: ctes.cidadeDestino,
  ufDestino: ctes.ufDestino,
};

export function criarRepositorioPrazoParceiro(
  tx: Transacao,
  /** Leitor já preso à empresa do contexto. */
  configuracoesVigentes: (chaves: readonly string[]) => Promise<Map<string, string>>,
): RepositorioPrazoParceiro {
  const consultar = () =>
    tx
      .select(colunas)
      .from(ctes)
      .leftJoin(parceiros, eq(parceiros.id, ctes.parceiroId))
      .leftJoin(unidades, eq(unidades.id, ctes.unidadeId))
      .leftJoin(
        cteDadosRelatorios,
        and(
          eq(cteDadosRelatorios.empresaId, ctes.empresaId),
          eq(cteDadosRelatorios.sigla, ctes.sigla),
          eq(cteDadosRelatorios.numero, ctes.numero),
        ),
      );

  return {
    filiaisProprias: async () =>
      (
        await tx.select({ sigla: filiais.sigla }).from(filiais).where(eq(filiais.propria, true))
      ).map((f) => f.sigla),

    configuracoes: (chaves) => configuracoesVigentes(chaves),

    parceiros: () =>
      tx
        .select({
          id: parceiros.id,
          nome: parceiros.nome,
          cnpj: parceiros.cnpj,
          usaSsw: parceiros.usaSsw,
          criadoEm: parceiros.criadoEm,
          prazoAcordoHoras: parceiros.prazoAcordoHoras,
          ativo: parceiros.ativo,
        })
        .from(parceiros),

    unidadesAtivas: () =>
      tx
        .select({ id: unidades.id, nome: unidades.nome })
        .from(unidades)
        .where(eq(unidades.ativo, true))
        .orderBy(asc(unidades.nome)),

    tiposDeDocumento: async (c) => {
      const linhas = await tx
        .selectDistinct({ tipo: sql<string>`${tipoEfetivo}` })
        .from(ctes)
        .where(and(...condicoes(c)))
        .orderBy(sql`1`);
      return linhas.map((l) => l.tipo);
    },

    fatos: async (c) => {
      const linhas: FatoDoPrazo[] = await consultar()
        .where(and(...condicoes(c)))
        .limit(LIMITE_DE_CTES + 1);
      if (linhas.length > LIMITE_DE_CTES)
        throw new ErroDeNegocio("TEMPO_ESGOTADO", MENSAGEM_TEMPO_ESGOTADO);
      return linhas;
    },

    lista: (c, filtro, pagina) =>
      consultar()
        .where(and(...condicoes(c), filtroDaLista(filtro)))
        .orderBy(sql`${ctes.dataEmbarque} desc nulls last`, desc(ctes.id))
        .offset(pagina.inicio)
        .limit(pagina.quantos),

    contarLista: async (c, filtro) => {
      const [linha] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(ctes)
        .where(and(...condicoes(c), filtroDaLista(filtro)));
      return linha?.total ?? 0;
    },
  };
}
