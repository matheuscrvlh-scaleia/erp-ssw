import { contratosCtrc as c } from "@erp/shared/contratos/ctrc";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

export const chaves = {
  tudo: ["ctrc"] as const,
  detalhe: (numero: string, sigla: string | undefined) =>
    [...chaves.tudo, numero, sigla ?? null] as const,
};

export const consultaCtrc = (numero: string, sigla: string | undefined) =>
  queryOptions({
    queryKey: chaves.detalhe(numero, sigla),
    queryFn: () => chamar(c.detalhe, { parametros: { numero }, entrada: { sigla } }),
  });
