import { type Acao, permissao } from "@erp/shared/acesso/permissoes";
import { type Tela } from "@erp/shared/acesso/telas";
import { type Acesso } from "@erp/shared/contratos/auth";
import { useSuspenseQuery } from "@tanstack/react-query";

import { consultaAcesso } from "./sessao";

export function pode(acesso: Pick<Acesso, "permissoes">, tela: Tela, acao: Acao): boolean {
  return acesso.permissoes.includes(permissao(tela, acao));
}

/**
 * O usuário pode fazer a ação na tela (Ver / Criar-Editar / Excluir)? O front só esconde ou
 * desabilita o que não pode; a API confere de novo em cada chamada.
 */
export function usePermissao(tela: Tela, acao: Acao): boolean {
  const { data } = useSuspenseQuery(consultaAcesso);
  return pode(data, tela, acao);
}
