/**
 * Ingestão dos relatórios SSW (de-para "Ingestão"): registros técnicos com retenção (só a
 * janela que o worker manteria) e as 6 stagings largas como `ingestao_linhas`.
 */
import {
  ingestaoAplicacoes,
  ingestaoArquivos,
  ingestaoCiclos,
  ingestaoLinhas,
  ingestaoRelatoriosEsperados,
} from "@erp/db/schema";

import { definirTabela, type Filtros, type Fontes, migrar, semApoio } from "../motor/tipos";
import { numeroSsw, siglaSsw } from "../transformacoes/cte";
import { daLista, sha256Hex } from "../transformacoes/diversas";
import { jsonCanonico, lerJson } from "../transformacoes/json";
import {
  daEmpresa,
  ESCOPO_DA_EMPRESA,
  nosUltimosDias,
  ou,
  PELO_ID,
  referenciaEmpresa,
  referenciaUsuario,
} from "./comum";

/** Retenções (docs/dados/modelo.md "Retenção", decisão Q49). */
export const DIAS_DE_REGISTRO_TECNICO = 180;
export const DIAS_DE_LINHAS_DE_RELATORIO = 60;

interface OrigemTipoDeRelatorio {
  empresa_id: string;
  codigo: string;
  descricao: string | null;
  por_unidade: boolean | null;
  unidades_esperadas: string[] | null;
  obrigatorio_no_ciclo: boolean | null;
  ativo: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Era global; vira por empresa (as unidades esperadas são da empresa): uma linha por empresa
 * ativa. `prefixo_arquivo`, `tabela_staging` e `parser_id` viram constantes do worker.
 */
export const passoIngestaoRelatoriosEsperados = definirTabela({
  nome: "ingestao_relatorios_esperados",
  origem: "public.ssw_relatorio_tipos × empresas ativas",
  tabela: ingestaoRelatoriosEsperados,
  consulta: {
    colunas: `e.id as empresa_id, t.codigo, t.descricao, t.por_unidade, t.unidades_esperadas,
      t.obrigatorio_no_ciclo, t.ativo, t.created_at, t.updated_at`,
    de: "public.ssw_relatorio_tipos t cross join public.empresas e",
    onde: ["e.status = 'ativa'", daEmpresa("e.id")],
    chave: [
      { expressao: "e.id", tipo: "uuid" },
      { expressao: "t.codigo", tipo: "text" },
    ],
  },
  chaveDaLinha: (o: OrigemTipoDeRelatorio) => `${o.empresa_id}:${o.codigo}`,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    migrar({
      empresaId: o.empresa_id,
      relatorio: o.codigo,
      descricao: ou(o.descricao, ""),
      porUnidade: ou(o.por_unidade, false),
      unidadesEsperadas: ou(o.unidades_esperadas, []),
      obrigatorioNoCiclo: ou(o.obrigatorio_no_ciclo, true),
      ativo: ou(o.ativo, true),
      criadoEm: o.created_at ?? filtros.instante,
      atualizadoEm: o.updated_at ?? o.created_at ?? filtros.instante,
    }),
  conflito: ["empresaId", "relatorio"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(ingestaoRelatoriosEsperados, "empresaId")],
});

interface OrigemCiclo {
  id: string;
  ciclo_chave: string;
  status: string | null;
  motivo: string | null;
  faltantes: string | null;
  totais: string | null;
  arquivos_importados: number | null;
  linhas_importadas: number | null;
  primeiro_arquivo_em: string | null;
  ultimo_arquivo_em: string | null;
  fechado_em: string | null;
  aplicado_em: string | null;
  created_at: string;
  updated_at: string | null;
  empresa_id: string;
}

export const passoIngestaoCiclos = definirTabela({
  nome: "ingestao_ciclos",
  origem: "public.ssw_ciclo_importacao (180 dias)",
  tabela: ingestaoCiclos,
  consulta: {
    colunas: "o.*",
    de: "public.ssw_ciclo_importacao o",
    onde: [daEmpresa("o.empresa_id"), nosUltimosDias("o.created_at", DIAS_DE_REGISTRO_TECNICO)],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemCiclo) => o.id,
  preparar: semApoio,
  transformar: (o) =>
    migrar({
      id: o.id,
      empresaId: o.empresa_id,
      cicloChave: o.ciclo_chave,
      status: ou(o.status, "aberto"),
      motivo: o.motivo,
      faltantes: o.faltantes ?? "[]",
      totais: o.totais ?? "{}",
      arquivosImportados: ou(o.arquivos_importados, 0),
      linhasImportadas: ou(o.linhas_importadas, 0),
      primeiroArquivoEm: o.primeiro_arquivo_em ?? o.created_at,
      ultimoArquivoEm: o.ultimo_arquivo_em ?? o.primeiro_arquivo_em ?? o.created_at,
      fechadoEm: o.fechado_em,
      aplicadoEm: o.aplicado_em,
      criadoEm: o.created_at,
      atualizadoEm: o.updated_at ?? o.created_at,
    }),
  conflito: ["empresaId", "cicloChave"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  chaveDestino: ["id"],
  referencias: [referenciaEmpresa(ingestaoCiclos, "empresaId")],
});

interface OrigemArquivo {
  id: string;
  nome_arquivo: string;
  ciclo_chave: string | null;
  tipo_codigo: string | null;
  unidade: string | null;
  tamanho: string | null;
  mtime: string | null;
  sha256: string | null;
  status: string | null;
  linhas: number | null;
  mensagem: string | null;
  visto_em: string | null;
  importado_em: string | null;
  created_at: string;
  updated_at: string | null;
  lote_id: string | null;
  empresa_id: string;
}

export const passoIngestaoArquivos = definirTabela({
  nome: "ingestao_arquivos",
  origem: "public.ssw_relatorio_arquivos (180 dias)",
  tabela: ingestaoArquivos,
  consulta: {
    colunas: "o.*",
    de: "public.ssw_relatorio_arquivos o",
    onde: [daEmpresa("o.empresa_id"), nosUltimosDias("o.created_at", DIAS_DE_REGISTRO_TECNICO)],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemArquivo) => o.id,
  preparar: semApoio,
  transformar: (o) =>
    migrar({
      id: o.id,
      empresaId: o.empresa_id,
      nomeArquivo: o.nome_arquivo,
      cicloChave: o.ciclo_chave,
      relatorio: o.tipo_codigo,
      unidade: o.unidade,
      tamanho: o.tamanho ?? "0",
      mtime: o.mtime ?? "0",
      sha256: o.sha256,
      status: ou(o.status, "observado"),
      linhas: ou(o.linhas, 0),
      mensagem: o.mensagem,
      loteId: o.lote_id,
      vistoEm: o.visto_em ?? o.created_at,
      importadoEm: o.importado_em,
      criadoEm: o.created_at,
      atualizadoEm: o.updated_at ?? o.created_at,
    }),
  conflito: ["empresaId", "nomeArquivo"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  chaveDestino: ["id"],
  referencias: [referenciaEmpresa(ingestaoArquivos, "empresaId")],
});

interface OrigemAplicacao {
  id: string;
  aplicado_por: string | null;
  dry_run: boolean;
  total_inseridos: number | null;
  total_atualizados: number | null;
  total_ocorrencias: number | null;
  total_ignorados: number | null;
  payload: string | null;
  status: string | null;
  iniciado_em: string;
  finalizado_em: string | null;
  erro: string | null;
  empresa_id: string;
}

const STATUS_DE_APLICACAO = ["em_andamento", "concluido", "erro"] as const;
const INICIO_DA_APLICACAO = "coalesce(o.iniciado_em, o.aplicado_em, o.created_at)";

export const passoIngestaoAplicacoes = definirTabela({
  nome: "ingestao_aplicacoes",
  origem: "public.ssw_aplicacao_log (180 dias)",
  tabela: ingestaoAplicacoes,
  consulta: {
    colunas: `o.id, o.aplicado_por, o.dry_run, o.total_inseridos, o.total_atualizados,
      o.total_ocorrencias, o.total_ignorados, o.payload, o.status,
      ${INICIO_DA_APLICACAO} as iniciado_em, o.finalizado_em, o.erro, o.empresa_id`,
    de: "public.ssw_aplicacao_log o",
    onde: [
      daEmpresa("o.empresa_id"),
      nosUltimosDias(INICIO_DA_APLICACAO, DIAS_DE_REGISTRO_TECNICO),
    ],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemAplicacao) => o.id,
  preparar: semApoio,
  transformar: (o) =>
    migrar(
      {
        id: o.id,
        empresaId: o.empresa_id,
        aplicadoPor: o.aplicado_por,
        // Linha anterior à coluna `status` é aplicação terminada.
        status: daLista(o.status ?? "concluido", STATUS_DE_APLICACAO, "status"),
        simulacao: o.dry_run,
        totalInseridos: ou(o.total_inseridos, 0),
        totalAtualizados: ou(o.total_atualizados, 0),
        totalOcorrencias: ou(o.total_ocorrencias, 0),
        totalIgnorados: ou(o.total_ignorados, 0),
        detalhe: o.payload,
        erro: o.erro,
        iniciadoEm: o.iniciado_em,
        finalizadoEm: o.finalizado_em,
      },
      o.status === null ? "status nulo gravado como concluido" : null,
    ),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    referenciaEmpresa(ingestaoAplicacoes, "empresaId"),
    referenciaUsuario(ingestaoAplicacoes, "aplicadoPor"),
  ],
});

/** Colunas de controle da staging que não fazem parte do dado da linha. */
const COLUNAS_DE_CONTROLE = [
  "id",
  "lote_id",
  "importado_em",
  "arquivo_origem",
  "linha_bruta",
  "dado_hash",
  "empresa_id",
  "criado_em",
  "numero_ctrc_norm",
];

interface ConfiguracaoDaStaging {
  /** Código do relatório como o worker usa (docs/regras/06 §3: 036, 038, 306, 455, 455csv, 930). */
  relatorio: string;
  staging: string;
  /** Coluna com o CT-e (sigla + número) daquele relatório. */
  campoDoCte: string;
  /** `staging_455_ctrcs_expedidos` não tem `dado_hash` (dedupe era por índice nas colunas). */
  temHash: boolean;
}

export const STAGINGS: readonly ConfiguracaoDaStaging[] = [
  { relatorio: "038", staging: "staging_038_ctrcs_pendentes", campoDoCte: "ctrc", temHash: true },
  { relatorio: "455", staging: "staging_455_ctrcs_expedidos", campoDoCte: "ctrc", temHash: false },
  {
    relatorio: "455csv",
    staging: "staging_455_csv",
    campoDoCte: "serie_numero_ctrc",
    temHash: true,
  },
  { relatorio: "930", staging: "staging_930_ocorrencias", campoDoCte: "ctrc", temHash: true },
  { relatorio: "306", staging: "staging_306_ssw_mobile", campoDoCte: "ctrc_coleta", temHash: true },
  { relatorio: "036", staging: "staging_036_romaneios", campoDoCte: "ctrc", temHash: true },
];

interface OrigemLinhaDeRelatorio {
  id: string;
  empresa_id: string;
  lote_id: string;
  arquivo_origem: string | null;
  importado_em: string;
  dado_hash: string | null;
  campo_do_cte: string | null;
  dados: string;
}

/** Arquivo do destino por empresa + nome (as linhas apontam para ele pelo nome na origem). */
async function mapaDeArquivos(fontes: Fontes, filtros: Filtros): Promise<Map<string, string>> {
  const linhas = await fontes.destino.consultar<{ id: string; chave: string }>(
    `select id::text as id, empresa_id::text || '|' || nome_arquivo as chave
       from erp.ingestao_arquivos where ${daEmpresa("empresa_id")}`,
    { empresa: { valor: filtros.empresaId, tipo: "uuid" } },
  );
  return new Map(linhas.map((l) => [l.chave, l.id]));
}

/**
 * Hash de dedupe da linha. Usa o `dado_hash` da staging; sem ele, o SHA-256 do dado em forma
 * canônica. TODO(ingestao): usar a função de hash do worker quando a ingestão estiver na main
 * (a dedupe só vale dentro da janela de 60 dias, então a divergência some sozinha).
 */
export function hashDaLinha(dadoHash: string | null, dados: string): string {
  return dadoHash ?? sha256Hex(jsonCanonico(lerJson(dados)));
}

function passoDaStaging(cfg: ConfiguracaoDaStaging) {
  return definirTabela({
    nome: `ingestao_linhas:${cfg.relatorio}`,
    origem: `public.${cfg.staging} (${String(DIAS_DE_LINHAS_DE_RELATORIO)} dias)`,
    tabela: ingestaoLinhas,
    consulta: {
      colunas: `o.id, o.empresa_id, o.lote_id, o.arquivo_origem, o.importado_em,
        ${cfg.temHash ? "o.dado_hash" : "null::text as dado_hash"},
        o.${cfg.campoDoCte} as campo_do_cte,
        (to_jsonb(o) - array[${COLUNAS_DE_CONTROLE.map((c) => `'${c}'`).join(", ")}])::text as dados`,
      de: `public.${cfg.staging} o`,
      onde: [
        daEmpresa("o.empresa_id"),
        nosUltimosDias("o.importado_em", DIAS_DE_LINHAS_DE_RELATORIO),
      ],
      chave: PELO_ID,
    },
    chaveDaLinha: (o: OrigemLinhaDeRelatorio) => o.id,
    preparar: mapaDeArquivos,
    transformar: (o, arquivos) =>
      migrar({
        empresaId: o.empresa_id,
        relatorio: cfg.relatorio,
        loteId: o.lote_id,
        arquivoId:
          o.arquivo_origem === null
            ? null
            : (arquivos.get(`${o.empresa_id}|${o.arquivo_origem}`) ?? null),
        numeroLinha: null,
        hash: hashDaLinha(o.dado_hash, o.dados),
        sigla: siglaSsw(o.campo_do_cte),
        numero: numeroSsw(o.campo_do_cte),
        // TODO(ingestao): o parser do worker define a data de referência de cada relatório.
        dataReferencia: null,
        dados: o.dados,
        importadoEm: o.importado_em,
        // Já aplicada no sistema atual: a retenção de 60 dias conta daqui.
        aplicadoEm: o.importado_em,
      }),
    conflito: ["empresaId", "relatorio", "hash"],
    aoConflitar: "atualizar",
    chaveDestino: ["id"],
    escopoDestino: `${ESCOPO_DA_EMPRESA} and relatorio = '${cfg.relatorio}'`,
    referencias: [referenciaEmpresa(ingestaoLinhas, "empresaId")],
  });
}

export const passosDasLinhasDeRelatorio = STAGINGS.map(passoDaStaging);
