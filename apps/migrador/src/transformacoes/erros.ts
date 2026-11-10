/**
 * Valor da origem que não cabe no destino (precisão, faixa, lista fechada). O migrador nunca
 * arredonda nem troca o valor em silêncio: a linha vai para o relatório e a tabela para.
 */
export class ErroDeConversao extends Error {
  constructor(
    readonly coluna: string,
    readonly valor: string,
    motivo: string,
  ) {
    super(`${coluna}: ${motivo}`);
    this.name = "ErroDeConversao";
  }
}
