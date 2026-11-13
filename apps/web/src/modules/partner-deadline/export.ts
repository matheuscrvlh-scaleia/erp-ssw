/** Colunas e linhas das exportações (CSV/Excel) do Prazo do parceiro. */
import { type LinhaPrazo, type NascidoAtrasado } from "@erp/shared/contracts/partner-deadline";

import { COLUNA_LINK_SSW, type ColunaExportacao, urlCtrcNoSsw } from "@/lib/export";

import { destinoDe } from "./texts";

/** Lista de CT-e da visão geral. */
export const COLUNAS_DA_LISTA: readonly ColunaExportacao[] = [
  { chave: "numero", titulo: "CTRC" },
  { chave: "parceiroNome", titulo: "Parceiro" },
  { chave: "dataEmbarque", titulo: "Embarque", formato: "data" },
  { chave: "dataPrevista", titulo: "Prazo entrega", formato: "data" },
  { chave: "prazoPadraoData", titulo: "Mínimo 48h", formato: "data" },
  { chave: "diasAbaixoDoPadrao", titulo: "Abaixo do padrão (dias)", formato: "inteiro" },
  { chave: "origem", titulo: "Origem do prazo" },
  { chave: "statusAtual", titulo: "Status" },
  { chave: "setor", titulo: "Setor" },
  { chave: "unidadeNome", titulo: "Unidade" },
  { chave: "nascido", titulo: "Nascido em atraso" },
  { chave: "linkSsw", titulo: COLUNA_LINK_SSW },
];

export const linhaDaLista = (l: LinhaPrazo) => ({
  ...l,
  origem: l.prazoOrigem === "parceiro" ? "Parceiro" : "Próprio",
  nascido: l.nasceuAtrasado ? "Sim" : "Não",
  linkSsw: urlCtrcNoSsw(l.sigla, l.numero, l.dataEmissao),
});

/** CT-e nascidos em atraso do detalhe do parceiro. */
export const COLUNAS_DOS_NASCIDOS: readonly ColunaExportacao[] = [
  { chave: "numero", titulo: "CTRC" },
  { chave: "dataEmbarque", titulo: "Embarque", formato: "data" },
  { chave: "dataPrevista", titulo: "Prazo entrega", formato: "data" },
  { chave: "prazoPadraoData", titulo: "Mínimo 48h", formato: "data" },
  { chave: "diasAbaixoDoPadrao", titulo: "Abaixo das 48h (dias)", formato: "inteiro" },
  { chave: "statusAtual", titulo: "Status" },
  { chave: "setor", titulo: "Setor" },
  { chave: "destino", titulo: "Destino" },
  { chave: "unidadeNome", titulo: "Unidade" },
  { chave: "linkSsw", titulo: COLUNA_LINK_SSW },
];

export const linhaDoNascido = (n: NascidoAtrasado) => ({
  ...n,
  destino: destinoDe(n),
  linkSsw: urlCtrcNoSsw(n.sigla, n.numero, n.dataEmissao),
});

/** Nome do arquivo sem acento nem espaço ("prazo-parceiro-transportes-abc"). */
export const slug = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
