import { contratosCtrc as c } from "@erp/shared/contratos/ctrc";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

export const consultaCtrc = (numero: string, sigla: string | undefined) =>
  queryOptions({
    queryKey: ["ctrc", numero, sigla ?? null],
    queryFn: () => chamar(c.detalhe, { parametros: { numero }, entrada: { sigla } }),
  });
