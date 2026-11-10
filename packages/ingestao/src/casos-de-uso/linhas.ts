/**
 * Da linha lida à linha de `ingestao_linhas`: hash de deduplicação, chave do CT-e e dia de
 * referência. Spec 06 §2.3 e §3.3.
 */
import { createHash } from "node:crypto";

import { inicioDoDiaSp } from "@erp/dominio/nucleo";

import { instanteSp } from "../aplicacao";
import {
  type AnaliseDoRelatorio,
  COLUNAS_455_CSV,
  ehCtrcDo306,
  numCtrc,
  siglaCtrc,
} from "../relatorios";
import { type LinhaNova } from "./portas";

const SEPARADOR = "\u001f";

function textoDoValor(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  return typeof v === "string" ? v : JSON.stringify(v);
}

/** SHA-256 dos campos na ordem da spec, separados por U+001F (vazio = nulo). */
export function hashDaLinha(campos: readonly string[], dados: Record<string, unknown>): string {
  return createHash("sha256")
    .update(campos.map((c) => textoDoValor(dados[c])).join(SEPARADOR))
    .digest("hex");
}

export function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// Campos do hash, nesta ordem (spec 06 §2.3).
const CAMPOS_930 =
  "ctrc emissao_ctrc serie_cte nro_cte serie_nota_fiscal nro_nota_fiscal pedido empr_ocor unid_ocor inclusao_em ocorrencia_em usuario_ocor cod_ocor descricao_ocor complemento_ocor data_entrega descr_item primeiro_manifesto cancelado cnpj_pagador nome_pagador".split(
    " ",
  );
const CAMPOS_038 =
  "sem_prazo_definido ctrc nota_fiscal remetente destinatario endereco cidade bairro cep setor valor_mercadoria quantidade_volumes peso prazo_entrega atraso ultima_ocorrencia localizacao".split(
    " ",
  );
const CAMPOS_306 =
  "placa ctrc_coleta data motorista remetente uf_cidade_origem setor_origem destinatario uf_cidade_destino unidade_destino setor_destino data_previsao_entrega ocorrencia_mobile ocorrencia_atual".split(
    " ",
  );
const CAMPOS_036 =
  "romaneio data_emissao hora_emissao situacao placa placa_carreta motorista cpf_motorista seguradora autorizacao validade ctrc tipo_frete nome_remetente nome_destinatario cnpj_pagador nome_pagador cidade_pagador cidade_entrega cep_entrega local_entrega bairro setor_dest cod_ocorr_rom desc_ocorr_rom data_ocorr_rom hora_ocorr_rom cod_ocorr_ctrc desc_ocorr_ctrc data_ocorr_ctrc hora_ocorr_ctrc frete_ctrc_origem frete_ctrc peso_calculo qtde_vol vlr_merc cod_merc serie_nf numero_nf nro_pedido conferente ajudante ajudante_2 ajudante_3 emitido_por prev_entrega_ctrc".split(
    " ",
  );
/** 455 CSV: todas as colunas do relatório. */
const CAMPOS_455 = COLUNAS_455_CSV.map((c) => c.coluna);

function chave(ctrc: string | null): { sigla: string | null; numero: string | null } {
  const numero = numCtrc(ctrc);
  const sigla = siglaCtrc(ctrc);
  return numero === null || sigla === null ? { sigla: null, numero: null } : { sigla, numero };
}

/**
 * Linhas a gravar, sem repetição dentro do próprio arquivo (a mesma linha duas vezes fica uma).
 * `dados` guarda os campos com os nomes de coluna do relatório.
 */
export function linhasParaGravar(lido: AnaliseDoRelatorio): LinhaNova[] {
  const vistas = new Set<string>();
  const saida: LinhaNova[] = [];
  const empurrar = (
    numeroLinha: number,
    campos: readonly string[],
    dados: Record<string, unknown>,
    ctrc: string | null,
    dataReferencia: Date | null,
  ) => {
    const hash = hashDaLinha(campos, dados);
    if (vistas.has(hash)) return;
    vistas.add(hash);
    saida.push({ numeroLinha, hash, ...chave(ctrc), dataReferencia, dados });
  };
  switch (lido.relatorio) {
    case "930":
      for (const { linha, dados } of lido.analise.registros) {
        const em = dados.ocorrencia_em ?? dados.inclusao_em;
        empurrar(linha, CAMPOS_930, { ...dados }, dados.ctrc, em ? instanteSp(em) : null);
      }
      break;
    case "038":
      for (const { linha, dados } of lido.analise.registros) {
        empurrar(linha, CAMPOS_038, { ...dados }, dados.ctrc, null);
      }
      break;
    case "036":
      for (const { linha, dados } of lido.analise.registros) {
        const dia = dados.data_emissao;
        empurrar(linha, CAMPOS_036, { ...dados }, dados.ctrc, dia ? inicioDoDiaSp(dia) : null);
      }
      break;
    case "306":
      for (const { linha, dados } of lido.analise.registros) {
        const ctrc = ehCtrcDo306(dados.ctrc_coleta) ? dados.ctrc_coleta : null;
        const dia = dados.data;
        empurrar(linha, CAMPOS_306, { ...dados }, ctrc, dia ? inicioDoDiaSp(dia) : null);
      }
      break;
    case "455csv":
      for (const { linha, dados } of lido.analise.registros) {
        const ctrc = typeof dados.serie_numero_ctrc === "string" ? dados.serie_numero_ctrc : null;
        const dia = typeof dados.data_de_emissao === "string" ? dados.data_de_emissao : null;
        empurrar(linha, CAMPOS_455, { ...dados }, ctrc, dia ? inicioDoDiaSp(dia) : null);
      }
      break;
  }
  return saida;
}
