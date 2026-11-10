import { type Transacao } from "@erp/db";
import { ctes, ingestaoArquivos, ocorrencias } from "@erp/db/schema";
import { CODIGOS_DE_ENTREGA } from "@erp/dominio/ocorrencias/situacao";
import {
  and,
  between,
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

import { casaAlgum, filiaisProprias, nfIgual } from "../ocorrencias/repositorio";
import { type FiltroDeEntregues, type RepositorioComprovantes } from "./casos-de-uso";

/** Ocorrência que marca o comprovante de entrega digitalizado. */
const CODIGO_COMPROVANTE_DIGITALIZADO = 88;

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
      inArray(ctes.ocorrEfetivaCodigoNum, [...CODIGOS_DE_ENTREGA]),
    ),
    or(isNotNull(ctes.dataEntregaRealizada), isNotNull(ctes.ocorrEfetivaData)),
    between(ctes.dataConclusaoEfetiva, f.inicio, f.fim),
    f.unidades.length > 0 ? inArray(ctes.filialEfetiva, f.unidades) : undefined,
    f.filiais.length > 0 ? inArray(ctes.filialEfetiva, f.filiais) : undefined,
    f.pagadores.length > 0 ? inArray(ctes.pagadorCnpjDigitos, f.pagadores) : undefined,
    f.remetente ? casaAlgum(ctes.remetente, f.remetente) : undefined,
    f.destino ? casaAlgum(ctes.cidadeDestino, f.destino) : undefined,
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
          dataEntrega:
            sql<Date>`coalesce(${ctes.dataEntregaRealizada}, ${ctes.ocorrEfetivaData})`.mapWith(
              ctes.dataEntregaRealizada,
            ),
          criadoEm: ctes.criadoEm,
          tipoDocumento455: ctes.tipoDocumento455,
          tipoDocumento: ctes.tipoDocumento,
          comprovanteEscaneado: ctes.comprovanteEscaneado,
          // Q21 do dono: a 88 em quarentena não conta.
          tem88: exists(
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
          ).mapWith(Boolean),
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

    detalhes: async (ids) => {
      if (ids.length === 0) return [];
      return tx
        .select({
          id: ctes.id,
          numero: ctes.numero,
          sigla: ctes.sigla,
          numeroNf: ctes.numeroNf,
          dataEmissao: ctes.dataEmissao,
          setor: ctes.setor,
          pagadorNome: ctes.pagadorNome,
          remetente: ctes.remetente,
          destinatario: ctes.destinatario,
          cidadeDestino: ctes.cidadeDestino,
        })
        .from(ctes)
        .where(inArray(ctes.id, ids));
    },
  };
}
