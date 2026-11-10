import { contratosIngestaoSsw as c } from "@erp/shared/contratos/ingestao-ssw";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

const MINUTO = 60_000;

/** Faixa "Integração SSW indisponível" (layout). */
export const consultaSaudeSsw = (empresaId: string) =>
  queryOptions({
    queryKey: ["ssw", "saude", empresaId],
    queryFn: () => chamar(c.saude),
    staleTime: MINUTO,
    refetchInterval: MINUTO,
  });

/**
 * Horário do `SeloAtualizacao` ("Dados atualizados em…") e XML aguardando (só a Plataforma).
 * Uso: `const { data } = useQuery(consultaAtualizacaoDosDados(empresaId));`
 */
export const consultaAtualizacaoDosDados = (empresaId: string) =>
  queryOptions({
    queryKey: ["ssw", "atualizacao", empresaId],
    queryFn: () => chamar(c.atualizacao),
    staleTime: MINUTO,
    refetchInterval: MINUTO,
  });

export const consultaBi2 = queryOptions({
  queryKey: ["ssw", "bi2-0017"],
  queryFn: () => chamar(c.bi2Status),
  refetchInterval: 30_000,
});

export const consultaCredenciais = queryOptions({
  queryKey: ["ssw", "credenciais"],
  queryFn: () => chamar(c.credenciais),
});

export const consultaEventosWebhook = queryOptions({
  queryKey: ["ssw", "webhook-eventos"],
  queryFn: () => chamar(c.eventosWebhook),
  refetchInterval: 15_000,
});

export const consultaDiagnostico = queryOptions({
  queryKey: ["ssw", "diagnostico"],
  queryFn: () => chamar(c.diagnostico),
  refetchInterval: 30_000,
});

/** Toda escrita destas telas invalida o grupo inteiro (saúde, credenciais, eventos). */
export const CHAVE_DA_INGESTAO = ["ssw"] as const;
