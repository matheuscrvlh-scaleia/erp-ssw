import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";

import { mensagemAmigavel } from "@/lib/error-message";

interface Gravacao<E, S> {
  /** A mutação do `api.ts` do módulo (`mutacao<Acao>(cliente)`), que já invalida o cache. */
  mutacao: UseMutationOptions<S, Error, E>;
  sucesso: string | ((entrada: E, saida: S) => string);
  /** Depois do sucesso, com a resposta (ex.: abrir o que acabou de ser criado). */
  aoConcluir?: (saida: S) => void;
}

/**
 * Escrita com aviso: toast de sucesso ou do erro da API (já em português). `gravar` devolve
 * `false` em caso de erro, para o modal ficar aberto.
 */
export function useGravacao<E, S>(opcoes: Gravacao<E, S>) {
  const mutacao = useMutation<S, Error, E>(opcoes.mutacao);
  const gravar = async (entrada: E): Promise<boolean> => {
    try {
      const saida = await mutacao.mutateAsync(entrada);
      toast.success(
        typeof opcoes.sucesso === "string" ? opcoes.sucesso : opcoes.sucesso(entrada, saida),
      );
      opcoes.aoConcluir?.(saida);
      return true;
    } catch (e) {
      toast.error(mensagemAmigavel(e));
      return false;
    }
  };
  return { gravar, gravando: mutacao.isPending };
}
