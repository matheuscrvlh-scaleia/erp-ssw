/**
 * PDF do CT-e: os blocos do detalhe em três colunas (seção, campo, valor), pela biblioteca de
 * exportação (marca da empresa).
 * origem: features/ctrc/CtrcPdfButton.tsx (sistema atual)
 */
import { type DetalheCtrc } from "@erp/shared/contracts/ctrc";
import {
  formatarData,
  formatarDataHora,
  formatarInteiro,
  formatarMoeda,
  formatarPeso,
} from "@erp/shared/formatting";

import { type ColunaExportacao } from "@/lib/export";

import { formatarChave, formatarCnpjOuTraco, textoDaPerformance, textoDoAtraso } from "./texts";

export const COLUNAS_DO_PDF: readonly ColunaExportacao[] = [
  { chave: "secao", titulo: "Seção", largura: 30 },
  { chave: "campo", titulo: "Campo", largura: 35 },
  { chave: "valor", titulo: "Valor", largura: 90 },
];

interface LinhaDoPdf {
  secao: string;
  campo: string;
  valor: string;
}

export function linhasDoPdf(c: DetalheCtrc, fuso: string): LinhaDoPdf[] {
  const blocos: [string, [string, string][]][] = [
    [
      "Identificação",
      [
        ["Número NF", c.numeroNf === null ? "—" : String(c.numeroNf)],
        ["Número CTRC", `${c.sigla} ${c.numero}`],
        ["Emissão", formatarData(c.dataEmissao)],
        ["Embarque", formatarData(c.dataEmbarque)],
        ["Status atual", c.statusAtual ?? "—"],
        ["Chave CT-e", c.chave ? formatarChave(c.chave) : "—"],
        ["Chave NF-e", c.chaveNfe ? formatarChave(c.chaveNfe) : "—"],
      ],
    ],
    [
      "Prazos & Entrega",
      [
        [
          "Prazo contratado",
          c.prazoContratadoDias === null ? "—" : `${c.prazoContratadoDias} dias`,
        ],
        ["Previsão de entrega", formatarData(c.dataPrevista)],
        ["Origem do prazo", c.prazoOrigem ?? "—"],
        ["Fonte do prazo", c.prazoFonte ?? "—"],
        ["Entrega realizada", formatarDataHora(c.dataEntrega, fuso)],
      ],
    ],
    [
      "Parceiro",
      [
        ["Nome", c.parceiroNome ?? c.parceiro?.nome ?? "—"],
        ["CNPJ", formatarCnpjOuTraco(c.parceiroCnpj ?? c.parceiro?.cnpj ?? null)],
      ],
    ],
    [
      "Unidade",
      [
        ["Unidade", c.filial ?? "—"],
        ["Unidade atual", c.unidadeAtual ?? "—"],
        ["Localização atual", c.localizacao ?? "—"],
      ],
    ],
    [
      "Remetente / Destinatário",
      [
        ["Remetente", c.remetente ?? "—"],
        ["Destinatário", c.destinatario ?? "—"],
        ["Bairro", c.bairroDestino ?? "—"],
        ["Setor", c.setorDestino ?? c.setor ?? "—"],
      ],
    ],
    [
      "Carga & Frete",
      [
        ["Peso", formatarPeso(c.peso, { tonelada: 3, quilo: 3, fixas: true })],
        ["Volumes", formatarInteiro(c.volumes)],
        ["Valor do frete", formatarMoeda(c.valorFrete)],
      ],
    ],
    [
      "Performance",
      [
        ["Performance", textoDaPerformance(c.performanceDias)],
        ["Atraso", textoDoAtraso(c.atrasoDias)],
        ["Fonte", c.fontePerformance ?? "—"],
      ],
    ],
  ];
  return blocos.flatMap(([secao, pares]) =>
    pares.map(([campo, valor]) => ({ secao, campo, valor })),
  );
}
