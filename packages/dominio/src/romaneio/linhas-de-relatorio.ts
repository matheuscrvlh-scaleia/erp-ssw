/**
 * Linhas de relatório guardadas (`ingestao_linhas.dados`) → linhas que as regras do Romaneio
 * usam. Validadas pelo schema de cada relatório.
 */
import { dados036, dados038, dados306, dados455, dados930 } from "@erp/shared/relatorios-ssw";

import { type Linha036 } from "./hoje";
import { type Linha930 } from "./linha-do-tempo";
import { type Linha038, type Linha306, type Linha455 } from "./projecoes";

export function linha036De(dados: unknown, importadoEm: Date): Linha036 {
  const l = dados036.parse(dados);
  return {
    romaneio: l.romaneio,
    ctrc: l.ctrc,
    situacao: l.situacao,
    placa: l.placa,
    motorista: l.motorista,
    ajudante: l.ajudante,
    ajudante2: l.ajudante_2,
    ajudante3: l.ajudante_3,
    dataEmissao: l.data_emissao,
    horaEmissao: l.hora_emissao,
    cidadeEntrega: l.cidade_entrega,
    bairro: l.bairro,
    codOcorrCtrc: l.cod_ocorr_ctrc,
    descOcorrCtrc: l.desc_ocorr_ctrc,
    dataOcorrCtrc: l.data_ocorr_ctrc,
    horaOcorrCtrc: l.hora_ocorr_ctrc,
    importadoEm,
  };
}

export function linha306De(dados: unknown, importadoEm: Date): Linha306 {
  const l = dados306.parse(dados);
  return {
    ctrcColeta: l.ctrc_coleta,
    data: l.data,
    placa: l.placa,
    motorista: l.motorista,
    importadoEm,
  };
}

export function linha038De(dados: unknown, importadoEm: Date): Linha038 {
  const l = dados038.parse(dados);
  return {
    setor: l.setor,
    bairro: l.bairro,
    endereco: l.endereco,
    cep: l.cep,
    valorMercadoria: l.valor_mercadoria,
    importadoEm,
  };
}

export function linha455De(dados: unknown, importadoEm: Date): Linha455 {
  return { valorMercadoria: dados455.parse(dados).valor_mercadoria, importadoEm };
}

/** O 930 traz data/hora em horário de SP sem fuso. atalho: −3 h fixo (sem horário de verão). */
export function linha930De(dados: unknown): Linha930 {
  const l = dados930.parse(dados);
  return {
    ocorrenciaEm: l.ocorrencia_em ? new Date(`${l.ocorrencia_em.slice(0, 19)}-03:00`) : null,
    codigo: l.cod_ocor,
    descricao: l.descricao_ocor,
    complemento: l.complemento_ocor,
    usuario: l.usuario_ocor,
    unidade: l.unid_ocor,
    empresa: l.empr_ocor,
  };
}
