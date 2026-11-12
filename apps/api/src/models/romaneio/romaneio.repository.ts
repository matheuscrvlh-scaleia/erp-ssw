/**
 * Leitura do Romaneio: consultas set-based parametrizadas. Os filtros vêm prontos do caso de uso
 * (`FiltrosNormalizados`); a regra de situação é do domínio. Toda tabela passa pelo RLS da
 * empresa da sessão.
 */
import { comInstantes, type Sql, sql, type Transacao } from "@erp/db";
import { ErroDeNegocio } from "@erp/dominio/erros";
import { type OcorrenciaGravada } from "@erp/dominio/romaneio/linha-do-tempo";
import { linha036De, linha930De } from "@erp/dominio/romaneio/linhas-de-relatorio";
import { COLLATOR } from "@erp/dominio/romaneio/normalizacao";
import { type OcorrenciaDoCte } from "@erp/dominio/romaneio/situacao";
import { somarDias } from "@erp/shared/datas";
import { MENSAGEM_TEMPO_ESGOTADO } from "@erp/shared/erros";

import {
  casaAlgumPadrao,
  lista,
  tipoDocumentoDoFiltro,
  tipoDocumentoEfetivo,
} from "../cte/sql-cte";
import { type ConsultaDeCtes, type RepositorioRomaneio } from "./romaneio.service";

/** Teto de CT-e numa consulta: acima disso, pedir para filtrar mais (nunca cortar calado). */
const LIMITE_DE_CTES = 200_000;

const numeroOuNulo = (v: string | null) => (v === null ? null : Number(v));

type Retorno<K extends keyof RepositorioRomaneio> = Awaited<ReturnType<RepositorioRomaneio[K]>>;

/** CT-e da consulta-base como sai do banco (numeric em texto, sem as ocorrências). */
type LinhaDoCte = Omit<
  Retorno<"ctes">[number],
  "valorFrete" | "peso" | "volumes" | "tde" | "ocorrencias"
> & { volumes: number | null };

type ViagemLida = (Retorno<"viagens"> extends Map<string, (infer V)[]> ? V : never) & {
  cteId: string;
};
const numeroOuZero = (v: string | null) => (v === null ? 0 : Number(v));

/** Mesma chave natural (empresa, sigla, número) entre `ctes` e a projeção de apelido `t`. */
function mesmoCte(t: string): Sql {
  const a = sql.identificador(t);
  return sql`${a}.empresa_id = ctes.empresa_id and ${a}.sigla = ctes.sigla and ${a}.numero = ctes.numero`;
}

/** `unidadeResponsavel` do núcleo em SQL: destino, senão atual, se próprias; senão a filial. */
function unidadeResponsavelSql(fp: readonly string[]): Sql {
  return sql`(case when ctes.unidade_destino = any(${lista(fp)}::text[]) then ctes.unidade_destino
    when ctes.unidade_atual = any(${lista(fp)}::text[]) then ctes.unidade_atual
    else ctes.filial end)`;
}

/** Tipo efetivo do documento (455 vence o BI2), maiúsculo; sem tipo = `__SEM_TIPO__`. */
const tipoEfetivoSql = tipoDocumentoDoFiltro();

