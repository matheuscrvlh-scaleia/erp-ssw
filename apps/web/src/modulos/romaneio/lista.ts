/**
 * Regras da lista da aba Total que a tela e o arquivo exportado compartilham: situação da linha,
 * seleção para exportar e as colunas do arquivo.
 */
import {
  alertasDaLinha,
  atrasoDaLinha,
  atrasoParaExportar,
  type LimitesDeCarga,
  type LinhaSituacao,
  statusDaLinha,
} from "@erp/dominio/romaneio/linha";
import {
  type LinhaExportada,
  type LinhaLista,
  type OrdemLista,
} from "@erp/shared/contratos/romaneio";

import { COLUNA_LINK_SSW, type ColunaExportacao, urlCtrcNoSsw } from "@/lib/exportacao";

export const situacaoDe = (l: LinhaLista): LinhaSituacao => ({
  ...l,
  ultimaOcorrenciaCodigo: l.ultimaOcorrencia?.codigo ?? null,
});

/** "Cidade/UF" (ou só a cidade); vazio vira null. */
export const cidadeUf = (cidade: string | null, uf: string | null) =>
  cidade ? `${cidade}${uf ? `/${uf}` : ""}` : null;

// ---------------------------------------------------------------------------------------------
// Seleção para exportar

/**
 * Guardada por id (sobrevive à troca de página). "todas": tudo marcado, `ids` são as desmarcadas;
 * "somente": a caixa do cabeçalho desmarcou tudo, `ids` são as marcadas depois. `chave` são os
 * filtros em que a seleção foi feita: mudou o filtro, volta para "todas".
 */
export interface Selecao {
  chave: string;
  modo: "todas" | "somente";
  ids: ReadonlySet<string>;
}

export const selecaoInicial = (chave: string): Selecao => ({
  chave,
  modo: "todas",
  ids: new Set(),
});

export const estaMarcada = (s: Selecao, id: string) =>
  s.modo === "todas" ? !s.ids.has(id) : s.ids.has(id);

export function alternarLinha(s: Selecao, id: string): Selecao {
  const ids = new Set(s.ids);
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  return { ...s, ids };
}

/** Quantas linhas da lista inteira (todas as páginas) saem no arquivo. */
export const quantasMarcadas = (s: Selecao, total: number) =>
  s.modo === "todas" ? Math.max(0, total - s.ids.size) : s.ids.size;

/** Caixa do cabeçalho: vale para a lista inteira, não só a página visível. */
export const estadoDoCabecalho = (s: Selecao): boolean | "indeterminate" =>
  s.ids.size === 0 ? s.modo === "todas" : "indeterminate";

export const alternarTodas = (s: Selecao): Selecao => ({
  chave: s.chave,
  modo: estadoDoCabecalho(s) === true ? "somente" : "todas",
  ids: new Set(),
});

// ---------------------------------------------------------------------------------------------
// Ordenação

/** Clicar na coluna já ordenada inverte o sentido; outra coluna começa crescente. */
export function proximaOrdem(
  atual: { ordem?: OrdemLista | undefined; dir: "asc" | "desc" },
  coluna: OrdemLista,
): { ordem: OrdemLista; dir: "asc" | "desc" } {
  if (atual.ordem === coluna) return { ordem: coluna, dir: atual.dir === "asc" ? "desc" : "asc" };
  return { ordem: coluna, dir: "asc" };
}

// ---------------------------------------------------------------------------------------------
// Exportação

/** As colunas da tela, na mesma ordem e com as mesmas regras; no fim, as que só o arquivo tem. */
export const COLUNAS_DA_LISTA: readonly ColunaExportacao[] = [
  { chave: "numeroNf", titulo: "NF" },
  { chave: "numero", titulo: "CTRC" },
  { chave: "status", titulo: "Status" },
  { chave: "dataEmissao", titulo: "Emissão", formato: "data" },
  { chave: "dataEmbarque", titulo: "Embarque", formato: "data" },
  { chave: "dataPrevista", titulo: "Prazo", formato: "data" },
  { chave: "parceiroNome", titulo: "Parceiro" },
  { chave: "filial", titulo: "Unidade" },
  { chave: "cidadeUnidade", titulo: "Cidade Unid." },
  { chave: "unidadeAtual", titulo: "Local. atual" },
  { chave: "placa", titulo: "Placa" },
  { chave: "motorista", titulo: "Motorista" },
  { chave: "remetente", titulo: "Remetente" },
  { chave: "destinatario", titulo: "Cliente destino" },
  { chave: "destino", titulo: "Destino" },
  { chave: "setor", titulo: "Setor" },
  { chave: "bairro", titulo: "Bairro" },
  { chave: "valorMercadoria", titulo: "Vlr. mercadoria (R$)", formato: "moeda" },
  { chave: "peso", titulo: "Peso (kg)", formato: "decimal" },
  { chave: "volumes", titulo: "Volumes", formato: "inteiro" },
  { chave: "valorFrete", titulo: "Frete (R$)", formato: "moeda" },
  { chave: "ultimaOcorrenciaTexto", titulo: "Última ocorrência" },
  { chave: "atraso", titulo: "Atraso" },
  { chave: "alertas", titulo: "Alertas" },
  // Só no arquivo:
  { chave: "pagador", titulo: "Pagador" },
  { chave: "endereco", titulo: "Endereço" },
  { chave: "cep", titulo: "CEP" },
  { chave: "ultimaOcorrenciaCodigo", titulo: "Código última ocorrência" },
  { chave: "ultimaOcorrenciaDataHora", titulo: "Data/hora última ocorrência", formato: "datahora" },
  { chave: "emRotaAgoraTexto", titulo: "Em rota agora" },
  { chave: "placaColeta", titulo: "Placa coleta" },
  { chave: "placaEntrega", titulo: "Placa entrega" },
  { chave: "linkSsw", titulo: COLUNA_LINK_SSW },
];

export function linhaParaExportar(l: LinhaExportada, hoje: string, limites: LimitesDeCarga) {
  const situacao = situacaoDe(l);
  const atraso = atrasoDaLinha(situacao, hoje);
  return {
    ...l,
    status: statusDaLinha(situacao),
    cidadeUnidade: cidadeUf(l.unidadeCidade, l.unidadeUf),
    destino: cidadeUf(l.cidadeDestino, l.ufDestino),
    ultimaOcorrenciaTexto: l.ultimaOcorrencia?.descricao ?? l.statusAtual,
    atraso: atrasoParaExportar(situacao, atraso),
    alertas: alertasDaLinha(situacao, atraso.dias, limites).join(", "),
    ultimaOcorrenciaCodigo: l.ultimaOcorrencia?.codigo ?? null,
    ultimaOcorrenciaDataHora: l.ultimaOcorrencia?.dataHora ?? null,
    emRotaAgoraTexto: l.emRotaAgora ? "Sim" : "Não",
    linkSsw: urlCtrcNoSsw(l.sigla, l.numero, l.dataEmissao),
  };
}
