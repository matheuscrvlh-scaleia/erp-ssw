import { contratosAuth } from "@erp/shared/contracts/auth";
import { type QueryClient, queryOptions } from "@tanstack/react-query";

import { chamar, definirTokenAcesso } from "@/lib/api";

/** Quem é o usuário, empresa ativa, telas e módulos: base do menu e da guarda de rota. */
export const consultaAcesso = queryOptions({
  queryKey: ["acesso"],
  queryFn: () => chamar(contratosAuth.eu),
});

export async function entrar(email: string, senha: string): Promise<void> {
  const { tokenAcesso } = await chamar(contratosAuth.login, { entrada: { email, senha } });
  definirTokenAcesso(tokenAcesso);
}

/** Sai mesmo se a API falhar: o token some da memória de qualquer jeito. */
export async function sair(): Promise<void> {
  try {
    await chamar(contratosAuth.sair);
  } finally {
    definirTokenAcesso(null);
  }
}

/**
 * Troca a empresa ativa da sessão. Depois da troca o cache inteiro é jogado fora (senão a tela
 * mostraria dados da empresa anterior por até 15 min) e a página recarrega no mesmo endereço, sem
 * sobrar estado de tela da empresa anterior (docs/regras/05 §1.4).
 */
export async function trocarEmpresa(empresaId: string, queryClient: QueryClient): Promise<void> {
  const { tokenAcesso } = await chamar(contratosAuth.trocarEmpresa, { entrada: { empresaId } });
  definirTokenAcesso(tokenAcesso);
  queryClient.clear();
  window.location.reload();
}
