import {
  type QueryKey,
  useMutation,
  type UseMutationOptions,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

interface Aviso<E, S> {
  sucesso: string | ((entrada: E, saida: S) => string);
  /** Depois do sucesso, com a resposta (ex.: abrir o que acabou de ser criado). */
  aoConcluir?: (saida: S) => void;
}

type Escrita<E, S> =
  /** A mutação do `api.ts` do módulo (`mutacao<Acao>(cliente)`), que já invalida o cache. */
  | { mutacao: UseMutationOptions<S, Error, E> }
  // atalho: forma antiga (executar + invalidar); sai na migração dos módulos admin e plataforma
  | { executar: (entrada: E) => Promise<S>; invalidar: readonly QueryKey[] };

/**
 * Escrita com aviso: toast de sucesso ou do erro da API (já em português). `gravar` devolve
 * `false` em caso de erro, para o modal ficar aberto.
 */
export function useGravacao<E, S>(opcoes: Aviso<E, S> & Escrita<E, S>) {
  const queryClient = useQueryClient();
  const mutacao = useMutation<S, Error, E>(
    "mutacao" in opcoes ? opcoes.mutacao : { mutationFn: opcoes.executar },
  );
  const gravar = async (entrada: E): Promise<boolean> => {
    try {
      const saida = await mutacao.mutateAsync(entrada);
      toast.success(
        typeof opcoes.sucesso === "string" ? opcoes.sucesso : opcoes.sucesso(entrada, saida),
      );
      if ("invalidar" in opcoes) {
        await Promise.all(
          opcoes.invalidar.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        );
      }
      opcoes.aoConcluir?.(saida);
      return true;
    } catch (e) {
      toast.error(mensagemAmigavel(e));
      return false;
    }
  };
  return { gravar, gravando: mutacao.isPending };
}
