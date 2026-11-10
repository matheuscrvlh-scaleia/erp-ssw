import { type EntradaDe } from "@erp/shared/contrato";
import { contratosBonificacaoEntrega as c } from "@erp/shared/contratos/bonificacao-entrega";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

export const consultaUnidades = queryOptions({
  queryKey: ["bonificacao-unidades"],
  queryFn: () => chamar(c.unidades),
  staleTime: 30 * 60_000,
});

export const consultaParametros = queryOptions({
  queryKey: ["bonificacao-parametros"],
  queryFn: () => chamar(c.parametros),
  staleTime: 30 * 60_000,
});

export const consultaApuracao = (filtros: EntradaDe<typeof c.apurar> | null) =>
  queryOptions({
    queryKey: ["bonificacao-apuracao", filtros],
    queryFn: () => (filtros ? chamar(c.apurar, { entrada: filtros }) : Promise.resolve([])),
    enabled: filtros !== null,
  });

/** Registrar ou excluir falta muda a apuração: as duas chaves começam com este prefixo. */
export const CHAVE_DAS_FALTAS = ["bonificacao-faltas"] as const;

export const consultaFaltas = (inicio: string, fim: string) =>
  queryOptions({
    queryKey: [...CHAVE_DAS_FALTAS, inicio, fim],
    queryFn: () => chamar(c.faltas, { entrada: { inicio, fim } }),
  });
