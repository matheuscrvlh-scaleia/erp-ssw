import { type Transacao } from "@erp/db";
import {
  codigosOcorrencia,
  ctes,
  filiaisApelidos,
  ocorrencias,
  sswWebhookEventos,
} from "@erp/db/schema";
import { comoCte } from "@erp/ingestao/infra";
import { and, eq, sql } from "drizzle-orm";

import { exigirEmpresa } from "../comum/empresa";
import { type RepositorioWebhook } from "./job";

export function criarRepositorioWebhook(
  tx: Transacao,
  empresaDoContexto: string | null,
): RepositorioWebhook {
  const empresa = () => exigirEmpresa(empresaDoContexto);
  return {
    payloadDoEvento: async (eventoId) => {
      const [linha] = await tx
        .select({ payload: sswWebhookEventos.payloadBruto })
        .from(sswWebhookEventos)
        .where(and(eq(sswWebhookEventos.empresaId, empresa()), eq(sswWebhookEventos.id, eventoId)));
      return linha ? { payload: linha.payload } : null;
    },

    atualizarEvento: async (eventoId, r) => {
      await tx
        .update(sswWebhookEventos)
        .set({
          statusHttp: r.statusHttp,
          motivoRejeicao: r.motivoRejeicao,
          erroProcessamento: r.erroProcessamento,
          cteId: r.cteId,
          ocorrenciaId: r.ocorrenciaId,
        })
        .where(and(eq(sswWebhookEventos.empresaId, empresa()), eq(sswWebhookEventos.id, eventoId)));
    },

    ctePorSiglaENumero: async (sigla, numero) => {
      const [linha] = await tx
        .select()
        .from(ctes)
        .where(and(eq(ctes.empresaId, empresa()), eq(ctes.sigla, sigla), eq(ctes.numero, numero)));
      return linha ? comoCte(linha) : null;
    },

    ctesPorNumero: async (numero) => {
      const linhas = await tx
        .select()
        .from(ctes)
        .where(and(eq(ctes.empresaId, empresa()), eq(ctes.numero, numero)));
      return linhas.map(comoCte);
    },

    filialPorCidade: async (cidade) => {
      const [linha] = await tx
        .select({ filial: filiaisApelidos.filial })
        .from(filiaisApelidos)
        .where(
          and(
            eq(filiaisApelidos.empresaId, empresa()),
            eq(filiaisApelidos.cidadeNormalizada, cidade),
          ),
        );
      return linha?.filial ?? null;
    },

    cadastrarCodigo: async (codigo) => {
      await tx
        .insert(codigosOcorrencia)
        .values({ ...codigo, empresaId: empresa() })
        .onConflictDoNothing();
    },

    gravarOcorrencia: async (o) => {
      const [linha] = await tx
        .insert(ocorrencias)
        .values({ ...o, empresaId: empresa(), origem: "webhook" })
        .onConflictDoUpdate({
          target: [ocorrencias.cteId, ocorrencias.codigo, ocorrencias.dataHora],
          set: {
            descricao: sql`excluded.descricao`,
            complemento: sql`excluded.complemento`,
            filial: sql`excluded.filial`,
            protocoloSsw: sql`excluded.protocolo_ssw`,
            origem: sql`excluded.origem`,
            responsavel: sql`excluded.responsavel`,
            penaliza: sql`excluded.penaliza`,
            quarentena: sql`excluded.quarentena`,
          },
        })
        .returning({ id: ocorrencias.id });
      if (!linha) throw new Error("Gravação da ocorrência não devolveu a linha.");
      return linha.id;
    },
  };
}
