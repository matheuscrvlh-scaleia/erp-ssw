import { type Pontualidade, type UnidadePontualidade } from "@erp/shared/contratos/performance";

import { arredondarRazao } from "./numeros";
import { compararTexto } from "./primitivas";

/**
 * Contagens de pontualidade de uma filial efetiva (no prazo/fora conforme o BI2 ou os arquivos;
 * responsabilidade do cliente nula conta como da transportadora).
 */
export interface ContagemPontualidade {
  sigla: string;
  total: number;
  noPrazo: number;
  foraPrazo: number;
  semInfoBi2: number;
  excluidoCliente: number;
  noPrazoCliente: number;
  foraPrazoCliente: number;
  nascidosAvaliados: number;
  nascidosAtraso: number;
}

const pct = (num: number, den: number) => (den > 0 ? arredondarRazao(num, den, 4) : null);

/**
 * SLA Operacional = (emitidos − fora do prazo) ÷ emitidos (fora do prazo já exclui o cliente);
 * SLA Cliente = no prazo ÷ avaliados do cliente; nascidos em atraso = previsão antes do prazo
 * mínimo ÷ avaliados. Tudo com ROUND 4.
 * origem: calcular_performance_pontualidade (sistema atual)
 */
function percentuais(c: Omit<ContagemPontualidade, "sigla">) {
  return {
    performancePct: pct(c.total - c.foraPrazo, c.total),
    slaClientePct: pct(c.noPrazoCliente, c.noPrazoCliente + c.foraPrazoCliente),
    nascidosPct: pct(c.nascidosAtraso, c.nascidosAvaliados),
  };
}

export function montarPontualidade(linhas: readonly ContagemPontualidade[]): Pontualidade {
  const porUnidade: UnidadePontualidade[] = linhas
    .map((l) => ({ ...l, ...percentuais(l) }))
    .sort((a, b) => b.total - a.total || compararTexto(a.sigla, b.sigla));
  const soma = (campo: keyof Omit<ContagemPontualidade, "sigla">) =>
    linhas.reduce((s, l) => s + l[campo], 0);
  const totais = {
    total: soma("total"),
    noPrazo: soma("noPrazo"),
    foraPrazo: soma("foraPrazo"),
    semInfoBi2: soma("semInfoBi2"),
    excluidoCliente: soma("excluidoCliente"),
    noPrazoCliente: soma("noPrazoCliente"),
    foraPrazoCliente: soma("foraPrazoCliente"),
    nascidosAvaliados: soma("nascidosAvaliados"),
    nascidosAtraso: soma("nascidosAtraso"),
  };
  return {
    totais: {
      ...totais,
      ...percentuais(totais),
      totalCliente: totais.noPrazoCliente + totais.foraPrazoCliente,
      pendente: 0,
      semPrazo: totais.semInfoBi2,
    },
    porUnidade,
  };
}
