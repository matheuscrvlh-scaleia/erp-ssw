import { contratosPainelPlataforma as c } from "@erp/shared/contratos/painel-plataforma";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

export const chaves = {
  tudo: ["plataforma", "painel"] as const,
};

/** A API guarda o painel por 60 s: buscar de novo antes disso devolve o mesmo. */
export const consultaPainelDaPlataforma = queryOptions({
  queryKey: chaves.tudo,
  queryFn: () => chamar(c.obter),
  staleTime: 60_000,
  refetchInterval: 5 * 60_000,
});
