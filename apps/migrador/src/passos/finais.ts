import { type PassoFinal } from "../motor/executar";
import { passoDasProjecoes, type ProjecoesNoDestino } from "./projecoes";
import { conferirColunasCalculadas } from "./recalculo";

/** Passos depois de todas as tabelas: projeções do Romaneio e conferência dos derivados. */
export function passosFinais(projecoesNoDestino: ProjecoesNoDestino): readonly PassoFinal[] {
  return [passoDasProjecoes(projecoesNoDestino), conferirColunasCalculadas];
}
