import { randomBytes } from "node:crypto";

import { type ChavesDeSegredo, lerChavesDeSegredo } from "@erp/db/segredos";

import { type AmbienteDoMigrador } from "./ambiente";
import { ErroDeUso } from "./argumentos";

/**
 * Chaves para cifrar os segredos de integração. Na simulação nada é gravado: sem chave
 * configurada, usa uma descartável só para exercitar a transformação.
 */
export function chavesParaExecucao(
  ambiente: Pick<AmbienteDoMigrador, "SEGREDOS_CHAVES" | "SEGREDOS_CHAVE_ATUAL">,
  simulacao: boolean,
): ChavesDeSegredo {
  if (ambiente.SEGREDOS_CHAVES !== undefined && ambiente.SEGREDOS_CHAVE_ATUAL !== undefined) {
    return lerChavesDeSegredo(ambiente.SEGREDOS_CHAVES, ambiente.SEGREDOS_CHAVE_ATUAL);
  }
  if (!simulacao) {
    throw new ErroDeUso(
      "SEGREDOS_CHAVES e SEGREDOS_CHAVE_ATUAL são obrigatórios (as mesmas da API): os " +
        "segredos de integração são gravados cifrados.",
    );
  }
  return lerChavesDeSegredo(`1:${randomBytes(32).toString("base64")}`, 1);
}
