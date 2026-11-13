import { type ColunaExportacao, type LinhaExportacao } from "@/lib/export";

/**
 * Exportação de tabela com coluna "Placa"/"Placas" sai ordenada por placa (A→Z, pt-BR), linhas
 * sem placa por último, mantendo a ordem original entre placas iguais.
 * origem: ordenarPorPlaca em ExportTabela.tsx (sistema atual)
 */
export function ordenarPorPlaca<T extends LinhaExportacao>(
  linhas: readonly T[],
  colunas: readonly ColunaExportacao[],
): readonly T[] {
  const coluna = colunas.find((c) => /^placas?$/i.test(c.titulo.trim()));
  if (!coluna) return linhas;
  const placaDe = (linha: T): string => {
    const valor: unknown = Reflect.get(linha, coluna.chave);
    return typeof valor === "string" ? valor.trim() : "";
  };
  return linhas
    .map((linha, indice) => ({ linha, indice, placa: placaDe(linha) }))
    .sort((a, b) => {
      if ((a.placa === "") !== (b.placa === "")) return a.placa === "" ? 1 : -1;
      return a.placa.localeCompare(b.placa, "pt-BR") || a.indice - b.indice;
    })
    .map((x) => x.linha);
}
