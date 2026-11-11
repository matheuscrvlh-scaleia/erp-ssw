import { type Transacao } from "@erp/db";
import { empresaIntegracoes, plataformaIntegracoes } from "@erp/db/schema";
import { TIPOS_INTEGRACAO_PLATAFORMA } from "@erp/shared/plataforma";
import { and, eq, isNotNull, ne, or } from "drizzle-orm";

import { type RepositorioSegredos } from "./recifrar";

const segredoDe = (cifrado: string | null, versaoChave: number | null) =>
  cifrado === null || versaoChave === null ? null : { cifrado, versaoChave };

/** Precisa de contexto de Plataforma: o RLS só deixa a Plataforma alterar integrações. */
export function criarRepositorioSegredos(tx: Transacao): RepositorioSegredos {
  return {
    foraDaVersao: async (versao) => {
      const t = empresaIntegracoes;
      const linhas = await tx
        .select({
          id: t.id,
          empresaId: t.empresaId,
          tipo: t.tipo,
          cifrado: t.segredoCifrado,
          versaoChave: t.segredoVersaoChave,
          anteriorCifrado: t.segredoAnteriorCifrado,
          anteriorVersaoChave: t.segredoAnteriorVersaoChave,
        })
        .from(t)
        .where(
          or(
            and(isNotNull(t.segredoVersaoChave), ne(t.segredoVersaoChave, versao)),
            and(isNotNull(t.segredoAnteriorVersaoChave), ne(t.segredoAnteriorVersaoChave, versao)),
          ),
        );
      const p = plataformaIntegracoes;
      const daPlataforma = await tx
        .select({ tipo: p.tipo, cifrado: p.segredoCifrado, versaoChave: p.segredoVersaoChave })
        .from(p)
        .where(and(isNotNull(p.segredoVersaoChave), ne(p.segredoVersaoChave, versao)));
      return [
        ...linhas.map((l) => ({
          id: l.id,
          empresaId: l.empresaId,
          tipo: l.tipo,
          segredo: segredoDe(l.cifrado, l.versaoChave),
          segredoAnterior: segredoDe(l.anteriorCifrado, l.anteriorVersaoChave),
        })),
        ...daPlataforma.map((l) => ({
          id: l.tipo,
          empresaId: null,
          tipo: l.tipo,
          segredo: segredoDe(l.cifrado, l.versaoChave),
          segredoAnterior: null,
        })),
      ];
    },

    regravar: async (linha, { segredo, segredoAnterior }) => {
      if (linha.empresaId === null) {
        const p = plataformaIntegracoes;
        const tipo = TIPOS_INTEGRACAO_PLATAFORMA.find((t) => t === linha.tipo);
        if (!tipo) throw new Error(`Tipo de integração da Plataforma desconhecido: ${linha.tipo}`);
        await tx
          .update(p)
          .set({
            segredoCifrado: segredo?.cifrado ?? null,
            segredoVersaoChave: segredo?.versaoChave ?? null,
          })
          .where(eq(p.tipo, tipo));
        return;
      }
      await tx
        .update(empresaIntegracoes)
        .set({
          segredoCifrado: segredo?.cifrado ?? null,
          segredoVersaoChave: segredo?.versaoChave ?? null,
          segredoAnteriorCifrado: segredoAnterior?.cifrado ?? null,
          segredoAnteriorVersaoChave: segredoAnterior?.versaoChave ?? null,
        })
        .where(eq(empresaIntegracoes.id, linha.id));
    },
  };
}
