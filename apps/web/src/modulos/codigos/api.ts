import { type EntradaDe, type SaidaDe } from "@erp/shared/contrato";
import { contratosCodigosOcorrencia as c } from "@erp/shared/contratos/codigos-ocorrencia";
import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

export const chaves = {
  tudo: ["codigos"] as const,
  historico: (codigo: number) => [...chaves.tudo, "historico", codigo] as const,
};

export const consultaCodigos = queryOptions({
  queryKey: chaves.tudo,
  queryFn: () => chamar(c.listar),
});

export const consultaHistoricoDoCodigo = (codigo: number) =>
  queryOptions({
    queryKey: chaves.historico(codigo),
    queryFn: () => chamar(c.historico, { parametros: { codigo: String(codigo) } }),
  });

type CodigoParaSalvar = { codigo: number } & EntradaDe<typeof c.salvar>;

/**
 * `aoResponder` roda quando a api responde, antes de atualizar a lista (o aviso sai na hora e o
 * `mutateAsync` só resolve depois da lista nova).
 */
export const mutacaoSalvarCodigo = (
  cliente: QueryClient,
  aoResponder: (saida: SaidaDe<typeof c.salvar>, entrada: CodigoParaSalvar) => void,
) =>
  mutationOptions({
    mutationFn: ({ codigo, ...entrada }: CodigoParaSalvar) =>
      chamar(c.salvar, { parametros: { codigo: String(codigo) }, entrada }),
    onSuccess: (saida, entrada) => {
      aoResponder(saida, entrada);
      return cliente.invalidateQueries({ queryKey: chaves.tudo });
    },
  });

/** Ação em lote nos códigos selecionados; `aoResponder` como em `mutacaoSalvarCodigo`. */
export const mutacaoAplicarLote = (
  cliente: QueryClient,
  aoResponder: (saida: SaidaDe<typeof c.lote>) => void,
) =>
  mutationOptions({
    mutationFn: (entrada: EntradaDe<typeof c.lote>) => chamar(c.lote, { entrada }),
    onSuccess: (saida) => {
      aoResponder(saida);
      return cliente.invalidateQueries({ queryKey: chaves.tudo });
    },
  });
