import {
  type LinhaDeColeta,
  type ResultadoDaImportacao050,
  type StatusDaLista,
  type StatusDePrazo,
} from "@erp/shared/contracts/pickups";
import { formatarInteiro } from "@erp/shared/formatting";

import { type Tom } from "@/components/common/StatusBadge";

export const ROTULO_DO_STATUS: Record<StatusDaLista, string> = {
  todas: "Todas",
  coletadas: "Coletadas",
  no_prazo: "Coletadas no prazo",
  atrasadas: "Coletadas atrasadas",
  abertas: "Em aberto",
  cadastradas: "Cadastradas",
  comandadas: "Comandadas",
  vencidas: "Vencidas",
  vence_hoje: "Vencem hoje",
  a_vencer: "A vencer",
  canceladas: "Canceladas",
  com_ctrc: "Com CT-e gerado",
  prejudicadas: "Prejudicadas pelo horário",
};

export const ROTULO_DO_PRAZO: Record<StatusDePrazo, { texto: string; tom: Tom }> = {
  no_prazo: { texto: "No prazo", tom: "sucesso" },
  atrasada: { texto: "Atrasada", tom: "erro" },
  cancelada: { texto: "Cancelada", tom: "neutro" },
  vencida: { texto: "Vencida", tom: "erro" },
  vence_hoje: { texto: "Vence hoje", tom: "alerta" },
  a_vencer: { texto: "A vencer", tom: "neutro" },
};

export const ROTULO_DA_ETAPA: Record<LinhaDeColeta["etapa"], string> = {
  cadastrada: "Cadastrada",
  comandada: "Comandada",
  coletada: "Coletada",
  cancelada: "Cancelada",
};

export const SEM_SOLICITANTE = "(sem solicitante)";

/** Confere o que foi lido com o quadro RESUMO do próprio 050. */
export function conferenciaDoResumo(r: ResultadoDaImportacao050): {
  ok: boolean;
  texto: string;
} {
  if (r.resumoSsw === null) return { ok: true, texto: "sem quadro de resumo" };
  if (r.resumoSsw.quantidade === r.lidas) {
    return { ok: true, texto: `ok — ${formatarInteiro(r.resumoSsw.quantidade)} coletas no resumo` };
  }
  return {
    ok: false,
    texto: `resumo do SSW diz ${formatarInteiro(r.resumoSsw.quantidade)}, lidas ${formatarInteiro(r.lidas)}`,
  };
}
