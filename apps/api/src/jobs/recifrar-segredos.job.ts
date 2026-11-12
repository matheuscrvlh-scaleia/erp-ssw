import { type ChavesDeSegredo } from "@erp/db/segredos";
import { z } from "@erp/shared/zod";

import { recifrarSegredos } from "../models/segredos/segredos.service";
import { definirJob } from "./registro";

export const NOME_DO_JOB_RECIFRAR = "recifrar-segredos";

/** Sob demanda (docs/deploy.md §5), escopo Plataforma: só a Plataforma escreve nessas tabelas. */
export function criarJobRecifrarSegredos(chaves: ChavesDeSegredo | null) {
  return definirJob({
    nome: NOME_DO_JOB_RECIFRAR,
    fila: "manutencao",
    escopo: "plataforma",
    dados: z.object({}),
    agendamento: null,
    async processar({ executar, log }) {
      if (chaves === null) throw new Error("SEGREDOS_CHAVES não configurado: nada a recifrar.");
      const resultado = await executar(({ segredos }) => recifrarSegredos(segredos, chaves));
      log.info(
        { recifrados: resultado.recifrados, falhas: resultado.falhas, versao: chaves.atual },
        "segredos recifrados com a chave atual",
      );
      return resultado;
    },
  });
}
