import { type EntradaDe } from "@erp/shared/contrato";
import {
  contratosPrazoParceiro as c,
  type FiltrosPrazo,
} from "@erp/shared/contratos/prazo-parceiro";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

export const chaves = {
  tudo: ["prazo-parceiro"] as const,
  visaoGeral: (filtros: FiltrosPrazo) => [...chaves.tudo, "visao-geral", filtros] as const,
  opcoes: (periodo: EntradaDe<typeof c.opcoes>) => [...chaves.tudo, "opcoes", periodo] as const,
  lista: (entrada: EntradaDe<typeof c.lista>) => [...chaves.tudo, "lista", entrada] as const,
  detalhe: (id: string, filtros: FiltrosPrazo) => [...chaves.tudo, "detalhe", id, filtros] as const,
};

export const consultaVisaoGeral = (filtros: FiltrosPrazo) =>
  queryOptions({
    queryKey: chaves.visaoGeral(filtros),
    queryFn: () => chamar(c.visaoGeral, { entrada: filtros }),
  });

export const consultaOpcoes = (periodo: EntradaDe<typeof c.opcoes>) =>
  queryOptions({
    queryKey: chaves.opcoes(periodo),
    queryFn: () => chamar(c.opcoes, { entrada: periodo }),
  });

export const consultaLista = (entrada: EntradaDe<typeof c.lista>) =>
  queryOptions({
    queryKey: chaves.lista(entrada),
    queryFn: () => chamar(c.lista, { entrada }),
  });

export const exportarLista = (entrada: EntradaDe<typeof c.exportar>) =>
  chamar(c.exportar, { entrada });

export const consultaDetalhe = (id: string, filtros: FiltrosPrazo) =>
  queryOptions({
    queryKey: chaves.detalhe(id, filtros),
    queryFn: () => chamar(c.detalhe, { parametros: { id }, entrada: filtros }),
  });
