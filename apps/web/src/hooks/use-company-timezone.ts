import { FUSO_DO_NEGOCIO } from "@erp/domain/core/time";
import { useSuspenseQuery } from "@tanstack/react-query";

import { consultaAcesso } from "@/access/session";

/**
 * Fuso da empresa ativa; sem empresa (Plataforma), o de Brasília. Todo "hoje" e toda data e hora
 * das telas saem neste fuso, nunca no do navegador (Q11).
 */
export function useFusoDaEmpresa(): string {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  return acesso.empresa?.fuso ?? FUSO_DO_NEGOCIO;
}
