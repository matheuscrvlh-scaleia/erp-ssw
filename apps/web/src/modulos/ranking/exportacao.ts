import { type LinhaDoRanking } from "@erp/shared/contratos/ranking";

import { type ColunaExportacao } from "@/lib/exportacao";

/** Colunas do Excel/PDF do ranking; o Frete só sai quando está visível na tela. */
export function colunasDoRanking(rotuloDoGrupo: string, freteVisivel: boolean): ColunaExportacao[] {
  return [
    { chave: "nome", titulo: rotuloDoGrupo },
    { chave: "totalCtes", titulo: "CT-e", formato: "inteiro" },
    { chave: "entregue", titulo: "Entregue", formato: "inteiro" },
    { chave: "noPrazo", titulo: "No Prazo", formato: "inteiro" },
    { chave: "foraPrazo", titulo: "Fora Prazo", formato: "inteiro" },
    { chave: "foraCliente", titulo: "Cliente", formato: "inteiro" },
    { chave: "foraTransp", titulo: "Transp.", formato: "inteiro" },
    { chave: "slaPct", titulo: "SLA", formato: "percentual" },
    { chave: "aEntregar", titulo: "A Entregar", formato: "inteiro" },
    { chave: "atrasadas", titulo: "Atrasadas", formato: "inteiro" },
    { chave: "noPrazoAberto", titulo: "No Prazo (aberto)", formato: "inteiro" },
    { chave: "peso", titulo: "Peso (kg)", formato: "inteiro" },
    { chave: "volumes", titulo: "Volumes", formato: "inteiro" },
    ...(freteVisivel ? [{ chave: "frete", titulo: "Frete (R$)", formato: "moeda" as const }] : []),
  ];
}

/** Linhas na ordem da tela, com o nome que a tela mostra. */
export function linhasDoRanking(
  linhas: readonly LinhaDoRanking[],
  nomeDe: (r: LinhaDoRanking) => string,
) {
  return linhas.map((r) => ({ ...r, nome: nomeDe(r) }));
}
