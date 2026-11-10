import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * Abre o detalhe do CT-e (`/ctrc/<número>`, o caminho de hoje). A tela de detalhe é de outra
 * parte da migração; por isso a navegação vai por `href` e não pela rota tipada.
 */
export function useAbrirCte() {
  const navigate = useNavigate();
  return useCallback(
    (numero: string) => void navigate({ href: `/ctrc/${encodeURIComponent(numero)}` }),
    [navigate],
  );
}
