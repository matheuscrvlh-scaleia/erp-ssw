import { contratosAuth } from "@erp/shared/contratos/auth";
import { queryOptions } from "@tanstack/react-query";

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

export async function trocarEmpresa(empresaId: string): Promise<void> {
  const { tokenAcesso } = await chamar(contratosAuth.trocarEmpresa, { entrada: { empresaId } });
  definirTokenAcesso(tokenAcesso);
}
