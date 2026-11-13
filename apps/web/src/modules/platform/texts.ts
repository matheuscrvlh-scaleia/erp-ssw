import { type ValorDeParametro } from "@erp/shared/contracts/platform";
import { type StatusEmpresa } from "@erp/shared/platform";

import { type Tom } from "@/components/common/StatusBadge";

export const TOM_DO_STATUS: Record<StatusEmpresa, Tom> = {
  implantacao: "alerta",
  ativa: "sucesso",
  suspensa: "erro",
  encerrada: "neutro",
};

/** Valor de um parâmetro de integração como texto do campo (lista separada por vírgula). */
export const paraTexto = (v: ValorDeParametro | undefined) =>
  v === null || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : String(v);
