import { type EventoWebhook } from "@erp/shared/contracts/ssw-ingestion";

export type SituacaoDoEvento = "processado" | "sem_vinculo" | "rejeitado" | "erro";

/** Mesma classificação dos contadores do diagnóstico (rejeitado = auth/4xx; erro = 5xx). */
export function situacaoDoEvento(e: {
  statusHttp: number;
  autenticado: boolean;
}): SituacaoDoEvento {
  if (!e.autenticado || (e.statusHttp >= 400 && e.statusHttp < 500)) return "rejeitado";
  if (e.statusHttp >= 500) return "erro";
  if (e.statusHttp === 202) return "sem_vinculo";
  return "processado";
}

/** Rejeições de autenticação que um reprocesso resolve (depois de corrigir o segredo). */
const MOTIVOS_RECUPERAVEIS = new Set([
  "token_incorreto",
  "token_header_vazio",
  "autorizacao_ausente",
  "cnpj_nao_autorizado",
]);

export function podeReprocessar(e: EventoWebhook): boolean {
  if (!e.temPayload) return false;
  const situacao = situacaoDoEvento(e);
  if (situacao === "erro" || situacao === "sem_vinculo") return true;
  return situacao === "rejeitado" && MOTIVOS_RECUPERAVEIS.has(e.motivoRejeicao ?? "");
}
