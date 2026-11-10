import { type PassoFinal } from "../motor/executar";
import { conferirColunasCalculadas } from "./recalculo";

/**
 * As projeções do Romaneio são do worker-ssw (ADR 0012): o migrador não as grava, só deixa no
 * relatório o que fazer na virada.
 */
const projecoesNoWorkerSsw: PassoFinal = {
  nome: "reconstruir-projecoes",
  executar: () =>
    Promise.resolve([
      "PENDENTE na virada: rodar o `reconstruir-projecoes` do worker-ssw, por empresa, depois da " +
        "migração e antes de ligar a ingestão (docs/migracao-de-dados.md).",
    ]),
};

/** Passos depois de todas as tabelas: conferência dos derivados e o aviso das projeções. */
export function passosFinais(): readonly PassoFinal[] {
  return [conferirColunasCalculadas, projecoesNoWorkerSsw];
}
