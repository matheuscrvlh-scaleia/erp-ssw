import { type EntradaDe } from "@erp/shared/contrato";
import {
  contratosPrazoParceiro as c,
  type FiltrosPrazo,
} from "@erp/shared/contratos/prazo-parceiro";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

export const CHAVE_DO_PRAZO = ["prazo-parceiro"] as const;

export const consultaVisaoGeral = (filtros: FiltrosPrazo) =>
  queryOptions({
    queryKey: [...CHAVE_DO_PRAZO, "visao-geral", filtros],
    queryFn: () => chamar(c.visaoGeral, { entrada: filtros }),
  });

export const consultaOpcoes = (periodo: EntradaDe<typeof c.opcoes>) =>
  queryOptions({
    queryKey: [...CHAVE_DO_PRAZO, "opcoes", periodo],
    queryFn: () => chamar(c.opcoes, { entrada: periodo }),
  });

export const consultaLista = (entrada: EntradaDe<typeof c.lista>) =>
  queryOptions({
    queryKey: [...CHAVE_DO_PRAZO, "lista", entrada],
    queryFn: () => chamar(c.lista, { entrada }),
  });

export const exportarLista = (entrada: EntradaDe<typeof c.exportar>) =>
  chamar(c.exportar, { entrada });

export const consultaDetalhe = (id: string, filtros: FiltrosPrazo) =>
  queryOptions({
    queryKey: [...CHAVE_DO_PRAZO, "detalhe", id, filtros],
    queryFn: () => chamar(c.detalhe, { parametros: { id }, entrada: filtros }),
  });
