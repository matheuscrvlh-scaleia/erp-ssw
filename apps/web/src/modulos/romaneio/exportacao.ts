/** Colunas e linhas do arquivo exportado da lista da aba Total (as mesmas regras da tela). */
import {
  alertasDaLinha,
  atrasoDaLinha,
  atrasoParaExportar,
  type LimitesDeCarga,
  statusDaLinha,
} from "@erp/dominio/romaneio/linha";
import { type LinhaExportada } from "@erp/shared/contratos/romaneio";

import { COLUNA_LINK_SSW, type ColunaExportacao, urlCtrcNoSsw } from "@/lib/exportacao";

import { situacaoDe } from "./regras";
import { cidadeUf } from "./textos";

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
