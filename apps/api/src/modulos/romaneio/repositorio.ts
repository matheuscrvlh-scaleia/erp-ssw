/**
 * Leitura do Romaneio: consultas set-based parametrizadas. Os filtros vêm prontos do caso de uso
 * (`FiltrosNormalizados`); a regra de situação é do domínio. Toda tabela passa pelo RLS da
 * empresa da sessão.
 */
import { type Transacao } from "@erp/db";
import {
  codigosOcorrencia,
  cteDadosRelatorios,
  ctes,
  equipeMembros,
  equipes,
  filiais,
  ingestaoArquivos,
  ingestaoLinhas,
  ocorrencias,
  parceiros,
  romaneioCteAtual,
  romaneioSaidasCte,
  romaneioViagensCte,
} from "@erp/db/schema";
import { ErroDeNegocio } from "@erp/dominio/erros";
import { linha036De, linha930De } from "@erp/dominio/romaneio/linhas-de-relatorio";
import { COLLATOR } from "@erp/dominio/romaneio/normalizacao";
import { type OcorrenciaDoCte } from "@erp/dominio/romaneio/situacao";
import { somarDias } from "@erp/shared/datas";
import { MENSAGEM_TEMPO_ESGOTADO } from "@erp/shared/erros";
import { and, asc, eq, isNotNull, isNull, or, type SQL, sql } from "drizzle-orm";
import { type AnyPgColumn } from "drizzle-orm/pg-core";

import {
  casaAlgumPadrao,
  lista,
  tipoDocumentoDoFiltro,
  tipoDocumentoEfetivo,
} from "../../compartilhado/sql-cte";
import { type ConsultaDeCtes, type RepositorioRomaneio } from "./casos-de-uso";

/** Teto de CT-e numa consulta: acima disso, pedir para filtrar mais (nunca cortar calado). */
const LIMITE_DE_CTES = 200_000;

const numeroOuNulo = (v: string | null) => (v === null ? null : Number(v));
const numeroOuZero = (v: string | null) => (v === null ? 0 : Number(v));

/** Mesma chave natural (empresa, sigla, número) entre `ctes` e uma projeção. */
function mesmoCte(t: { empresaId: AnyPgColumn; sigla: AnyPgColumn; numero: AnyPgColumn }) {
  return sql`${t.empresaId} = ${ctes.empresaId} and ${t.sigla} = ${ctes.sigla} and ${t.numero} = ${ctes.numero}`;
}

/** `unidadeResponsavel` do núcleo em SQL: destino, senão atual, se próprias; senão a filial. */
function unidadeResponsavelSql(fp: readonly string[]): SQL {
  return sql`(case when ${ctes.unidadeDestino} = any(${lista(fp)}::text[]) then ${ctes.unidadeDestino}
    when ${ctes.unidadeAtual} = any(${lista(fp)}::text[]) then ${ctes.unidadeAtual}
    else ${ctes.filial} end)`;
}

/** Tipo efetivo do documento (455 vence o BI2), maiúsculo; sem tipo = `__SEM_TIPO__`. */
const tipoEfetivoSql = tipoDocumentoDoFiltro();

