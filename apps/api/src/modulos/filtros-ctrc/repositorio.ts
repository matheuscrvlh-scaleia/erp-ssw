import { type Transacao } from "@erp/db";
import { formatarCnpj } from "@erp/shared/formatacao";
import { type SQL, sql } from "drizzle-orm";

import { lista, TIPO_EFETIVO } from "../performance/consultas";
import { type FiltroDeOpcoes, type RepositorioFiltrosCtrc } from "./casos-de-uso";

type Linha = Record<string, unknown>;

/** Filtros opcionais das listas de opções (sem universo: igual às funções de hoje). */
function ondeDasOpcoes(empresaId: string, f: FiltroDeOpcoes): SQL {
  const partes: SQL[] = [sql`c.empresa_id = ${empresaId}`];
  if (f.periodo) {
    partes.push(sql`c.data_emissao between ${f.periodo.inicio}::date and ${f.periodo.fim}::date`);
  }
  if (f.parceiros) partes.push(sql`c.pagador_cnpj_digitos = any(${lista(f.parceiros)}::text[])`);
  if (f.remetente) partes.push(sql`c.remetente ilike any(${lista(f.remetente)}::text[])`);
  if (f.destino) partes.push(sql`c.cidade_destino ilike any(${lista(f.destino)}::text[])`);
  if (f.filiais) partes.push(sql`c.filial_efetiva = any(${lista(f.filiais)}::text[])`);
  if (f.codigos) partes.push(sql`c.ocorr_efetiva_codigo_num = any(${lista(f.codigos)}::int[])`);
  return sql.join(partes, sql` and `);
}

const COLUNA_DE_SUGESTAO = {
  remetente: sql`c.remetente`,
  cidade_destino: sql`c.cidade_destino`,
} as const;

export function criarRepositorioFiltrosCtrc(tx: Transacao): RepositorioFiltrosCtrc {
  const linhas = async (consulta: SQL): Promise<Linha[]> => (await tx.execute(consulta)).rows;

  return {
    filiaisProprias: async (empresaId) =>
      (
        await linhas(sql`
          select sigla from erp.filiais where empresa_id = ${empresaId} and propria order by sigla`)
      ).map((r) => String(r["sigla"])),

    codigosDoCatalogo: async (empresaId) =>
      (
        await linhas(sql`
          select codigo, descricao from erp.codigos_ocorrencia
          where empresa_id = ${empresaId} order by codigo`)
      ).map((r) => ({ codigo: Number(r["codigo"]), descricao: String(r["descricao"]) })),

    // origem: unidades_disponiveis_ctrcs (sistema atual)
    siglasComCtrc: async (empresaId, filtro) =>
      (
        await linhas(sql`
          select distinct c.filial_efetiva as sigla from erp.ctes c
          where ${ondeDasOpcoes(empresaId, filtro)} and coalesce(c.filial_efetiva, '') <> ''
          order by 1`)
      ).map((r) => String(r["sigla"])),

    // origem: sugestoes_texto_ctrcs (sistema atual)
    sugestoes: async (empresaId, campo, padrao, filtro, limite) => {
      const coluna = COLUNA_DE_SUGESTAO[campo];
      const busca = padrao === null ? sql`true` : sql`${coluna} ilike ${padrao}`;
      return (
        await linhas(sql`
          select distinct ${coluna} as valor from erp.ctes c
          where ${ondeDasOpcoes(empresaId, filtro)} and coalesce(${coluna}, '') <> '' and ${busca}
          order by 1 limit ${limite}`)
      ).map((r) => String(r["valor"]));
    },

    cidadesDasUnidades: async (empresaId, ids) =>
      (
        await linhas(sql`
          select cidade from erp.unidades
          where empresa_id = ${empresaId} and id = any(${lista(ids)}::uuid[])`)
      ).map((r) => String(r["cidade"])),

    apelidosDeFiliais: async (empresaId) =>
      (
        await linhas(sql`
          select cidade_normalizada, filial from erp.filiais_apelidos where empresa_id = ${empresaId}`)
      ).map((r) => ({
        cidadeNormalizada: String(r["cidade_normalizada"]),
        filial: String(r["filial"]),
      })),

    // origem: listar_pagadores_ctrcs (sistema atual; nome = o mais frequente, empate pelo menor)
    pagadores: async (empresaId, filtro, limite) => {
      const partes: SQL[] = [
        sql`c.empresa_id = ${empresaId}`,
        sql`not c.fora_universo`,
        sql`c.filial_efetiva = any(${lista(filtro.proprias)}::text[])`,
        sql`coalesce(c.pagador_cnpj_digitos, '') <> ''`,
      ];
      if (filtro.periodo.inicio) partes.push(sql`c.data_emissao >= ${filtro.periodo.inicio}::date`);
      if (filtro.periodo.fim) partes.push(sql`c.data_emissao <= ${filtro.periodo.fim}::date`);
      if (filtro.siglas) partes.push(sql`c.filial_efetiva = any(${lista(filtro.siglas)}::text[])`);
      if (filtro.filiais)
        partes.push(sql`c.filial_efetiva = any(${lista(filtro.filiais)}::text[])`);
      const rs = await linhas(sql`
        select c.pagador_cnpj_digitos as cnpj, max(c.pagador_cnpj) as cnpj_original,
               mode() within group (
                 order by coalesce(nullif(c.pagador_nome, ''), c.parceiro_nome, c.remetente)
               ) as nome,
               count(*)::int as qtd
        from erp.ctes c where ${sql.join(partes, sql` and `)}
        group by c.pagador_cnpj_digitos
        order by lower(mode() within group (
                   order by coalesce(nullif(c.pagador_nome, ''), c.parceiro_nome, c.remetente))),
                 c.pagador_cnpj_digitos
        limit ${limite}`);
      return rs.map((r) => {
        const cnpj = String(r["cnpj"]);
        const original = typeof r["cnpj_original"] === "string" ? r["cnpj_original"] : "";
        return {
          cnpj,
          cnpjFormatado: /\D/.test(original)
            ? original
            : cnpj.length === 14
              ? formatarCnpj(cnpj)
              : cnpj,
          nome: typeof r["nome"] === "string" ? r["nome"] : cnpj,
          qtd: Number(r["qtd"]),
        };
      });
    },

    // origem: tipos_documento_opcoes (sistema atual)
    tiposDocumento: async (empresaId) =>
      (
        await linhas(sql`
          select ${TIPO_EFETIVO} as tipo, count(*)::int as qtd from erp.ctes c
          where c.empresa_id = ${empresaId} and not c.fora_universo
          group by 1 order by 2 desc, 1`)
      ).map((r) => ({ tipo: String(r["tipo"]), qtd: Number(r["qtd"]) })),
  };
}
