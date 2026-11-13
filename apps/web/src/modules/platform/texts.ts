import { type ValorDeParametro } from "@erp/shared/contracts/platform";
import { type SituacaoDaIntegracao, type StatusEmpresa } from "@erp/shared/platform";

import { type Tom } from "@/components/common/StatusBadge";

export const TOM_DO_STATUS: Record<StatusEmpresa, Tom> = {
  implantacao: "alerta",
  ativa: "sucesso",
  suspensa: "erro",
  encerrada: "neutro",
};

export const TOM_DA_SITUACAO_DA_INTEGRACAO: Record<SituacaoDaIntegracao, Tom> = {
  desligada: "neutro",
  ativa: "sucesso",
  com_falha: "erro",
  sem_sinal: "alerta",
};

/** Valor de um parâmetro de integração como texto do campo (lista separada por vírgula). */
export const paraTexto = (v: ValorDeParametro | undefined) =>
  v === null || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : String(v);
