/** CT-e (de-para "CT-e"): `public.ctrcs` → `erp.ctes` e o histórico de previsões. */
import { ctePrazoHistorico, ctes, fontesDePrazo, prazoOrigem } from "@erp/db/schema";

import { daEmpresa } from "../motor/sql";
import { definirTabela, descartar, type Filtros, type Fontes, migrar } from "../motor/tipos";
import {
  digitos,
  filialEfetiva,
  normCodigoOcorr,
  NUMERO_DE_CTE_VALIDO,
  numeroDoCte,
  SIGLA_DE_CTE_VALIDA,
  siglaDoCte,
} from "../transformacoes/cte";
import { daLista } from "../transformacoes/diversas";
import { ErroDeConversao } from "../transformacoes/erros";
import { dinheiro, peso, smallint } from "../transformacoes/numeros";
import { ESCOPO_DA_EMPRESA, ou, PELO_ID, referenciaEmpresa, referenciaPorId } from "./comum";

export interface OrigemCte {
  id: string;
  empresa_id: string;
  numero_ctrc: string;
  sigla_ctrc: string | null;
  chave_cte: string | null;
  sigla_cte: string | null;
  numero_cte: string | null;
  tipo_documento: string | null;
  tipo_documento_455: string | null;
  data_emissao: string;
  data_embarque: string | null;
  data_entrega_realizada: string | null;
  data_conclusao_efetiva: string | null;
  unidade_id: string | null;
  parceiro_id: string | null;
  equipe_id: string | null;
  remetente: string | null;
  cnpj_remetente: string | null;
  destinatario: string | null;
  cnpj_destinatario: string | null;
  pagador_nome: string | null;
  pagador_cnpj: string | null;
  parceiro_cnpj: string | null;
  parceiro_nome: string | null;
  cidade_destino: string | null;
  uf_destino: string | null;
  bairro_destino: string | null;
  logradouro_destino: string | null;
  numero_endereco_destino: string | null;
  complemento_destino: string | null;
  cep_destinatario: string | null;
  setor: string | null;
  setor_destino: string | null;
  filial: string | null;
  unidade_origem: string | null;
  unidade_destino: string | null;
  unidade_atual: string | null;
  localizacao_atual: string | null;
  unidade_cidade: string | null;
  unidade_uf: string | null;
  chave_nfe: string | null;
  numero_nf: number | null;
  serie_nf: string | null;
  peso: string | null;
  volumes: number | null;
  valor_frete: string | null;
  valor_mercadoria: string | null;
  tde: string | null;
  nro_manifesto: string | null;
  primeiro_manifesto: string | null;
  ultimo_manifesto: string | null;
  prazo_entrega: string | null;
  prazo_origem: string | null;
  prazo_contratado_dias: number | null;
  prazo_fonte: string | null;
  data_base_prazo: string | null;
  data_prevista_entrega: string | null;
  prazo_padrao_dias: number | null;
  prazo_padrao_data: string | null;
  performance_dias: number | null;
  no_prazo: boolean | null;
  responsabilidade_cliente: boolean | null;
  fonte_performance: string | null;
  atraso_dias: number | null;
  status_atual: string | null;
  motorista_nome: string | null;
  ajudante_nome: string | null;
  placa_coleta: string | null;
  placa_entrega: string | null;
  comprovante_escaneado: boolean | null;
  comprovante_escaneado_em: string | null;
  ultima_ocorr_codigo_0013: string | null;
  ultima_ocorr_data_0013: string | null;
  ult_ocorr_codigo_0174: string | null;
  ult_ocorr_descricao_0174: string | null;
  ult_ocorr_data_0174: string | null;
  ult_ocorr_local_0174: string | null;
  ult_ocorr_instrucao_0174: string | null;
  ocorr_036_codigo: string | null;
  ocorr_036_descricao: string | null;
  ocorr_036_data: string | null;
  ocorr_efetiva_codigo: string | null;
  ocorr_efetiva_descricao: string | null;
  ocorr_efetiva_data: string | null;
  ocorr_efetiva_fonte: string | null;
  ocorr_efetiva_local: string | null;
  cancelado_mesmo_dia: boolean | null;
  fora_universo: boolean | null;
  campos_ssw: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Colunas lidas de `public.ctrcs` (as sem leitor do de-para ficam de fora). */
const COLUNAS_DO_CTRC = `o.id, o.empresa_id, o.numero_ctrc, o.sigla_ctrc, o.chave_cte, o.sigla_cte,
  o.numero_cte, o.tipo_documento, o.tipo_documento_455, o.data_emissao, o.data_embarque,
  o.data_entrega_realizada, o.data_conclusao_efetiva, o.unidade_id, o.parceiro_id, o.equipe_id,
  o.remetente, o.cnpj_remetente, o.destinatario, o.cnpj_destinatario, o.pagador_nome,
  o.pagador_cnpj, o.parceiro_cnpj, o.parceiro_nome, o.cidade_destino, o.uf_destino,
  o.bairro_destino, o.logradouro_destino, o.numero_endereco_destino, o.complemento_destino,
  o.cep_destinatario, o.setor, o.setor_destino, o.filial, o.unidade_origem, o.unidade_destino,
  o.unidade_atual, o.localizacao_atual, o.unidade_cidade, o.unidade_uf, o.chave_nfe, o.numero_nf,
  o.serie_nf, o.peso, o.volumes, o.valor_frete, o.valor_mercadoria, o.tde, o.nro_manifesto,
  o.primeiro_manifesto, o.ultimo_manifesto, o.prazo_entrega, o.prazo_origem::text as prazo_origem,
  o.prazo_contratado_dias, o.prazo_fonte, o.data_base_prazo, o.data_prevista_entrega,
  o.prazo_padrao_dias, o.prazo_padrao_data, o.performance_dias, o.no_prazo,
  o.responsabilidade_cliente, o.fonte_performance, o.atraso_dias, o.status_atual, o.motorista_nome,
  o.ajudante_nome, o.placa_coleta, o.placa_entrega, o.comprovante_escaneado,
  o.comprovante_escaneado_em, o.ultima_ocorr_codigo_0013, o.ultima_ocorr_data_0013,
  o.ult_ocorr_codigo_0174, o.ult_ocorr_descricao_0174, o.ult_ocorr_data_0174,
  o.ult_ocorr_local_0174, o.ult_ocorr_instrucao_0174, o.ocorr_036_codigo, o.ocorr_036_descricao,
  o.ocorr_036_data, o.ocorr_efetiva_codigo, o.ocorr_efetiva_descricao, o.ocorr_efetiva_data,
  o.ocorr_efetiva_fonte, o.ocorr_efetiva_local, o.cancelado_mesmo_dia, o.fora_universo,
  o.campos_ssw, o.created_at, o.updated_at`;

export interface ApoioCte {
  /** Sigla que o 455 deu ao CT-e sem sigla (mesmo número e emissão). */
  siglaDo455: ReadonlyMap<string, string>;
  /** O 455 tem mais de uma sigla para o número + emissão: não há como escolher. */
  siglaAmbigua: ReadonlySet<string>;
  /** CT-e que perde o conflito de sigla + número para outro mais novo. */
  perdedores: ReadonlySet<string>;
}

interface IdentidadeLida {
  id: string;
  empresa_id: string;
  numero_ctrc: string;
  sigla_ctrc: string | null;
  atualizado: string | null;
}

/**
 * Regra do conflito (de-para): dois `ctrcs` com a mesma sigla e número migram como um só — o de
 * `atualizado_em` mais novo (empate: o maior id). O texto de instante do Postgres em UTC compara
 * na ordem certa como texto.
 */
export function perdedoresDoConflito(
  linhas: readonly IdentidadeLida[],
  siglaDo455: ReadonlyMap<string, string>,
): Set<string> {
  const vencedor = new Map<string, IdentidadeLida>();
  const perdedores = new Set<string>();
  const maisNovo = (a: IdentidadeLida, b: IdentidadeLida) =>
    (a.atualizado ?? "") > (b.atualizado ?? "") ||
    ((a.atualizado ?? "") === (b.atualizado ?? "") && a.id > b.id);
  for (const linha of linhas) {
    const numero = numeroDoCte(linha.numero_ctrc);
    const sigla = siglaDoCte(linha.sigla_ctrc, linha.numero_ctrc, siglaDo455.get(linha.id) ?? null);
    if (numero === null || sigla === null) continue;
    const chave = `${linha.empresa_id}|${sigla}|${numero}`;
    const atual = vencedor.get(chave);
    if (!atual) {
      vencedor.set(chave, linha);
    } else if (maisNovo(linha, atual)) {
      perdedores.add(atual.id);
      vencedor.set(chave, linha);
    } else {
      perdedores.add(linha.id);
    }
  }
  return perdedores;
}

async function prepararCtes(fontes: Fontes, filtros: Filtros): Promise<ApoioCte> {
  const empresa = { empresa: { valor: filtros.empresaId, tipo: "uuid" } };
  const candidatas = await fontes.origem.consultar<{ id: string; siglas: string[] }>(
    `with sem_sigla as (
       select c.id, c.empresa_id, c.data_emissao,
              ltrim(regexp_replace(split_part(btrim(c.numero_ctrc), '-', 1), '\\D', '', 'g'), '0') as num
         from public.ctrcs c
        where nullif(btrim(c.sigla_ctrc), '') is null
          and position('/' in c.numero_ctrc) = 0
          and ${daEmpresa("c.empresa_id")}
     )
     select s.id::text as id,
            array_agg(distinct upper(substring(btrim(e.serie_numero_ctrc) from '^([A-Za-z]+)'))) as siglas
       from sem_sigla s
       join public.staging_455_csv e
         on e.empresa_id = s.empresa_id
        and e.data_de_emissao = s.data_emissao
        and ltrim(regexp_replace(split_part(btrim(e.serie_numero_ctrc), '-', 1), '\\D', '', 'g'), '0') = s.num
      where substring(btrim(e.serie_numero_ctrc) from '^([A-Za-z]+)') is not null
      group by s.id`,
    empresa,
  );
  const siglaDo455 = new Map<string, string>();
  const siglaAmbigua = new Set<string>();
  for (const { id, siglas } of candidatas) {
    const [unica] = siglas;
    if (siglas.length === 1 && unica !== undefined) siglaDo455.set(id, unica);
    else siglaAmbigua.add(id);
  }
  const identidades = await fontes.origem.consultar<IdentidadeLida>(
    `select c.id::text as id, c.empresa_id::text as empresa_id, c.numero_ctrc, c.sigla_ctrc,
            coalesce(c.updated_at, c.created_at)::text as atualizado
       from public.ctrcs c where ${daEmpresa("c.empresa_id")}`,
    empresa,
  );
  return { siglaDo455, siglaAmbigua, perdedores: perdedoresDoConflito(identidades, siglaDo455) };
}

const BIGINT = /^-?\d{1,18}$/;

function bigintEmTexto(valor: string | null, coluna: string): string | null {
  if (valor === null) return null;
  if (!BIGINT.test(valor)) throw new ErroDeConversao(coluna, valor, "não é bigint");
  return valor;
}

export function transformarCte(o: OrigemCte, apoio: ApoioCte, filtros: Filtros) {
  const numero = numeroDoCte(o.numero_ctrc);
  if (numero === null || !NUMERO_DE_CTE_VALIDO.test(numero)) {
    return descartar("número do CT-e sem dígitos válidos");
  }
  if (apoio.siglaAmbigua.has(o.id) && siglaDoCte(o.sigla_ctrc, o.numero_ctrc, null) === null) {
    return descartar("sem sigla, e o 455 tem mais de uma para o número e a emissão");
  }
  const sigla = siglaDoCte(o.sigla_ctrc, o.numero_ctrc, apoio.siglaDo455.get(o.id) ?? null);
  if (sigla === null) return descartar("sem sigla (nem no número, nem no 455)");
  if (!SIGLA_DE_CTE_VALIDA.test(sigla)) return descartar("sigla com caractere que não é letra");
  if (apoio.perdedores.has(o.id)) {
    return descartar("mesma sigla e número de outro CT-e (ficou o atualizado por último)");
  }
  const codigoNum = normCodigoOcorr(o.ocorr_efetiva_codigo);
  return migrar({
    id: o.id,
    empresaId: o.empresa_id,
    sigla,
    numero,
    chave: o.chave_cte,
    siglaCte: o.sigla_cte,
    numeroCte: bigintEmTexto(o.numero_cte, "numero_cte"),
    tipoDocumento: o.tipo_documento,
    tipoDocumento455: o.tipo_documento_455,
    // FK para outro CT-e: gravada em `aposMigrar`, quando todos já existem.
    duplicadoDe: null,
    dataEmissao: o.data_emissao,
    dataEmbarque: o.data_embarque,
    dataEntregaRealizada: o.data_entrega_realizada,
    dataConclusaoEfetiva: o.data_conclusao_efetiva,
    unidadeId: o.unidade_id,
    parceiroId: o.parceiro_id,
    equipeId: o.equipe_id,
    remetente: o.remetente,
    cnpjRemetente: o.cnpj_remetente,
    destinatario: o.destinatario,
    cnpjDestinatario: o.cnpj_destinatario,
    pagadorNome: o.pagador_nome,
    pagadorCnpj: o.pagador_cnpj,
    // TODO(nucleo): trocar pela regra de packages/dominio/src/nucleo quando existir na main.
    pagadorCnpjDigitos: digitos(o.pagador_cnpj),
    parceiroCnpj: o.parceiro_cnpj,
    parceiroNome: o.parceiro_nome,
    cidadeDestino: o.cidade_destino,
    ufDestino: o.uf_destino,
    bairroDestino: o.bairro_destino,
    logradouroDestino: o.logradouro_destino,
    numeroEnderecoDestino: o.numero_endereco_destino,
    complementoDestino: o.complemento_destino,
    cepDestinatario: o.cep_destinatario,
    setor: o.setor,
    setorDestino: o.setor_destino,
    filial: o.filial,
    unidadeOrigem: o.unidade_origem,
    unidadeDestino: o.unidade_destino,
    unidadeAtual: o.unidade_atual,
    localizacaoAtual: o.localizacao_atual,
    // TODO(nucleo): trocar pela regra de packages/dominio/src/nucleo quando existir na main.
    filialEfetiva: filialEfetiva(o.unidade_destino, o.unidade_atual, o.filial),
    // TODO(nucleo): colunas calculadas copiadas como estão (o recálculo confere no fim).
    unidadeCidade: o.unidade_cidade,
    unidadeUf: o.unidade_uf,
    chaveNfe: o.chave_nfe,
    numeroNf: o.numero_nf,
    serieNf: o.serie_nf,
    peso: peso(o.peso, "peso"),
    volumes: o.volumes,
    valorFrete: dinheiro(o.valor_frete, "valor_frete"),
    valorMercadoria: dinheiro(o.valor_mercadoria, "valor_mercadoria"),
    tde: dinheiro(o.tde, "tde"),
    nroManifesto: o.nro_manifesto,
    primeiroManifesto: o.primeiro_manifesto,
    ultimoManifesto: o.ultimo_manifesto,
    prazoEntrega: o.prazo_entrega,
    prazoOrigem: daLista(o.prazo_origem ?? "proprio", prazoOrigem.enumValues, "prazo_origem"),
    prazoContratadoDias: o.prazo_contratado_dias,
    prazoFonte:
      o.prazo_fonte === null ? null : daLista(o.prazo_fonte, fontesDePrazo, "prazo_fonte"),
    dataBasePrazo: o.data_base_prazo,
    dataPrevistaEntrega: o.data_prevista_entrega,
    prazoPadraoDias: smallint(o.prazo_padrao_dias, "prazo_padrao_dias"),
    prazoPadraoData: o.prazo_padrao_data,
    performanceDias: o.performance_dias,
    noPrazo: o.no_prazo,
    responsabilidadeCliente: o.responsabilidade_cliente,
    fontePerformance: o.fonte_performance,
    atrasoDias: o.atraso_dias,
    statusAtual: o.status_atual,
    motoristaNome: o.motorista_nome,
    ajudanteNome: o.ajudante_nome,
    placaColeta: o.placa_coleta,
    placaEntrega: o.placa_entrega,
    comprovanteEscaneado: o.comprovante_escaneado,
    comprovanteEscaneadoEm: o.comprovante_escaneado_em,
    ultimaOcorrCodigo0013: o.ultima_ocorr_codigo_0013,
    ultimaOcorrData0013: o.ultima_ocorr_data_0013,
    ultOcorrCodigo0174: o.ult_ocorr_codigo_0174,
    ultOcorrDescricao0174: o.ult_ocorr_descricao_0174,
    ultOcorrData0174: o.ult_ocorr_data_0174,
    ultOcorrLocal0174: o.ult_ocorr_local_0174,
    ultOcorrInstrucao0174: o.ult_ocorr_instrucao_0174,
    ocorr036Codigo: o.ocorr_036_codigo,
    ocorr036Descricao: o.ocorr_036_descricao,
    ocorr036Data: o.ocorr_036_data,
    ocorrEfetivaCodigo: o.ocorr_efetiva_codigo,
    // TODO(nucleo): trocar pela regra de packages/dominio/src/nucleo quando existir na main.
    ocorrEfetivaCodigoNum: smallint(codigoNum, "ocorr_efetiva_codigo_num"),
    ocorrEfetivaDescricao: o.ocorr_efetiva_descricao,
    ocorrEfetivaData: o.ocorr_efetiva_data,
    ocorrEfetivaFonte: o.ocorr_efetiva_fonte,
    ocorrEfetivaLocal: o.ocorr_efetiva_local,
    canceladoMesmoDia: ou(o.cancelado_mesmo_dia, false),
    foraUniverso: ou(o.fora_universo, false),
    camposSsw: ou(o.campos_ssw, []),
    criadoEm: o.created_at ?? filtros.instante,
    atualizadoEm: o.updated_at ?? o.created_at ?? filtros.instante,
  });
}

export const passoCtes = definirTabela({
  nome: "ctes",
  origem: "public.ctrcs",
  tabela: ctes,
  consulta: {
    colunas: COLUNAS_DO_CTRC,
    de: "public.ctrcs o",
    onde: [daEmpresa("o.empresa_id")],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemCte) => o.id,
  preparar: prepararCtes,
  transformar: transformarCte,
  conflito: ["empresaId", "sigla", "numero"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  chaveDestino: ["id"],
  referencias: [
    referenciaEmpresa(ctes, "empresaId"),
    referenciaPorId(ctes, "unidadeId", "erp.unidades", {
      anular: "unidadeId",
      motivo: "unidade não migrou (vira nula)",
    }),
    referenciaPorId(ctes, "parceiroId", "erp.parceiros", {
      anular: "parceiroId",
      motivo: "parceiro não migrou (vira nulo)",
    }),
    referenciaPorId(ctes, "equipeId", "erp.equipes", {
      anular: "equipeId",
      motivo: "equipe não migrou (vira nula)",
    }),
  ],
  foraDaConferencia: ["duplicadoDe"],
  aposMigrar: async ({ origem, executor }, filtros) => {
    const copias = await origem.consultar<{ id: string; duplicado_de: string }>(
      `select o.id::text as id, o.duplicado_de::text as duplicado_de
         from public.ctrcs o where o.duplicado_de is not null and ${daEmpresa("o.empresa_id")}`,
      { empresa: { valor: filtros.empresaId, tipo: "uuid" } },
    );
    const gravadas = await executor.executar(
      `update erp.ctes d set duplicado_de = v.duplicado_de
         from unnest(@ids, @originais) as v(id, duplicado_de)
        where d.id = v.id and exists (select 1 from erp.ctes x where x.id = v.duplicado_de)`,
      {
        ids: { valor: copias.map((c) => c.id), tipo: "uuid[]" },
        originais: { valor: copias.map((c) => c.duplicado_de), tipo: "uuid[]" },
      },
    );
    return [
      `duplicado_de gravado em ${String(gravadas)} de ${String(copias.length)} cópias` +
        " (o resto: a cópia ou o original não migrou)",
    ];
  },
});

interface OrigemPrazoHistorico {
  id: string;
  ctrc_id: string;
  data_anterior: string | null;
  data_nova: string | null;
  fonte: string | null;
  created_at: string | null;
  empresa_id: string;
}

export const passoCtePrazoHistorico = definirTabela({
  nome: "cte_prazo_historico",
  origem: "public.ctrc_prazo_historico",
  tabela: ctePrazoHistorico,
  consulta: {
    colunas: "o.*",
    de: "public.ctrc_prazo_historico o",
    onde: [daEmpresa("o.empresa_id")],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemPrazoHistorico) => o.id,
  preparar: () => Promise.resolve(null),
  transformar: (o, _apoio, filtros) =>
    migrar({
      id: o.id,
      empresaId: o.empresa_id,
      cteId: o.ctrc_id,
      dataAnterior: o.data_anterior,
      dataNova: o.data_nova,
      fonte: o.fonte,
      criadoEm: o.created_at ?? filtros.instante,
    }),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    referenciaPorId(ctePrazoHistorico, "cteId", "erp.ctes", { descartar: "CT-e não migrou" }),
  ],
});
