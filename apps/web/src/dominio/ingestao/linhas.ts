/**
 * Identificação de uma linha de relatório em `ingestao_linhas`: hash de deduplicação, chave do
 * CT-e e dia de referência. O migrador usa a mesma conta da ingestão (o worker-ssw tem a cópia,
 * ADR 0012). Spec 06 §2.3 e §3.3.
 */
import { createHash } from "node:crypto";

import { inicioDoDiaSp } from "../nucleo/tempo";
import { COLUNAS_455_CSV } from "./relatorios/colunas-455";
import { ehCtrcDo306 } from "./relatorios/r306";
import { numCtrc, siglaCtrc } from "./relatorios/texto";
import { type Relatorio } from "./relatorios/tipos";

export interface LinhaIdentificada {
  hash: string;
  sigla: string | null;
  numero: string | null;
  dataReferencia: Date | null;
}

// Brasília não tem horário de verão desde 2019: deslocamento fixo (igual ao núcleo).
const DESLOCAMENTO_SP = "-03:00";

/** "aaaa-mm-dd hh:mm[:ss]" (hora de São Paulo, sem fuso) → instante. */
function instanteSp(ingenuo: string): Date {
  const iso = ingenuo.replace(" ", "T");
  return new Date(`${iso.length === 16 ? `${iso}:00` : iso}${DESLOCAMENTO_SP}`);
}

const SEPARADOR = "\u001f";

function textoDoValor(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  return typeof v === "string" ? v : JSON.stringify(v);
}

/** SHA-256 dos campos na ordem da spec, separados por U+001F (vazio = nulo). */
function hashDaLinha(campos: readonly string[], dados: Record<string, unknown>): string {
  return createHash("sha256")
    .update(campos.map((c) => textoDoValor(dados[c])).join(SEPARADOR))
    .digest("hex");
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

const texto = (v: unknown) => (typeof v === "string" ? v : null);
const inicioDoDia = (v: unknown) => {
  const dia = texto(v);
  return dia ? inicioDoDiaSp(dia) : null;
};

/** Por relatório: campos do hash, onde está o CT-e e o dia de referência da linha. */
const IDENTIFICACAO: Record<
  Relatorio,
  {
    campos: readonly string[];
    ctrc: (d: Readonly<Record<string, unknown>>) => string | null;
    referencia: (d: Readonly<Record<string, unknown>>) => Date | null;
  }
> = {
  "930": {
    campos: CAMPOS_930,
    ctrc: (d) => texto(d.ctrc),
    referencia: (d) => {
      const em = texto(d.ocorrencia_em) ?? texto(d.inclusao_em);
      return em ? instanteSp(em) : null;
    },
  },
  "038": { campos: CAMPOS_038, ctrc: (d) => texto(d.ctrc), referencia: () => null },
  // Dia de emissão do romaneio às 00:00 de SP (aba Hoje do Romaneio).
  "036": {
    campos: CAMPOS_036,
    ctrc: (d) => texto(d.ctrc),
    referencia: (d) => inicioDoDia(d.data_emissao),
  },
  "306": {
    campos: CAMPOS_306,
    // Só CTRC/COLETA no formato de CT-e tem sigla e número (coleta pura fica sem chave).
    ctrc: (d) => (ehCtrcDo306(texto(d.ctrc_coleta)) ? texto(d.ctrc_coleta) : null),
    referencia: (d) => inicioDoDia(d.data),
  },
  "455csv": {
    campos: CAMPOS_455,
    ctrc: (d) => texto(d.serie_numero_ctrc),
    referencia: (d) => inicioDoDia(d.data_de_emissao),
  },
};

/**
 * Hash de deduplicação, chave do CT-e (sigla e número, os dois ou nenhum) e dia de referência de
 * uma linha. A mesma conta vale para a linha lida do arquivo e para a migrada do sistema atual.
 */
export function identificarLinha(
  relatorio: Relatorio,
  dados: Readonly<Record<string, unknown>>,
): LinhaIdentificada {
  const regra = IDENTIFICACAO[relatorio];
  const ctrc = regra.ctrc(dados);
  const numero = numCtrc(ctrc);
  const sigla = siglaCtrc(ctrc);
  return {
    hash: hashDaLinha(regra.campos, dados),
    ...(numero === null || sigla === null ? { sigla: null, numero: null } : { sigla, numero }),
    dataReferencia: regra.referencia(dados),
  };
}
