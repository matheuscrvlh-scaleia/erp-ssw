/**
 * Colunas da exportação da Listagem (28, na ordem de hoje) e a linha achatada que vai para o
 * arquivo (biblioteca `@/lib/export`).
 * origem: lista/lista-export.ts (sistema atual)
 */
import { type LinhaLista } from "@erp/shared/contracts/listing";

import { COLUNA_LINK_SSW, type ColunaExportacao, urlCtrcNoSsw } from "@/lib/export";

import { type BuscaDaLista } from "./search";
import { nomesDasUnidades } from "./texts";

export interface LinhaExportada {
  nf: number | null;
  ctrc: string;
  clienteDestino: string | null;
  origem: string;
  destino: string | null;
  cidadeDestino: string | null;
  setor: string | null;
  codigo: number | null;
  tipoOcorrencia: string | null;
  ultimaOcorrencia: string | null;
  placa: string | null;
  emissao: string;
  previsao: string | null;
  entrega: string | null;
  atraso: number | null;
  pagador: string | null;
  expedidor: string | null;
  remetente: string | null;
  documento: string | null;
  peso: number | null;
  frete: number | null;
  volumes: number | null;
  localizacao: string | null;
  primeiroManifesto: string | null;
  ultimoManifesto: string | null;
  valorMercadoria: number | null;
  tde: number | null;
  linkSsw: string | null;
}

export const COLUNAS_DA_EXPORTACAO: readonly ColunaExportacao[] = [
  { chave: "nf", titulo: "NF" },
  { chave: "ctrc", titulo: "CT-e" },
  { chave: "clienteDestino", titulo: "Cliente Destino" },
  { chave: "origem", titulo: "Origem" },
  { chave: "destino", titulo: "Destino" },
  { chave: "cidadeDestino", titulo: "Cidade Destino" },
  { chave: "setor", titulo: "Setor" },
  { chave: "codigo", titulo: "Cód Ocorrência", formato: "inteiro" },
  { chave: "tipoOcorrencia", titulo: "Tipo Ocorrência" },
  { chave: "ultimaOcorrencia", titulo: "Última Ocorrência", formato: "datahora" },
  { chave: "placa", titulo: "Placa" },
  { chave: "emissao", titulo: "Emissão", formato: "data" },
  { chave: "previsao", titulo: "Prev. Entrega", formato: "data" },
  { chave: "entrega", titulo: "Entrega Realizada", formato: "data" },
  { chave: "atraso", titulo: "Atraso (dias)", formato: "inteiro" },
  { chave: "pagador", titulo: "Pagador" },
  { chave: "expedidor", titulo: "Expedidor" },
  { chave: "remetente", titulo: "Remetente" },
  { chave: "documento", titulo: "Documento" },
  { chave: "peso", titulo: "Peso Real (kg)", formato: "decimal" },
  { chave: "frete", titulo: "Valor Frete (R$)", formato: "moeda" },
  { chave: "volumes", titulo: "Qtd Volume", formato: "inteiro" },
  { chave: "localizacao", titulo: "Localização" },
  { chave: "primeiroManifesto", titulo: "1º Manifesto" },
  { chave: "ultimoManifesto", titulo: "Último Manifesto" },
  { chave: "valorMercadoria", titulo: "Valor Mercadoria (R$)", formato: "moeda" },
  { chave: "tde", titulo: "TDE (R$)", formato: "moeda" },
  { chave: "linkSsw", titulo: COLUNA_LINK_SSW },
];

export function linhaExportada(l: LinhaLista): LinhaExportada {
  return {
    nf: l.numeroNf,
    ctrc: l.numero,
    clienteDestino: l.destinatario,
    origem: l.sigla,
    destino: l.unidadeDestino,
    cidadeDestino: l.cidadeDestino,
    setor: l.setor ?? l.setorDestino,
    codigo: l.codigo,
    tipoOcorrencia: l.descricao,
    ultimaOcorrencia: l.dataOcorrencia,
    placa: l.placa,
    emissao: l.dataEmissao,
    previsao: l.dataPrevista,
    entrega: l.dataEntrega,
    atraso: l.atrasoDias,
    pagador: l.pagadorNome,
    expedidor: l.parceiroNome,
    remetente: l.remetente,
    documento: l.tipoDocumento,
    peso: l.peso,
    frete: l.valorFrete,
    volumes: l.volumes,
    localizacao: l.localizacao,
    primeiroManifesto: l.primeiroManifesto,
    ultimoManifesto: l.ultimoManifesto,
    valorMercadoria: l.valorMercadoria,
    tde: l.tde !== null && l.tde > 0 ? l.tde : null,
    linkSsw: urlCtrcNoSsw(l.sigla, l.numero, l.dataEmissao),
  };
}

/** `listagem-ctrcs-atrasados+sem_movimento-2026-11-01-a-2026-11-10` (o kit acrescenta a data). */
export function nomeDoArquivo(recortes: readonly string[], inicio: string, fim: string): string {
  return `listagem-ctrcs-${recortes.join("+")}-${inicio}-a-${fim}`;
}

/** Subtítulo do arquivo: o período e os filtros preenchidos, separados por " · ". */
export function subtituloDaExportacao(
  busca: BuscaDaLista,
  periodo: { inicio: string; fim: string },
): string {
  return [
    `Período: ${periodo.inicio} → ${periodo.fim}`,
    busca.unidades.length ? `Unidades: ${nomesDasUnidades(busca.unidades).join(", ")}` : null,
    busca.parceiros.length ? `Parceiros: ${busca.parceiros.length}` : null,
    busca.codigos.length ? `Códigos: ${busca.codigos.join(", ")}` : null,
    busca.filiais.length ? `Filiais: ${busca.filiais.join(", ")}` : null,
    busca.remetente ? `Remetente: ${busca.remetente}` : null,
    busca.destino ? `Destino: ${busca.destino}` : null,
    busca.cidade ? `Cidade: ${busca.cidade}` : null,
  ]
    .filter((p) => p !== null)
    .join(" · ");
}
