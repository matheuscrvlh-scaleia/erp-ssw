import { type ColunaExportacao } from "@/lib/exportacao";

/** Colunas do "Exportar" da tela: uma linha por ocorrência dos CT-e filtrados (Q13, Q18). */
export const COLUNAS_DA_EXPORTACAO: ColunaExportacao[] = [
  { chave: "numeroNf", titulo: "NF" },
  { chave: "numero", titulo: "CTRC" },
  { chave: "dataEmissao", titulo: "Data emissão", formato: "data" },
  { chave: "unidade", titulo: "Unidade" },
  { chave: "remetente", titulo: "Remetente" },
  { chave: "destinatario", titulo: "Destinatário" },
  { chave: "cidadeDestino", titulo: "Cidade destino" },
  { chave: "peso", titulo: "Peso (kg)", formato: "decimal" },
  { chave: "volumes", titulo: "Volumes", formato: "inteiro" },
  { chave: "valorFrete", titulo: "Frete (R$)", formato: "moeda" },
  { chave: "placaRomaneio", titulo: "Placa (romaneio)" },
  { chave: "motorista", titulo: "Motorista" },
  { chave: "placaColeta", titulo: "Placa coleta" },
  { chave: "placaEntrega", titulo: "Placa entrega" },
  { chave: "cteVinculo", titulo: "CT-e vínculo" },
  { chave: "romaneio", titulo: "Romaneio" },
  { chave: "codigo", titulo: "Código" },
  { chave: "descricao", titulo: "Descrição" },
  { chave: "dataHora", titulo: "Data/hora ocorrência", formato: "datahora" },
  { chave: "status", titulo: "Status" },
];
