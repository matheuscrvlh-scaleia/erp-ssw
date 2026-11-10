import { type Transacao } from "@erp/db";
import { ctes, ingestaoArquivos, ocorrencias } from "@erp/db/schema";
import { CODIGOS_ENTREGA } from "@erp/dominio/nucleo";
import {
  and,
  between,
  count,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  like,
  not,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

import {
  casaAlgumPadrao,
  filiaisProprias,
  nfIgual,
  textos,
  tipoDocumentoDoFiltro,
} from "../../compartilhado/sql-cte";
import {
  type FiltroDeEntregues,
  type PedidoDaLista,
  type RepositorioComprovantes,
} from "./casos-de-uso";

/** Ocorrência que marca o comprovante de entrega digitalizado. */
const CODIGO_COMPROVANTE_DIGITALIZADO = 88;

/** Tem a 88 fora da quarentena (Q21 do dono: a 88 em quarentena não conta). */
const tem88 = (tx: Transacao) =>
  exists(
    tx
      .select({ um: sql`1` })
      .from(ocorrencias)
      .where(
        and(
          eq(ocorrencias.cteId, ctes.id),
          eq(ocorrencias.codigo, CODIGO_COMPROVANTE_DIGITALIZADO),
          not(ocorrencias.quarentena),
        ),
      ),
  );

const dataEntrega = sql<Date>`coalesce(${ctes.dataEntregaRealizada}, ${ctes.ocorrEfetivaData})`;

/**
 * Mesma regra de `classificarComprovantes` e `listarComprovantes` (dominio/comprovantes), em SQL
 * para a lista paginar no banco: digitalizado = 88 ou "escaneado" no 455; pendente = não
 * digitalizado num dia coberto (930 importado) ou com a coluna do 455.
 */
function ondeDaLista(tx: Transacao, f: FiltroDeEntregues, p: PedidoDaLista): SQL | undefined {
  const digitalizado = sql`(${ctes.comprovanteEscaneado} is true or ${tem88(tx)})`;
  const coberto = sql`(${ctes.dataConclusaoEfetiva} = any(${textos(p.diasCobertos)}::date[]) or ${ctes.comprovanteEscaneado} is not null)`;
  return and(
    ondeEntregues(tx, f),
    p.tipos.length > 0 ? sql`${tipoDocumentoDoFiltro()} = any(${textos(p.tipos)})` : undefined,
    p.status === "digitalizados" ? digitalizado : undefined,
    p.status === "pendentes" ? sql`not ${digitalizado} and ${coberto}` : undefined,
  );
}

function buscaDeCtrc(termo: string): SQL {
  return termo === "" ? sql`false` : eq(ctes.numero, termo);
}

function buscaDeNf(termo: string): SQL | undefined {
  return termo === "" ? or(isNull(ctes.numeroNf), eq(ctes.numeroNf, 0)) : nfIgual(termo);
}

/**
 * Entregue = entrega gravada ou ocorrência efetiva de entrega. O período é o dia da entrega em
 * São Paulo (Q11 do dono), que para o CT-e entregue é a `data_conclusao_efetiva` gravada.
 */
function ondeEntregues(tx: Transacao, f: FiltroDeEntregues): SQL | undefined {
  return and(
    eq(ctes.empresaId, f.empresaId),
    not(ctes.foraUniverso),
    inArray(ctes.filialEfetiva, filiaisProprias(tx, f.empresaId)),
    or(
      isNotNull(ctes.dataEntregaRealizada),
      inArray(ctes.ocorrEfetivaCodigoNum, [...CODIGOS_ENTREGA]),
    ),
    or(isNotNull(ctes.dataEntregaRealizada), isNotNull(ctes.ocorrEfetivaData)),
    between(ctes.dataConclusaoEfetiva, f.inicio, f.fim),
    f.unidades.length > 0 ? inArray(ctes.filialEfetiva, f.unidades) : undefined,
    f.filiais.length > 0 ? inArray(ctes.filialEfetiva, f.filiais) : undefined,
    f.pagadores.length > 0 ? inArray(ctes.pagadorCnpjDigitos, f.pagadores) : undefined,
    f.remetente ? casaAlgumPadrao(ctes.remetente, f.remetente) : undefined,
    f.destino ? casaAlgumPadrao(ctes.cidadeDestino, f.destino) : undefined,
    f.ctrc !== null ? buscaDeCtrc(f.ctrc) : undefined,
    f.nf !== null ? buscaDeNf(f.nf) : undefined,
  );
}

export function criarRepositorioComprovantes(tx: Transacao): RepositorioComprovantes {
  return {
    entregues: async (filtro, limite) => {
      const linhas = await tx
        .select({
          id: ctes.id,
          unidade: ctes.filialEfetiva,
          dia: ctes.dataConclusaoEfetiva,
          dataEntrega: dataEntrega.mapWith(ctes.dataEntregaRealizada),
          criadoEm: ctes.criadoEm,
          tipoDocumento455: ctes.tipoDocumento455,
          tipoDocumento: ctes.tipoDocumento,
          comprovanteEscaneado: ctes.comprovanteEscaneado,
          tem88: tem88(tx).mapWith(Boolean),
        })
        .from(ctes)
        .where(ondeEntregues(tx, filtro))
        .limit(limite);
      return linhas.flatMap((l) => (l.dia === null ? [] : [{ ...l, dia: l.dia }]));
    },

    arquivos930Importados: async (empresaId) => {
      const linhas = await tx
        .select({ nome: ingestaoArquivos.nomeArquivo })
        .from(ingestaoArquivos)
        .where(
          and(
            eq(ingestaoArquivos.empresaId, empresaId),
            eq(ingestaoArquivos.status, "importado"),
            like(ingestaoArquivos.nomeArquivo, "930\\_ocorrencias\\_%"),
          ),
        );
      return linhas.map((l) => l.nome);
    },

    lista: async (filtro, pedido, pagina) => {
      const onde = ondeDaLista(tx, filtro, pedido);
      const linhas = await tx
        .select({
          id: ctes.id,
          numero: ctes.numero,
          sigla: ctes.sigla,
          numeroNf: ctes.numeroNf,
          dataEmissao: ctes.dataEmissao,
          dataEntrega: dataEntrega.mapWith(ctes.dataEntregaRealizada),
          unidade: ctes.filialEfetiva,
          setor: ctes.setor,
          pagadorNome: ctes.pagadorNome,
          remetente: ctes.remetente,
          destinatario: ctes.destinatario,
          cidadeDestino: ctes.cidadeDestino,
          tipoEfetivo: sql<string>`${tipoDocumentoDoFiltro()}`,
          digitalizado: sql`(${ctes.comprovanteEscaneado} is true or ${tem88(tx)})`.mapWith(
            Boolean,
          ),
          total: sql<number>`count(*) over ()`.mapWith(Number),
        })
        .from(ctes)
        .where(onde)
        // Entrega mais recente primeiro; empate pelo CT-e gravado por último (Q07) e pelo id.
        .orderBy(desc(dataEntrega), desc(ctes.criadoEm), desc(ctes.id))
        .limit(pagina.limite)
        .offset(pagina.deslocamento);
      const primeira = linhas[0];
      // Página depois da última: o total vem de uma contagem à parte (Q10).
      const total =
        primeira?.total ??
        (pagina.deslocamento === 0
          ? 0
          : ((await tx.select({ n: count() }).from(ctes).where(onde))[0]?.n ?? 0));
      return { total, linhas: linhas.map(({ total: _total, ...l }) => l) };
    },
  };
}
