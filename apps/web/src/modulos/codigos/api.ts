import { contratosCodigosOcorrencia as c } from "@erp/shared/contratos/codigos-ocorrencia";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

export const CHAVE_DOS_CODIGOS = ["admin", "codigos"] as const;

export const consultaCodigos = queryOptions({
  queryKey: CHAVE_DOS_CODIGOS,
  queryFn: () => chamar(c.listar),
});

export const consultaHistoricoDoCodigo = (codigo: number) =>
  queryOptions({
    queryKey: [...CHAVE_DOS_CODIGOS, "historico", codigo],
    queryFn: () => chamar(c.historico, { parametros: { codigo: String(codigo) } }),
  });
