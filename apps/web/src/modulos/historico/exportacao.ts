import { ROTULO_DO_TIPO_DE_ANOTACAO } from "@erp/shared/contratos/historico";

import { type ColunaExportacao } from "@/lib/exportacao";

import { type DiaDoHistorico } from "./regras";

/** Colunas do "Exportar": uma linha por anotação ou feriado dos dias filtrados. */
export const COLUNAS_DA_EXPORTACAO: ColunaExportacao[] = [
  { chave: "data", titulo: "Data", formato: "data" },
  { chave: "tipo", titulo: "Tipo" },
  { chave: "texto", titulo: "Texto" },
  { chave: "local", titulo: "Unidade" },
  { chave: "autor", titulo: "Autor" },
  { chave: "origem", titulo: "Origem" },
];

export function linhasDaExportacao(dias: readonly DiaDoHistorico[]) {
  return dias.flatMap((dia) => [
    ...dia.anotacoes.map((a) => ({
      data: dia.dia,
      tipo: ROTULO_DO_TIPO_DE_ANOTACAO[a.tipo],
      texto: a.texto,
      local: a.unidadeNome ?? "",
      autor: a.autorNome ?? "",
      origem: "Anotação",
    })),
    ...dia.feriados.map((f) => ({
      data: dia.dia,
      tipo: f.tipo === "nacional" ? "Feriado nacional" : "Feriado municipal",
      texto: f.descricao,
      local: [f.cidade, f.uf].filter(Boolean).join("/"),
      autor: "",
      origem: "Feriado",
    })),
  ]);
}
