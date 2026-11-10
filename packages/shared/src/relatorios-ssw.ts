/**
 * Campos das linhas de relatório SSW guardadas em `ingestao_linhas.dados` que o Romaneio lê
 * (aba Hoje, linha do tempo e projeções). Nomes e formatos da spec da ingestão
 * (docs/regras/06-ingestao.md §2.1 e §3): datas `AAAA-MM-DD`, números já convertidos.
 *
 * TODO(ingestao): trocar pelos schemas dos parsers 036/306/038/455/930 quando a ingestão (onda 2)
 * chegar na main; estes cobrem só os campos lidos aqui.
 */
import { z } from "./zod";

const texto = z
  .string()
  .nullish()
  .transform((v) => v ?? null);
const numero = z
  .number()
  .nullish()
  .transform((v) => v ?? null);

export const dados036 = z.object({
  romaneio: texto,
  data_emissao: texto,
  hora_emissao: texto,
  situacao: texto,
  placa: texto,
  motorista: texto,
  ctrc: texto,
  cidade_entrega: texto,
  bairro: texto,
  cod_ocorr_ctrc: texto,
  desc_ocorr_ctrc: texto,
  data_ocorr_ctrc: texto,
  hora_ocorr_ctrc: texto,
  ajudante: texto,
  ajudante_2: texto,
  ajudante_3: texto,
});

export const dados306 = z.object({
  ctrc_coleta: texto,
  data: texto,
  placa: texto,
  motorista: texto,
});

export const dados038 = z.object({
  setor: texto,
  bairro: texto,
  endereco: texto,
  cep: texto,
  valor_mercadoria: numero,
});

export const dados455 = z.object({ valor_mercadoria: numero });

export const dados930 = z.object({
  /** "AAAA-MM-DDThh:mm:00", horário de SP sem fuso. */
  ocorrencia_em: texto,
  cod_ocor: texto,
  descricao_ocor: texto,
  complemento_ocor: texto,
  usuario_ocor: texto,
  unid_ocor: texto,
  empr_ocor: texto,
});
