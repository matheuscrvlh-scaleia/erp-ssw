import { type Transacao } from "@erp/db";
import {
  codigosOcorrencia,
  ctes,
  ocorrencias,
  parceiros,
  romaneioConferenteCte,
  unidades,
} from "@erp/db/schema";
import {
  and,
  asc,
  between,
  eq,
  exists,
  inArray,
  isNotNull,
  ne,
  not,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

import { casaAlgumPadrao, filiaisProprias, nfIgual } from "../../compartilhado/sql-cte";
import { type LeitorDeConfiguracoes } from "../configuracoes/leitor";
import { type FiltroDeCtes, type RepositorioOcorrencias } from "./casos-de-uso";

/** `numeric` chega do driver como texto. */
const numero = (valor: string | null) => (valor === null ? null : Number(valor));

/**
 * Universo (não fora e filial própria) + filtros de CT-e. Nenhuma regra além de comparar as
 * colunas gravadas com o que a tela pediu.
 */
function ondeCtes(tx: Transacao, f: FiltroDeCtes): SQL | undefined {
  const data = f.campoData === "prevista" ? ctes.dataPrevistaEntrega : ctes.dataEmissao;
  return and(
    eq(ctes.empresaId, f.empresaId),
    not(ctes.foraUniverso),
    inArray(ctes.filialEfetiva, filiaisProprias(tx, f.empresaId)),
    or(...f.periodos.map((p) => between(data, p.inicio, p.fim))),
    f.unidades.length > 0 ? inArray(ctes.unidadeId, f.unidades) : undefined,
    f.conferentes.length > 0
      ? exists(
          tx
            .select({ um: sql`1` })
            .from(romaneioConferenteCte)
            .where(
              and(
                eq(romaneioConferenteCte.empresaId, ctes.empresaId),
                eq(romaneioConferenteCte.sigla, ctes.sigla),
                eq(romaneioConferenteCte.numero, ctes.numero),
                inArray(romaneioConferenteCte.conferente, f.conferentes),
              ),
            ),
        )
      : undefined,
    f.parceiros.length > 0 ? inArray(ctes.pagadorCnpjDigitos, f.parceiros) : undefined,
    f.filiais.length > 0 ? inArray(ctes.filialEfetiva, f.filiais) : undefined,
    f.remetente ? casaAlgumPadrao(ctes.remetente, f.remetente) : undefined,
    f.destino ? casaAlgumPadrao(ctes.cidadeDestino, f.destino) : undefined,
    f.ctrc ? eq(ctes.numero, f.ctrc) : undefined,
    f.nf ? nfIgual(f.nf) : undefined,
  );
}

export function criarRepositorioOcorrencias(
  tx: Transacao,
  configuracoesVigentes: LeitorDeConfiguracoes,
): RepositorioOcorrencias {
  return {
    catalogo: (empresaId) =>
      tx
        .select({
          codigo: codigosOcorrencia.codigo,
          descricao: codigosOcorrencia.descricao,
          responsavel: codigosOcorrencia.responsavel,
          penaliza: codigosOcorrencia.penaliza,
          pendenteClassificacao: codigosOcorrencia.pendenteClassificacao,
          pendenciaAcompanhada: codigosOcorrencia.pendenciaAcompanhada,
          tipoSsw: codigosOcorrencia.tipoSsw,
        })
        .from(codigosOcorrencia)
        .where(eq(codigosOcorrencia.empresaId, empresaId)),

    configuracao: async (empresaId, chave) =>
      (await configuracoesVigentes(empresaId, [chave])).get(chave) ?? null,

    ctes: (filtro, limite) =>
      tx
        .select({
          id: ctes.id,
          sigla: ctes.sigla,
          numero: ctes.numero,
          dataEmissao: ctes.dataEmissao,
          dataPrevistaEntrega: ctes.dataPrevistaEntrega,
          dataEntregaRealizada: ctes.dataEntregaRealizada,
          codigoEfetivo: ctes.ocorrEfetivaCodigoNum,
          noPrazo: ctes.noPrazo,
          pagadorNome: ctes.pagadorNome,
          pagadorCnpj: ctes.pagadorCnpj,
          filialEfetiva: ctes.filialEfetiva,
          tipoDocumento455: ctes.tipoDocumento455,
          tipoDocumento: ctes.tipoDocumento,
          parceiroNome: sql<string | null>`coalesce(${parceiros.nome}, ${ctes.parceiroNome})`,
        })
        .from(ctes)
        .leftJoin(parceiros, eq(parceiros.id, ctes.parceiroId))
        .where(ondeCtes(tx, filtro))
        .limit(limite),

    ocorrencias: (filtro, codigos, limite) =>
      tx
        .select({
          id: ocorrencias.id,
          cteId: ocorrencias.cteId,
          codigo: ocorrencias.codigo,
          descricao: ocorrencias.descricao,
          dataHora: ocorrencias.dataHora,
        })
        .from(ocorrencias)
        .innerJoin(ctes, eq(ctes.id, ocorrencias.cteId))
        .where(
          and(
            ondeCtes(tx, filtro),
            eq(ocorrencias.empresaId, filtro.empresaId),
            inArray(ocorrencias.codigo, codigos),
            // Q21 do dono: ocorrência em quarentena fica fora de todas as contas.
            not(ocorrencias.quarentena),
          ),
        )
        .limit(limite),

    detalhes: async (ids) => {
      if (ids.length === 0) return [];
      const linhas = await tx
        .select({
          id: ctes.id,
          numeroNf: ctes.numeroNf,
          destinatario: ctes.destinatario,
          cidadeDestino: ctes.cidadeDestino,
          ufDestino: ctes.ufDestino,
          peso: ctes.peso,
          volumes: ctes.volumes,
          valorFrete: ctes.valorFrete,
          setor: ctes.setor,
        })
        .from(ctes)
        .where(inArray(ctes.id, ids));
      return linhas.map((l) => ({ ...l, peso: numero(l.peso), valorFrete: numero(l.valorFrete) }));
    },

    conferentesDosCtes: async (empresaId, chaves) => {
      if (chaves.length === 0) return [];
      const linhas = await tx
        .select({
          sigla: romaneioConferenteCte.sigla,
          numero: romaneioConferenteCte.numero,
          conferente: romaneioConferenteCte.conferente,
          romaneio: romaneioConferenteCte.romaneio,
        })
        .from(romaneioConferenteCte)
        .where(
          and(
            eq(romaneioConferenteCte.empresaId, empresaId),
            inArray(romaneioConferenteCte.numero, [...new Set(chaves.map((c) => c.numero))]),
            inArray(romaneioConferenteCte.sigla, [...new Set(chaves.map((c) => c.sigla))]),
          ),
        );
      const pedidas = new Set(chaves.map((c) => `${c.sigla}|${c.numero}`));
      return linhas.filter((l) => pedidas.has(`${l.sigla}|${l.numero}`));
    },

    conferentes: async (empresaId, limite) => {
      const linhas = await tx
        .selectDistinct({ conferente: romaneioConferenteCte.conferente })
        .from(romaneioConferenteCte)
        .where(
          and(
            eq(romaneioConferenteCte.empresaId, empresaId),
            isNotNull(romaneioConferenteCte.conferente),
          ),
        )
        .orderBy(asc(romaneioConferenteCte.conferente))
        .limit(limite);
      return linhas.flatMap((l) => (l.conferente === null ? [] : [l.conferente]));
    },

    unidadesAtivas: (empresaId) =>
      tx
        .select({ id: unidades.id, nome: unidades.nome, cidade: unidades.cidade, uf: unidades.uf })
        .from(unidades)
        .where(and(eq(unidades.empresaId, empresaId), eq(unidades.ativo, true)))
        .orderBy(asc(unidades.nome)),

    // origem: listar_pagadores_ctrcs (sistema atual), sempre pela emissão.
    pagadores: (empresaId, filtro, limite) => {
      const nome = sql<
        string | null
      >`mode() within group (order by coalesce(nullif(${ctes.pagadorNome}, ''), ${ctes.parceiroNome}, ${ctes.remetente}))`;
      return tx
        .select({
          cnpj: sql<string>`${ctes.pagadorCnpjDigitos}`,
          cnpjFormatado: sql<string>`max(${ctes.pagadorCnpj})`,
          nome,
        })
        .from(ctes)
        .where(
          and(
            eq(ctes.empresaId, empresaId),
            not(ctes.foraUniverso),
            inArray(ctes.filialEfetiva, filiaisProprias(tx, empresaId)),
            between(ctes.dataEmissao, filtro.inicio, filtro.fim),
            ne(ctes.pagadorCnpjDigitos, ""),
            filtro.unidades.length > 0 ? inArray(ctes.unidadeId, filtro.unidades) : undefined,
            filtro.filiais.length > 0 ? inArray(ctes.filialEfetiva, filtro.filiais) : undefined,
          ),
        )
        .groupBy(ctes.pagadorCnpjDigitos)
        .orderBy(sql`lower(${nome})`, asc(ctes.pagadorCnpjDigitos))
        .limit(limite);
    },
  };
}