/** Busca literal: `\`, `%` e `_` digitados valem como texto (Q10). */
const padraoLiteral = (texto: string) => `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Período pela base de data escolhida. Conclusão sem o −1 dia de hoje (Q12). */
function periodoSql(c: ConsultaDeCtes): Sql {
  const { inicio, fim } = c.filtros.periodo;
  switch (c.filtros.campo) {
    case "emissao":
      return sql`ctes.data_emissao between ${inicio} and ${fim}`;
    case "embarque":
      return sql`ctes.data_embarque between ${inicio} and ${fim}`;
    case "prevista":
      return sql`ctes.data_prevista_entrega between ${inicio} and ${fim}`;
    case "conclusao":
      return sql`ctes.data_conclusao_efetiva between ${inicio} and ${fim}`;
    case "saida":
      return sql`exists (select 1 from erp.romaneio_saidas_cte s where ${mesmoCte("s")}
        and s.data_saida between ${inicio} and ${fim})`;
  }
}

/** O CT-e saiu em alguma viagem com a placa/motorista (no período, se a base é a saída). */
function viagemSql(c: ConsultaDeCtes): Sql | undefined {
  const { placas, motoristas, campo, periodo } = c.filtros;
  if (!placas && !motoristas) return undefined;
  return sql`exists (select 1 from erp.romaneio_viagens_cte v where ${mesmoCte("v")}
    ${campo === "saida" ? sql`and v.data_saida between ${periodo.inicio} and ${periodo.fim}` : sql.vazio()}
    ${placas ? sql`and v.placa = any(${lista(placas)}::text[])` : sql.vazio()}
    ${motoristas ? sql`and v.motorista_normalizado = any(${lista(motoristas)}::text[])` : sql.vazio()})`;
}

function buscaSql(busca: string): Sql {
  const p = padraoLiteral(busca);
  return sql`(ctes.numero ilike ${p} or ctes.numero_nf::text ilike ${p}
    or ctes.remetente ilike ${p} or ctes.destinatario ilike ${p}
    or ctes.cidade_destino ilike ${p} or ctes.parceiro_nome ilike ${p}
    or exists (select 1 from erp.romaneio_cte_atual a where ${mesmoCte("a")}
      and (a.placa ilike ${p} or a.motorista ilike ${p})))`;
}

function ajudantesSql(ajudantes: readonly string[]): Sql {
  const nomes = lista(ajudantes);
  return sql`exists (select 1 from erp.romaneio_cte_atual a where ${mesmoCte("a")} and (
    upper(btrim(a.ajudante)) = any(${nomes}::text[])
    or upper(btrim(a.ajudante_2)) = any(${nomes}::text[])
    or upper(btrim(a.ajudante_3)) = any(${nomes}::text[])))`;
}

/** Filtros da consulta-base (universo do Romaneio + barra de filtros + documento). */
function condicoes(c: ConsultaDeCtes): Sql {
  const f = c.filtros;
  const fp = lista(f.filiaisProprias);
  const conds: (Sql | undefined)[] = [
    sql`not ctes.fora_universo`,
    // unidadeResponsavel ∈ próprias ⇔ destino, atual ou filial é própria.
    sql`(ctes.unidade_destino = any(${fp}::text[]) or ctes.unidade_atual = any(${fp}::text[]) or ctes.filial = any(${fp}::text[]))`,
    periodoSql(c),
    f.unidades ? sql`ctes.unidade_id = any(${lista(f.unidades)}::uuid[])` : undefined,
    f.pagadores ? sql`ctes.pagador_cnpj_digitos = any(${lista(f.pagadores)}::text[])` : undefined,
    f.filiais
      ? sql`${unidadeResponsavelSql(f.filiaisProprias)} = any(${lista(f.filiais)}::text[])`
      : undefined,
    f.unidadeAtual ? sql`ctes.unidade_atual = any(${lista(f.unidadeAtual)}::text[])` : undefined,
    f.remetente ? casaAlgumPadrao(sql`ctes.remetente`, f.remetente) : undefined,
    f.destino ? casaAlgumPadrao(sql`ctes.cidade_destino`, f.destino) : undefined,
    f.tipos ? sql`${tipoEfetivoSql} = any(${lista(f.tipos)}::text[])` : undefined,
    f.previsao ? sql`ctes.data_prevista_entrega = ${f.previsao}` : undefined,
    f.codigos
      ? sql`exists (select 1 from erp.ocorrencias where ocorrencias.cte_id = ctes.id
          and ocorrencias.codigo = any(${lista(f.codigos)}::smallint[]))`
      : undefined,
    viagemSql(c),
    c.ctrc ? sql`ctes.numero = ${c.ctrc.numero}` : undefined,
    c.ctrc?.sigla ? sql`ctes.sigla = ${c.ctrc.sigla}` : undefined,
    c.nf !== null ? sql`ctes.numero_nf = ${c.nf}` : undefined,
    c.busca ? buscaSql(c.busca) : undefined,
    c.ajudantes ? ajudantesSql(c.ajudantes) : undefined,
    c.ids ? sql`ctes.id = any(${lista(c.ids)}::uuid[])` : undefined,
  ];
  return sql.e(...conds);
}

async function ocorrenciasDos(
  tx: Transacao,
  ids: readonly string[],
  codigos: readonly number[] | null,
): Promise<Map<string, OcorrenciaDoCte[]>> {
  const porCte = new Map<string, OcorrenciaDoCte[]>();
  if (ids.length === 0) return porCte;
  const linhas = comInstantes<OcorrenciaDoCte & { cteId: string }>(
    await tx.consultar(sql`
      select cte_id as "cteId", codigo, data_hora as "dataHora", quarentena,
             criado_em as "criadoEm"
      from erp.ocorrencias
      where cte_id = any(${lista(ids)}::uuid[])
        ${codigos ? sql`and codigo = any(${lista(codigos)}::smallint[])` : sql.vazio()}`),
    ["dataHora", "criadoEm"],
  );
  for (const { cteId, ...o } of linhas) {
    const doCte = porCte.get(cteId) ?? [];
    doCte.push(o);
    porCte.set(cteId, doCte);
  }
  return porCte;
}

/** Linhas de relatório guardadas, sem as de lote ainda em importação. */
function linhasImportadas(relatorio: string): Sql {
  return sql`ingestao_linhas.relatorio = ${relatorio} and not exists (
    select 1 from erp.ingestao_arquivos where ingestao_arquivos.id = ingestao_linhas.arquivo_id
      and ingestao_arquivos.status <> 'importado')`;
}

export function criarRepositorioRomaneio(
  tx: Transacao,
  /** Leitor já preso à empresa do contexto. */
  configuracoesVigentes: (chaves: readonly string[]) => Promise<Map<string, string>>,
): RepositorioRomaneio {
  return {
    filiaisProprias: () =>
      tx.consultar(sql`select sigla, nome from erp.filiais where propria order by sigla`),

    codigos: () =>
      tx.consultar(sql`
        select codigo, descricao, tipo_ssw as "tipoSsw", penaliza, responsavel
        from erp.codigos_ocorrencia`),

    configuracoes: (chaves) => configuracoesVigentes(chaves),

    ctes: async (c) => {
      const linhas = comInstantes<
        LinhaDoCte & { valorFrete: string | null; peso: string | null; tde: string | null }
      >(
        await tx.consultar(sql`
          select ctes.id, ctes.sigla, ctes.numero, ctes.data_emissao as "dataEmissao",
            ctes.data_prevista_entrega as "dataPrevista",
            ctes.data_entrega_realizada as "dataEntregaRealizada", ctes.criado_em as "criadoEm",
            ctes.ocorr_efetiva_codigo as "ocorrEfetivaCodigo",
            ctes.ultima_ocorr_codigo_0013 as "codigo0013",
            ctes.ult_ocorr_codigo_0174 as "codigo0174", ctes.valor_frete as "valorFrete",
            ctes.peso, ctes.volumes, ctes.tde, ctes.cidade_destino as "cidadeDestino",
            ctes.uf_destino as "ufDestino", ctes.pagador_nome as "pagadorNome",
            ctes.numero_nf as "numeroNf", ctes.data_embarque as "dataEmbarque",
            ctes.parceiro_id as "parceiroId",
            coalesce(parceiros.nome, ctes.parceiro_nome) as "parceiroNome",
            ctes.unidade_id as "unidadeId", ctes.filial, ctes.remetente, d.setor,
            ctes.status_atual as "statusAtual"
          from erp.ctes
          left join erp.parceiros on parceiros.id = ctes.parceiro_id
          left join erp.cte_dados_relatorios d on ${mesmoCte("d")}
          where ${condicoes(c)}
          limit ${LIMITE_DE_CTES + 1}`),
        ["dataEntregaRealizada", "criadoEm"],
      );
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
      const linhas = comInstantes<
        Omit<Retorno<"detalhes">[number], "valorMercadoria"> & { valorMercadoria: string | null }
      >(
        await tx.consultar(sql`
          select ctes.id, ctes.unidade_cidade as "unidadeCidade", ctes.unidade_uf as "unidadeUf",
            ctes.unidade_atual as "unidadeAtual", a.placa, a.motorista, ctes.destinatario,
            d.bairro, d.endereco, d.cep, d.valor_mercadoria as "valorMercadoria",
            ctes.ocorr_efetiva_descricao as "ocorrEfetivaDescricao",
            ctes.ocorr_efetiva_data as "ocorrEfetivaData",
            ctes.ocorr_efetiva_fonte as "ocorrEfetivaFonte", ctes.atraso_dias as "atrasoDias",
            ctes.performance_dias as "performanceDias",
            ctes.responsabilidade_cliente as "responsabilidadeCliente",
            ctes.placa_coleta as "placaColeta", ctes.placa_entrega as "placaEntrega"
          from erp.ctes
          left join erp.romaneio_cte_atual a on ${mesmoCte("a")}
          left join erp.cte_dados_relatorios d on ${mesmoCte("d")}
          where ctes.id = any(${lista(ids)}::uuid[])`),
        ["ocorrEfetivaData"],
      );
      return linhas.map((l) => ({ ...l, valorMercadoria: numeroOuNulo(l.valorMercadoria) }));
    },

    viagens: async (ids, recorte) => {
      if (ids.length === 0) return new Map();
      const linhas = await tx.consultar<ViagemLida>(sql`
        select ctes.id as "cteId", v.romaneio, v.situacao, v.data_saida as "dataSaida", v.placa,
          v.motorista, v.motorista_normalizado as "motoristaNormalizado", v.ajudante,
          v.ajudante_2 as ajudante2, v.ajudante_3 as ajudante3, v.primeira, v.ultima, v.proxima_saida as "proximaSaida"
        from erp.romaneio_viagens_cte v
        join erp.ctes on ${mesmoCte("v")}
        where ctes.id = any(${lista(ids)}::uuid[])
          ${recorte.saidaEntre ? sql`and v.data_saida between ${recorte.saidaEntre.inicio} and ${recorte.saidaEntre.fim}` : sql.vazio()}
          ${recorte.placas ? sql`and v.placa = any(${lista(recorte.placas)}::text[])` : sql.vazio()}
          ${recorte.motoristas ? sql`and v.motorista_normalizado = any(${lista(recorte.motoristas)}::text[])` : sql.vazio()}`);
      const resultado = new Map<string, ViagemLida[]>();
      for (const l of linhas) resultado.set(l.cteId, [...(resultado.get(l.cteId) ?? []), l]);
      return resultado;
    },

    motoristasDeEquipe: () =>
      tx.consultar(sql`
        select m.nome, e.nome as equipe
        from erp.equipe_membros m
        join erp.equipes e on e.id = m.equipe_id
        where m.papel = 'motorista' and m.data_saida is null`),

    opcoesPlacaMotorista: async (periodo, placas, motoristas) => {
      const pares = await tx.consultar<{ placa: string | null; motorista: string | null }>(sql`
        select distinct placa, motorista_normalizado as motorista
        from erp.romaneio_viagens_cte
        where data_saida between ${periodo.inicio} and ${periodo.fim}`);
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
      const onde = condicoes(c);
      const pagadores = await tx.consultar<{ cnpj: string; nome: string | null }>(sql`
        select ctes.pagador_cnpj_digitos as cnpj, max(ctes.pagador_nome) as nome
        from erp.ctes
        where ${onde} and ctes.pagador_cnpj_digitos is not null
          and ctes.pagador_cnpj_digitos <> ''
        group by ctes.pagador_cnpj_digitos`);
      const tipos = await tx.consultar<{ tipo: string }>(sql`
        select distinct ${tipoEfetivoSql} as tipo from erp.ctes where ${onde}`);
      return {
        pagadores: pagadores
          .map((p) => ({ cnpj: p.cnpj, nome: p.nome || p.cnpj }))
          .sort((a, b) => COLLATOR.compare(a.nome, b.nome)),
        tipos: tipos
          .map((t) => t.tipo)
          .filter((t) => t !== "__SEM_TIPO__")
          .sort(COLLATOR.compare),
      };
    },

    linhas036DoDia: async (dia) => {
      // A ingestão grava em `data_referencia` o dia de emissão do romaneio às 00:00 de SP
      // (`identificarLinha` em `@erp/dominio/ingestao/linhas`); a faixa larga só usa o índice,
      // quem decide é o `data_emissao` da linha.
      const linhas = comInstantes<{ dados: unknown; importadoEm: Date }>(
        await tx.consultar(sql`
          select ingestao_linhas.dados, ingestao_linhas.importado_em as "importadoEm"
          from erp.ingestao_linhas
          where ${linhasImportadas("036")}
            and ingestao_linhas.data_referencia >= ${somarDias(dia, -1)}::date
            and ingestao_linhas.data_referencia < ${somarDias(dia, 2)}::date
            and ingestao_linhas.dados->>'data_emissao' = ${dia}`),
        ["importadoEm"],
      );
      return linhas.map(({ dados, importadoEm }) => linha036De(dados, importadoEm));
    },

    ctesDoDia: async (numeros, codigos) => {
      if (numeros.length === 0) return [];
      const linhas = comInstantes<
        Omit<Retorno<"ctesDoDia">[number], "valorFrete" | "ocorrencias"> & {
          valorFrete: string | null;
        }
      >(
        await tx.consultar(sql`
          select ctes.id, ctes.sigla, ctes.numero, ctes.fora_universo as "foraUniverso",
            ctes.data_emissao as "dataEmissao", ctes.data_prevista_entrega as "dataPrevista",
            ctes.data_entrega_realizada as "dataEntregaRealizada", ctes.criado_em as "criadoEm",
            ctes.ocorr_efetiva_codigo as "ocorrEfetivaCodigo", ctes.valor_frete as "valorFrete",
            ${tipoDocumentoEfetivo()} as "tipoDocumento",
            ctes.unidade_destino as "unidadeDestino", ctes.unidade_atual as "unidadeAtual",
            ctes.filial, ctes.numero_nf as "numeroNf", ctes.destinatario,
            ctes.pagador_nome as "pagadorNome", ctes.cidade_destino as "cidadeDestino",
            ctes.uf_destino as "ufDestino"
          from erp.ctes
          where ctes.numero = any(${lista(numeros)}::text[])`),
        ["dataEntregaRealizada", "criadoEm"],
      );
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
      const gravadas = comInstantes<OcorrenciaGravada>(
        await tx.consultar(sql`
          select ocorrencias.data_hora as "dataHora", ocorrencias.codigo, ocorrencias.descricao,
                 ocorrencias.complemento
          from erp.ocorrencias
          join erp.ctes on ctes.id = ocorrencias.cte_id
          where ctes.sigla = ${sigla} and ctes.numero = ${numero}`),
        ["dataHora"],
      );
      const linhas = await tx.consultar<{ dados: unknown }>(sql`
        select ingestao_linhas.dados
        from erp.ingestao_linhas
        where ${linhasImportadas("930")}
          and ingestao_linhas.numero = ${numero}
          and (ingestao_linhas.sigla = ${sigla} or ingestao_linhas.sigla is null)`);
      return {
        ocorrencias: gravadas,
        linhas930: linhas.map(({ dados }) => linha930De(dados)),
      };
    },
  };
}
