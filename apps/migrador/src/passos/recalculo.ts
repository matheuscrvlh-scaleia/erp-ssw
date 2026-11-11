/**
 * Conferência das colunas calculadas (de-para, regra geral): os valores foram copiados como
 * estão, para o primeiro dia bater com o sistema atual; aqui o núcleo recalcula todos os
 * derivados de cada CT-e já gravado no `erp` (`recalcularDerivadosDoCte`) e lista o que mudaria.
 * Diferença vira relatório, nunca correção (Q20/Q52: as mudanças aprovadas explicam parte delas).
 */
import {
  type CatalogoDeCodigos,
  type CodigoCadastrado,
  type ConfiguracaoDoNucleo,
  type CteNucleo,
  type DerivadosDoCte,
  type FilialCadastrada,
  FONTES_DA_EFETIVA,
  FONTES_DE_PRAZO,
  lerConfiguracaoDoNucleo,
  montarCatalogo,
  type OcorrenciaDoCte,
  PROCESSOS_SSW,
  recalcularDerivadosDoCte,
  type RegraDePrazo,
  RESPONSAVEIS,
  TIPOS_SSW,
} from "@erp/dominio/nucleo";

import { type Contagem, contar } from "../motor/estado";
import { type PassoFinal } from "../motor/executar";
import { type Consulta, type Filtros } from "../motor/tipos";
import { daLista } from "../transformacoes/diversas";

const TAMANHO_DO_LOTE = 1000;
const EXEMPLOS_NA_NOTA = 20;

/** Todos os campos que o núcleo devolve (o teste confere contra uma derivação real). */
export const CAMPOS_DERIVADOS = [
  "dataEmissao",
  "unidadeCidade",
  "unidadeUf",
  "filialEfetiva",
  "pagadorCnpjDigitos",
  "canceladoMesmoDia",
  "ocorrEfetivaCodigo",
  "ocorrEfetivaDescricao",
  "ocorrEfetivaData",
  "ocorrEfetivaFonte",
  "ocorrEfetivaLocal",
  "ocorrEfetivaCodigoNum",
  "dataConclusaoEfetiva",
  "dataPrevistaEntrega",
  "prazoFonte",
  "dataBasePrazo",
  "previsaoSswData",
  "previsaoSswFonte",
  "previsaoSswDataBase",
  "prazoPadraoDias",
  "prazoPadraoData",
  "dataEmbarque",
  "statusAtual",
  "foraUniverso",
] as const satisfies readonly (keyof DerivadosDoCte)[];

/** Instante como o JSON do Postgres o escreve (ISO 8601): `to_json(col) #>> '{}'`. */
const iso = (coluna: string, alias = coluna) => `to_json(${coluna}) #>> '{}' as ${alias}`;

export interface LinhaCteGravada {
  id: string;
  data_emissao: string;
  criado_em: string;
  duplicado_de: string | null;
  data_entrega_realizada: string | null;
  cancelado_em: string | null;
  pagador_cnpj: string | null;
  parceiro_cnpj: string | null;
  unidade_destino: string | null;
  unidade_atual: string | null;
  filial: string | null;
  campos_ssw: string[];
  ult_ocorr_codigo_0174: string | null;
  ult_ocorr_descricao_0174: string | null;
  ult_ocorr_data_0174: string | null;
  ult_ocorr_local_0174: string | null;
  ult_ocorr_instrucao_0174: string | null;
  ultima_ocorr_codigo_0013: string | null;
  ultima_ocorr_data_0013: string | null;
  ocorr_036_codigo: string | null;
  ocorr_036_descricao: string | null;
  ocorr_036_data: string | null;
  ocorr_efetiva_codigo: string | null;
  ocorr_efetiva_descricao: string | null;
  ocorr_efetiva_data: string | null;
  ocorr_efetiva_fonte: string | null;
  ocorr_efetiva_local: string | null;
  ocorr_efetiva_codigo_num: number | null;
  data_prevista_entrega: string | null;
  prazo_fonte: string | null;
  data_base_prazo: string | null;
  previsao_ssw_data: string | null;
  previsao_ssw_fonte: string | null;
  previsao_ssw_data_base: string | null;
  data_embarque: string | null;
  data_conclusao_efetiva: string | null;
  pagador_cnpj_digitos: string | null;
  filial_efetiva: string | null;
  unidade_cidade: string | null;
  unidade_uf: string | null;
  prazo_padrao_dias: number | null;
  prazo_padrao_data: string | null;
  status_atual: string | null;
  cancelado_mesmo_dia: boolean;
  fora_universo: boolean;
}

