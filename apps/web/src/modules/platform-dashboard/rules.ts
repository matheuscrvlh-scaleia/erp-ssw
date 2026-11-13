import { variacaoDoMes } from "@erp/domain/platform-dashboard";
import {
  type EmpresaNoPainel,
  type PainelPlataforma,
} from "@erp/shared/contracts/platform-dashboard";

import { rotuloDoMes } from "./texts";

/** Empresas em operação (as inativas não contam para integração). */
export const emOperacao = (e: EmpresaNoPainel) =>
  e.status === "ativa" || e.status === "implantacao";

/** CT-e da empresa no mês corrente (o último dos 12). */
export const ctesNoMes = (e: EmpresaNoPainel) => e.ctesPorMes?.at(-1) ?? null;

/** Crescimento do último mês fechado; nulo sem a contagem. */
export const variacao = (e: EmpresaNoPainel) => (e.ctesPorMes ? variacaoDoMes(e.ctesPorMes) : null);

/** Barras do crescimento: empresas que já estavam e as que entraram em cada mês. */
export function serieDoCrescimento(painel: PainelPlataforma | undefined) {
  return (painel?.crescimento ?? []).map((m) => ({
    rotulo: rotuloDoMes(m.mes),
    existentes: m.total - m.novas,
    novas: m.novas,
  }));
}

/** Barras dos CT-e por mês, todas as empresas. */
export function serieDosCtes(painel: PainelPlataforma | undefined) {
  return (painel?.meses ?? []).map((mes, i) => ({
    rotulo: rotuloDoMes(mes),
    ctes: painel?.totais.ctesPorMes[i] ?? 0,
  }));
}
