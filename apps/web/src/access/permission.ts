import { type Acao, permissao } from "@erp/shared/access/permissions";
import { type Tela } from "@erp/shared/access/screens";
import { type Acesso } from "@erp/shared/contracts/auth";
import { useSuspenseQuery } from "@tanstack/react-query";

import { consultaAcesso } from "./session";

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