const COLUNAS_DO_CTE = [
  "id::text as id",
  "data_emissao",
  iso("criado_em"),
  "duplicado_de::text as duplicado_de",
  iso("data_entrega_realizada"),
  iso("cancelado_em"),
  "pagador_cnpj",
  "parceiro_cnpj",
  "unidade_destino",
  "unidade_atual",
  "filial",
  "campos_ssw",
  "ult_ocorr_codigo_0174",
  "ult_ocorr_descricao_0174",
  iso("ult_ocorr_data_0174"),
  "ult_ocorr_local_0174",
  "ult_ocorr_instrucao_0174",
  "ultima_ocorr_codigo_0013",
  iso("ultima_ocorr_data_0013"),
  "ocorr_036_codigo",
  "ocorr_036_descricao",
  iso("ocorr_036_data"),
  "ocorr_efetiva_codigo",
  "ocorr_efetiva_descricao",
  iso("ocorr_efetiva_data"),
  "ocorr_efetiva_fonte",
  "ocorr_efetiva_local",
  "ocorr_efetiva_codigo_num",
  "data_prevista_entrega",
  "prazo_fonte",
  iso("data_base_prazo"),
  "previsao_ssw_data",
  "previsao_ssw_fonte",
  iso("previsao_ssw_data_base"),
  "data_embarque",
  "data_conclusao_efetiva",
  "pagador_cnpj_digitos",
  "filial_efetiva",
  "unidade_cidade",
  "unidade_uf",
  "prazo_padrao_dias",
  "prazo_padrao_data",
  "status_atual",
  "cancelado_mesmo_dia",
  "fora_universo",
].join(", ");

function instante(texto: string | null): Date | null {
  if (texto === null) return null;
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) throw new Error(`Instante ilegível: ${texto}`);
  return data;
}

function instanteObrigatorio(texto: string): Date {
  return instante(texto) ?? new Date(Number.NaN);
}

const fontePrazo = (valor: string | null, coluna: string) =>
  valor === null ? null : daLista(valor, FONTES_DE_PRAZO, coluna);

/** Linha gravada em `erp.ctes` → o formato que o núcleo lê. */
export function paraCteNucleo(l: LinhaCteGravada): CteNucleo {
  return {
    dataEmissao: l.data_emissao,
    criadoEm: instanteObrigatorio(l.criado_em),
    duplicadoDe: l.duplicado_de,
    dataEntregaRealizada: instante(l.data_entrega_realizada),
    canceladoEm: instante(l.cancelado_em),
    pagadorCnpj: l.pagador_cnpj,
    parceiroCnpj: l.parceiro_cnpj,
    unidadeDestino: l.unidade_destino,
    unidadeAtual: l.unidade_atual,
    filial: l.filial,
    camposSsw: l.campos_ssw,
    ultOcorrCodigo0174: l.ult_ocorr_codigo_0174,
    ultOcorrDescricao0174: l.ult_ocorr_descricao_0174,
    ultOcorrData0174: instante(l.ult_ocorr_data_0174),
    ultOcorrLocal0174: l.ult_ocorr_local_0174,
    ultOcorrInstrucao0174: l.ult_ocorr_instrucao_0174,
    ultimaOcorrCodigo0013: l.ultima_ocorr_codigo_0013,
    ultimaOcorrData0013: instante(l.ultima_ocorr_data_0013),
    ocorr036Codigo: l.ocorr_036_codigo,
    ocorr036Descricao: l.ocorr_036_descricao,
    ocorr036Data: instante(l.ocorr_036_data),
    ocorrEfetivaCodigo: l.ocorr_efetiva_codigo,
    ocorrEfetivaDescricao: l.ocorr_efetiva_descricao,
    ocorrEfetivaData: instante(l.ocorr_efetiva_data),
    ocorrEfetivaFonte:
      l.ocorr_efetiva_fonte === null
        ? null
        : daLista(l.ocorr_efetiva_fonte, FONTES_DA_EFETIVA, "ocorr_efetiva_fonte"),
    ocorrEfetivaLocal: l.ocorr_efetiva_local,
    ocorrEfetivaCodigoNum: l.ocorr_efetiva_codigo_num,
    dataPrevistaEntrega: l.data_prevista_entrega,
    prazoFonte: fontePrazo(l.prazo_fonte, "prazo_fonte"),
    dataBasePrazo: instante(l.data_base_prazo),
    previsaoSswData: l.previsao_ssw_data,
    previsaoSswFonte: fontePrazo(l.previsao_ssw_fonte, "previsao_ssw_fonte"),
    previsaoSswDataBase: instante(l.previsao_ssw_data_base),
    dataEmbarque: l.data_embarque,
    dataConclusaoEfetiva: l.data_conclusao_efetiva,
    pagadorCnpjDigitos: l.pagador_cnpj_digitos,
    filialEfetiva: l.filial_efetiva,
    unidadeCidade: l.unidade_cidade,
    unidadeUf: l.unidade_uf,
    prazoPadraoDias: l.prazo_padrao_dias,
    prazoPadraoData: l.prazo_padrao_data,
    statusAtual: l.status_atual,
    canceladoMesmoDia: l.cancelado_mesmo_dia,
    foraUniverso: l.fora_universo,
  };
}