/** Busca literal: `\`, `%` e `_` digitados valem como texto (Q10). */
const padraoLiteral = (texto: string) => `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Período pela base de data escolhida. Conclusão sem o −1 dia de hoje (Q12). */
function periodoSql(c: ConsultaDeCtes): SQL {
  const { inicio, fim } = c.filtros.periodo;
  switch (c.filtros.campo) {
    case "emissao":
      return sql`${ctes.dataEmissao} between ${inicio} and ${fim}`;
    case "embarque":
      return sql`${ctes.dataEmbarque} between ${inicio} and ${fim}`;
    case "prevista":
      return sql`${ctes.dataPrevistaEntrega} between ${inicio} and ${fim}`;
    case "conclusao":
      return sql`${ctes.dataConclusaoEfetiva} between ${inicio} and ${fim}`;
    case "saida":
      return sql`exists (select 1 from ${romaneioSaidasCte} where ${mesmoCte(romaneioSaidasCte)}
        and ${romaneioSaidasCte.dataSaida} between ${inicio} and ${fim})`;
  }
}

/** O CT-e saiu em alguma viagem com a placa/motorista (no período, se a base é a saída). */
function viagemSql(c: ConsultaDeCtes): SQL | undefined {
  const { placas, motoristas, campo, periodo } = c.filtros;
  if (!placas && !motoristas) return undefined;
  const v = romaneioViagensCte;
  return sql`exists (select 1 from ${v} where ${mesmoCte(v)}
    ${campo === "saida" ? sql`and ${v.dataSaida} between ${periodo.inicio} and ${periodo.fim}` : sql``}
    ${placas ? sql`and ${v.placa} = any(${lista(placas)}::text[])` : sql``}
    ${motoristas ? sql`and ${v.motoristaNormalizado} = any(${lista(motoristas)}::text[])` : sql``})`;
}

function buscaSql(busca: string): SQL {
  const p = padraoLiteral(busca);
  const a = romaneioCteAtual;
  return sql`(${ctes.numero} ilike ${p} or ${ctes.numeroNf}::text ilike ${p}
    or ${ctes.remetente} ilike ${p} or ${ctes.destinatario} ilike ${p}
    or ${ctes.cidadeDestino} ilike ${p} or ${ctes.parceiroNome} ilike ${p}
    or exists (select 1 from ${a} where ${mesmoCte(a)} and (${a.placa} ilike ${p} or ${a.motorista} ilike ${p})))`;
}

function ajudantesSql(ajudantes: readonly string[]): SQL {
  const a = romaneioCteAtual;
  const nomes = lista(ajudantes);
  return sql`exists (select 1 from ${a} where ${mesmoCte(a)} and (
    upper(btrim(${a.ajudante})) = any(${nomes}::text[])
    or upper(btrim(${a.ajudante2})) = any(${nomes}::text[])
    or upper(btrim(${a.ajudante3})) = any(${nomes}::text[])))`;
}

/** Filtros da consulta-base (universo do Romaneio + barra de filtros + documento). */
function condicoes(c: ConsultaDeCtes): SQL[] {
  const f = c.filtros;
  const fp = lista(f.filiaisProprias);
  const conds: (SQL | undefined)[] = [
    sql`not ${ctes.foraUniverso}`,
    // unidadeResponsavel ∈ próprias ⇔ destino, atual ou filial é própria.
    sql`(${ctes.unidadeDestino} = any(${fp}::text[]) or ${ctes.unidadeAtual} = any(${fp}::text[]) or ${ctes.filial} = any(${fp}::text[]))`,
    periodoSql(c),
    f.unidades ? sql`${ctes.unidadeId} = any(${lista(f.unidades)}::uuid[])` : undefined,
    f.pagadores ? sql`${ctes.pagadorCnpjDigitos} = any(${lista(f.pagadores)}::text[])` : undefined,
    f.filiais
      ? sql`${unidadeResponsavelSql(f.filiaisProprias)} = any(${lista(f.filiais)}::text[])`
      : undefined,
    f.unidadeAtual ? sql`${ctes.unidadeAtual} = any(${lista(f.unidadeAtual)}::text[])` : undefined,
    f.remetente ? casaAlgumPadrao(ctes.remetente, f.remetente) : undefined,
    f.destino ? casaAlgumPadrao(ctes.cidadeDestino, f.destino) : undefined,
    f.tipos ? sql`${tipoEfetivoSql} = any(${lista(f.tipos)}::text[])` : undefined,
    f.previsao ? eq(ctes.dataPrevistaEntrega, f.previsao) : undefined,
    f.codigos
      ? sql`exists (select 1 from ${ocorrencias} where ${ocorrencias.cteId} = ${ctes.id}
          and ${ocorrencias.codigo} = any(${lista(f.codigos)}::smallint[]))`
      : undefined,
    viagemSql(c),
    c.ctrc ? eq(ctes.numero, c.ctrc.numero) : undefined,
    c.ctrc?.sigla ? eq(ctes.sigla, c.ctrc.sigla) : undefined,
    c.nf !== null ? eq(ctes.numeroNf, c.nf) : undefined,
    c.busca ? buscaSql(c.busca) : undefined,
    c.ajudantes ? ajudantesSql(c.ajudantes) : undefined,
    c.ids ? sql`${ctes.id} = any(${lista(c.ids)}::uuid[])` : undefined,
  ];
  return conds.filter((x) => x !== undefined);
}

async function ocorrenciasDos(
  tx: Transacao,
  ids: readonly string[],
  codigos: readonly number[] | null,
): Promise<Map<string, OcorrenciaDoCte[]>> {
  const porCte = new Map<string, OcorrenciaDoCte[]>();
  if (ids.length === 0) return porCte;
  const linhas = await tx
    .select({
      cteId: ocorrencias.cteId,
      codigo: ocorrencias.codigo,
      dataHora: ocorrencias.dataHora,
      quarentena: ocorrencias.quarentena,
      criadoEm: ocorrencias.criadoEm,
    })
    .from(ocorrencias)
    .where(
      and(
        sql`${ocorrencias.cteId} = any(${lista(ids)}::uuid[])`,
        codigos ? sql`${ocorrencias.codigo} = any(${lista(codigos)}::smallint[])` : undefined,
      ),
    );
  for (const { cteId, ...o } of linhas) {
    const doCte = porCte.get(cteId) ?? [];
    doCte.push(o);
    porCte.set(cteId, doCte);
  }
  return porCte;
}

/** Linhas de relatório guardadas, sem as de lote ainda em importação. */
function linhasImportadas(relatorio: string): SQL {
  return sql`${ingestaoLinhas.relatorio} = ${relatorio} and not exists (
    select 1 from ${ingestaoArquivos} where ${ingestaoArquivos.id} = ${ingestaoLinhas.arquivoId}
      and ${ingestaoArquivos.status} <> 'importado')`;
}

export function criarRepositorioRomaneio(
  tx: Transacao,
  /** Leitor já preso à empresa do contexto. */
  configuracoesVigentes: (chaves: readonly string[]) => Promise<Map<string, string>>,
): RepositorioRomaneio {
  return {
    filiaisProprias: () =>
      tx
        .select({ sigla: filiais.sigla, nome: filiais.nome })
        .from(filiais)
        .where(eq(filiais.propria, true))
        .orderBy(asc(filiais.sigla)),

    codigos: () =>
      tx
        .select({
          codigo: codigosOcorrencia.codigo,
          descricao: codigosOcorrencia.descricao,
          tipoSsw: codigosOcorrencia.tipoSsw,
          penaliza: codigosOcorrencia.penaliza,
          responsavel: codigosOcorrencia.responsavel,
        })
        .from(codigosOcorrencia),

    configuracoes: (chaves) => configuracoesVigentes(chaves),

    ctes: async (c) => {
      const linhas = await tx
        .select({
          id: ctes.id,
          sigla: ctes.sigla,
          numero: ctes.numero,
          dataEmissao: ctes.dataEmissao,
          dataPrevista: ctes.dataPrevistaEntrega,
          dataEntregaRealizada: ctes.dataEntregaRealizada,
          criadoEm: ctes.criadoEm,
          ocorrEfetivaCodigo: ctes.ocorrEfetivaCodigo,
          codigo0013: ctes.ultimaOcorrCodigo0013,
          codigo0174: ctes.ultOcorrCodigo0174,
          valorFrete: ctes.valorFrete,
          peso: ctes.peso,
          volumes: ctes.volumes,
          tde: ctes.tde,
          cidadeDestino: ctes.cidadeDestino,
          ufDestino: ctes.ufDestino,
          pagadorNome: ctes.pagadorNome,
          numeroNf: ctes.numeroNf,
          dataEmbarque: ctes.dataEmbarque,
          parceiroId: ctes.parceiroId,
          parceiroNome: sql<string | null>`coalesce(${parceiros.nome}, ${ctes.parceiroNome})`,
          unidadeId: ctes.unidadeId,
          filial: ctes.filial,
          remetente: ctes.remetente,
          setor: cteDadosRelatorios.setor,
          statusAtual: ctes.statusAtual,
        })
        .from(ctes)
        .leftJoin(parceiros, eq(parceiros.id, ctes.parceiroId))
        .leftJoin(cteDadosRelatorios, mesmoCte(cteDadosRelatorios))
        .where(and(...condicoes(c)))
        .limit(LIMITE_DE_CTES + 1);
      if (linhas.length > LIMITE_DE_CTES)
        throw new ErroDeNegocio("TEMPO_ESGOTADO", MENSAGEM_TEMPO_ESGOTADO);
      const porCte = await ocorrenciasDos(
        tx,
        linhas.map((l) => l.id),
        c.codigosOcorrencia,
      );
      return linhas.map((l) => ({
        ...l,
        valorFrete: numeroOuZero(l.valorFrete),
        peso: numeroOuZero(l.peso),
        volumes: l.volumes ?? 0,
        tde: numeroOuNulo(l.tde),
        ocorrencias: porCte.get(l.id) ?? [],
      }));
    },

    detalhes: async (ids) => {
      if (ids.length === 0) return [];
      const a = romaneioCteAtual;
      const d = cteDadosRelatorios;
      const linhas = await tx
        .select({
          id: ctes.id,
          unidadeCidade: ctes.unidadeCidade,
          unidadeUf: ctes.unidadeUf,
          unidadeAtual: ctes.unidadeAtual,
          placa: a.placa,
          motorista: a.motorista,
          destinatario: ctes.destinatario,
          bairro: d.bairro,
          endereco: d.endereco,
          cep: d.cep,
          valorMercadoria: d.valorMercadoria,
          ocorrEfetivaDescricao: ctes.ocorrEfetivaDescricao,
          ocorrEfetivaData: ctes.ocorrEfetivaData,
          ocorrEfetivaFonte: ctes.ocorrEfetivaFonte,
          atrasoDias: ctes.atrasoDias,
          performanceDias: ctes.performanceDias,
          responsabilidadeCliente: ctes.responsabilidadeCliente,
          placaColeta: ctes.placaColeta,
          placaEntrega: ctes.placaEntrega,
        })
        .from(ctes)
        .leftJoin(a, mesmoCte(a))
        .leftJoin(d, mesmoCte(d))
        .where(sql`${ctes.id} = any(${lista(ids)}::uuid[])`);
      return linhas.map((l) => ({ ...l, valorMercadoria: numeroOuNulo(l.valorMercadoria) }));
    },

    viagens: async (ids, recorte) => {
      if (ids.length === 0) return new Map();
      const v = romaneioViagensCte;
      const linhas = await tx
        .select({
          cteId: ctes.id,
          romaneio: v.romaneio,
          situacao: v.situacao,
          dataSaida: v.dataSaida,
          placa: v.placa,
          motorista: v.motorista,
          motoristaNormalizado: v.motoristaNormalizado,
          ajudante: v.ajudante,
          ajudante2: v.ajudante2,
          ajudante3: v.ajudante3,
          primeira: v.primeira,
          ultima: v.ultima,
          proximaSaida: v.proximaSaida,
        })
        .from(v)
        .innerJoin(ctes, mesmoCte(v))
        .where(
          and(
            sql`${ctes.id} = any(${lista(ids)}::uuid[])`,
            recorte.saidaEntre
              ? sql`${v.dataSaida} between ${recorte.saidaEntre.inicio} and ${recorte.saidaEntre.fim}`
              : undefined,
            recorte.placas ? sql`${v.placa} = any(${lista(recorte.placas)}::text[])` : undefined,
            recorte.motoristas
              ? sql`${v.motoristaNormalizado} = any(${lista(recorte.motoristas)}::text[])`
              : undefined,
          ),
        );
      const resultado = new Map<string, (typeof linhas)[number][]>();
      for (const l of linhas) resultado.set(l.cteId, [...(resultado.get(l.cteId) ?? []), l]);
      return resultado;
    },

    motoristasDeEquipe: () =>
      tx
        .select({ nome: equipeMembros.nome, equipe: equipes.nome })
        .from(equipeMembros)
        .innerJoin(equipes, eq(equipes.id, equipeMembros.equipeId))
        .where(and(eq(equipeMembros.papel, "motorista"), isNull(equipeMembros.dataSaida))),

    opcoesPlacaMotorista: async (periodo, placas, motoristas) => {
      const v = romaneioViagensCte;
      const pares = await tx
        .selectDistinct({ placa: v.placa, motorista: v.motoristaNormalizado })
        .from(v)
        .where(sql`${v.dataSaida} between ${periodo.inicio} and ${periodo.fim}`);
      // Encadeado: as placas dos motoristas escolhidos e vice-versa.
      const unicos = (valores: (string | null)[]) =>
        [...new Set(valores.filter((x) => x !== null))].sort(COLLATOR.compare);
      return {
        placas: unicos(
          pares
            .filter(
              (p) => !motoristas || (p.motorista !== null && motoristas.includes(p.motorista)),
            )
            .map((p) => p.placa),
        ),
        motoristas: unicos(
          pares
            .filter((p) => !placas || (p.placa !== null && placas.includes(p.placa)))
            .map((p) => p.motorista),
        ),
      };
    },

    pagadoresETipos: async (campo, periodo, fp) => {
      if (fp.length === 0) return { pagadores: [], tipos: [] };
      const c: ConsultaDeCtes = {
        filtros: {
          campo,
          periodo,
          filiaisProprias: fp,
          unidades: null,
          pagadores: null,
          filiais: null,
          unidadeAtual: null,
          remetente: null,
          destino: null,
          previsao: null,
          codigos: null,
          placas: null,
          motoristas: null,
          tipos: null,
        },
        ctrc: null,
        nf: null,
        busca: null,
        ajudantes: null,
        ids: null,
        codigosOcorrencia: null,
      };
      const onde = and(...condicoes(c));
      const pagadores = await tx
        .select({ cnpj: ctes.pagadorCnpjDigitos, nome: sql<string>`max(${ctes.pagadorNome})` })
        .from(ctes)
        .where(and(onde, isNotNull(ctes.pagadorCnpjDigitos), sql`${ctes.pagadorCnpjDigitos} <> ''`))
        .groupBy(ctes.pagadorCnpjDigitos);
      const tipos = await tx.selectDistinct({ tipo: tipoEfetivoSql }).from(ctes).where(onde);
      return {
        pagadores: pagadores
          .flatMap((p) => (p.cnpj ? [{ cnpj: p.cnpj, nome: p.nome || p.cnpj }] : []))
          .sort((a, b) => COLLATOR.compare(a.nome, b.nome)),
        tipos: tipos
          .map((t) => String(t.tipo))
          .filter((t) => t !== "__SEM_TIPO__")
          .sort(COLLATOR.compare),
      };
    },

    linhas036DoDia: async (dia) => {
      // A ingestão grava em `data_referencia` o dia de emissão do romaneio às 00:00 de SP
      // (`identificarLinha` em `@erp/dominio/ingestao/linhas`); a faixa larga só usa o índice,
      // quem decide é o `data_emissao` da linha.
      const linhas = await tx
        .select({ dados: ingestaoLinhas.dados, importadoEm: ingestaoLinhas.importadoEm })
        .from(ingestaoLinhas)
        .where(
          and(
            linhasImportadas("036"),
            sql`${ingestaoLinhas.dataReferencia} >= ${somarDias(dia, -1)}::date
              and ${ingestaoLinhas.dataReferencia} < ${somarDias(dia, 2)}::date`,
            sql`${ingestaoLinhas.dados}->>'data_emissao' = ${dia}`,
          ),
        );
      return linhas.map(({ dados, importadoEm }) => linha036De(dados, importadoEm));
    },

    ctesDoDia: async (numeros, codigos) => {
      if (numeros.length === 0) return [];
      const linhas = await tx
        .select({
          id: ctes.id,
          sigla: ctes.sigla,
          numero: ctes.numero,
          foraUniverso: ctes.foraUniverso,
          dataEmissao: ctes.dataEmissao,
          dataPrevista: ctes.dataPrevistaEntrega,
          dataEntregaRealizada: ctes.dataEntregaRealizada,
          criadoEm: ctes.criadoEm,
          ocorrEfetivaCodigo: ctes.ocorrEfetivaCodigo,
          valorFrete: ctes.valorFrete,
          tipoDocumento: sql<string | null>`${tipoDocumentoEfetivo()}`,
          unidadeDestino: ctes.unidadeDestino,
          unidadeAtual: ctes.unidadeAtual,
          filial: ctes.filial,
          numeroNf: ctes.numeroNf,
          destinatario: ctes.destinatario,
          pagadorNome: ctes.pagadorNome,
          cidadeDestino: ctes.cidadeDestino,
          ufDestino: ctes.ufDestino,
        })
        .from(ctes)
        .where(sql`${ctes.numero} = any(${lista(numeros)}::text[])`);
      const porCte = await ocorrenciasDos(
        tx,
        linhas.map((l) => l.id),
        codigos,
      );
      return linhas.map((l) => ({
        ...l,
        valorFrete: numeroOuZero(l.valorFrete),
        ocorrencias: porCte.get(l.id) ?? [],
      }));
    },

    linhaDoTempo: async (sigla, numero) => {
      const gravadas = await tx
        .select({
          dataHora: ocorrencias.dataHora,
          codigo: ocorrencias.codigo,
          descricao: ocorrencias.descricao,
          complemento: ocorrencias.complemento,
        })
        .from(ocorrencias)
        .innerJoin(ctes, eq(ctes.id, ocorrencias.cteId))
        .where(and(eq(ctes.sigla, sigla), eq(ctes.numero, numero)));
      const linhas = await tx
        .select({ dados: ingestaoLinhas.dados })
        .from(ingestaoLinhas)
        .where(
          and(
            linhasImportadas("930"),
            eq(ingestaoLinhas.numero, numero),
            or(eq(ingestaoLinhas.sigla, sigla), isNull(ingestaoLinhas.sigla)),
          ),
        );
      return {
        ocorrencias: gravadas,
        linhas930: linhas.map(({ dados }) => linha930De(dados)),
      };
    },
  };
}