function iguais(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

/** Campos em que o valor gravado difere do que o núcleo calcula. */
export function camposDiferentes(cte: CteNucleo, derivados: DerivadosDoCte): string[] {
  return CAMPOS_DERIVADOS.filter((campo) => !iguais(cte[campo], derivados[campo]));
}

interface LinhaOcorrencia {
  cte_id: string;
  id: string;
  codigo: number;
  descricao: string | null;
  data_hora: string;
  filial: string | null;
  origem: string;
  quarentena: boolean;
  criado_em: string;
}

interface ContextoDaEmpresa {
  catalogo: CatalogoDeCodigos;
  filiais: FilialCadastrada[];
  regrasDePrazo: RegraDePrazo[];
  config: ConfiguracaoDoNucleo;
}

async function contextoDaEmpresa(destino: Consulta, empresa: string): Promise<ContextoDaEmpresa> {
  const p = { empresa: { valor: empresa, tipo: "uuid" } };
  const codigos = await destino.consultar<{
    codigo: number;
    descricao: string;
    tipo_ssw: string | null;
    processo_ssw: string | null;
    responsavel: string;
    penaliza: boolean;
  }>(
    `select codigo, descricao, tipo_ssw::text as tipo_ssw, processo_ssw::text as processo_ssw,
            responsavel::text as responsavel, penaliza
       from erp.codigos_ocorrencia where empresa_id = @empresa`,
    p,
  );
  const filiais = await destino.consultar<FilialCadastrada>(
    "select sigla, cidade, uf, propria from erp.filiais where empresa_id = @empresa",
    p,
  );
  const regras = await destino.consultar<{
    id: string;
    tipo: string;
    unidade_codigo: string | null;
    unidade_destino_codigo: string | null;
    parceiro_cnpj: string | null;
    prazo_horas: number | null;
    prazo_dias: number | null;
    ativo: boolean;
    criado_em: string;
  }>(
    `select id::text as id, tipo, unidade_codigo, unidade_destino_codigo, parceiro_cnpj,
            prazo_horas, prazo_dias, ativo, ${iso("criado_em")}
       from erp.prazos_configurados where empresa_id = @empresa`,
    p,
  );
  // A da empresa vence a da Plataforma (empresa_id nulo).
  const valores = await destino.consultar<{ chave: string; valor: string }>(
    `select chave, valor from erp.configuracoes
      where empresa_id is null or empresa_id = @empresa
      order by (empresa_id is not null), chave`,
    p,
  );
  return {
    catalogo: montarCatalogo(
      codigos.map((c): CodigoCadastrado => ({
        codigo: c.codigo,
        descricao: c.descricao,
        tipoSsw: c.tipo_ssw === null ? null : daLista(c.tipo_ssw, TIPOS_SSW, "tipo_ssw"),
        processoSsw:
          c.processo_ssw === null ? null : daLista(c.processo_ssw, PROCESSOS_SSW, "processo_ssw"),
        responsavel: daLista(c.responsavel, RESPONSAVEIS, "responsavel"),
        penaliza: c.penaliza,
      })),
    ),
    filiais,
    regrasDePrazo: regras.map((r) => ({
      id: r.id,
      tipo: daLista(r.tipo, ["unidade", "parceiro", "transbordo"] as const, "tipo"),
      unidadeCodigo: r.unidade_codigo,
      unidadeDestinoCodigo: r.unidade_destino_codigo,
      parceiroCnpj: r.parceiro_cnpj,
      prazoHoras: r.prazo_horas,
      prazoDias: r.prazo_dias,
      ativo: r.ativo,
      criadoEm: instanteObrigatorio(r.criado_em),
    })),
    config: lerConfiguracaoDoNucleo(new Map(valores.map((v) => [v.chave, v.valor]))),
  };
}

async function ocorrenciasDoLote(
  destino: Consulta,
  ids: readonly string[],
): Promise<Map<string, OcorrenciaDoCte[]>> {
  const linhas = await destino.consultar<LinhaOcorrencia>(
    `select cte_id::text as cte_id, id::text as id, codigo, descricao, ${iso("data_hora")},
            filial, origem, quarentena, ${iso("criado_em")}
       from erp.ocorrencias where cte_id = any(@ids)`,
    { ids: { valor: ids, tipo: "uuid[]" } },
  );
  const porCte = new Map<string, OcorrenciaDoCte[]>();
  for (const o of linhas) {
    const lista = porCte.get(o.cte_id) ?? [];
    lista.push({
      id: o.id,
      codigo: o.codigo,
      descricao: o.descricao,
      dataHora: instanteObrigatorio(o.data_hora),
      filial: o.filial,
      origem: o.origem,
      quarentena: o.quarentena,
      criadoEm: instanteObrigatorio(o.criado_em),
    });
    porCte.set(o.cte_id, lista);
  }
  return porCte;
}

/** Recalcula os CT-e de uma empresa e conta, por campo, os que mudariam. */
export async function conferirEmpresa(
  destino: Consulta,
  empresa: string,
  diferencas: Record<string, Contagem>,
): Promise<number> {
  const contexto = await contextoDaEmpresa(destino, empresa);
  let conferidos = 0;
  let apos: string | null = null;
  for (;;) {
    const lote: LinhaCteGravada[] = await destino.consultar<LinhaCteGravada>(
      `select ${COLUNAS_DO_CTE} from erp.ctes
        where empresa_id = @empresa and (@apos is null or id > @apos)
        order by id limit @limite`,
      {
        empresa: { valor: empresa, tipo: "uuid" },
        apos: { valor: apos, tipo: "uuid" },
        limite: { valor: TAMANHO_DO_LOTE, tipo: "integer" },
      },
    );
    if (lote.length === 0) break;
    const ocorrencias = await ocorrenciasDoLote(
      destino,
      lote.map((l) => l.id),
    );
    for (const linha of lote) {
      const cte = paraCteNucleo(linha);
      // Como a próxima gravação sem ocorrência nova: o status atual fica o gravado.
      const derivados = recalcularDerivadosDoCte(cte, {
        ...contexto,
        ocorrencias: ocorrencias.get(linha.id) ?? [],
        ocorrenciasMudaram: false,
      });
      for (const campo of camposDiferentes(cte, derivados)) contar(diferencas, campo, linha.id);
    }
    conferidos += lote.length;
    apos = lote.at(-1)?.id ?? null;
    if (lote.length < TAMANHO_DO_LOTE) break;
  }
  return conferidos;
}

export const conferirColunasCalculadas: PassoFinal = {
  nome: "conferir-colunas-calculadas",
  executar: async (infra, filtros: Filtros, simulacao) => {
    if (simulacao) return ["não roda na simulação (recalcula a partir do que foi gravado)"];
    const empresas = await infra.destino.consultar<{ id: string }>(
      "select id::text as id from erp.empresas where @empresa is null or id = @empresa order by id",
      { empresa: { valor: filtros.empresaId, tipo: "uuid" } },
    );
    const diferencas: Record<string, Contagem> = {};
    let conferidos = 0;
    for (const { id } of empresas)
      conferidos += await conferirEmpresa(infra.destino, id, diferencas);
    const campos = Object.entries(diferencas).sort(([a], [b]) => a.localeCompare(b));
    return [
      `${String(conferidos)} CT-e recalculados com o núcleo (recalcularDerivadosDoCte); ` +
        (campos.length === 0 ? "nenhuma diferença." : "diferenças por campo (não corrigidas):"),
      ...campos.map(
        ([campo, { quantidade, exemplos }]) =>
          `${campo}: ${String(quantidade)} (${exemplos.slice(0, EXEMPLOS_NA_NOTA).join(", ")}${
            quantidade > EXEMPLOS_NA_NOTA ? " …" : ""
          })`,
      ),
    ];
  },
};
