import { type Transacao } from "@erp/db";
import { configuracoes, empresaIntegracoes, empresas } from "@erp/db/schema";
import { type EmpresaParaIngestao } from "@erp/ingestao/casos-de-uso";
import { and, eq, isNull, sql } from "drizzle-orm";

/** Leituras da Plataforma usadas pelas rotas públicas da ingestão. */
export function criarRepositorioDaIngestaoPublica(tx: Transacao) {
  return {
    empresasParaIngestao: (): Promise<EmpresaParaIngestao[]> =>
      tx
        .select({
          id: empresas.id,
          slug: empresas.slug,
          nome: empresas.nome,
          status: empresas.status,
          integracoesAtivas: sql<
            string[]
          >`coalesce(array_agg(${empresaIntegracoes.tipo}) filter (where ${empresaIntegracoes.tipo} is not null), '{}')`,
        })
        .from(empresas)
        .leftJoin(
          empresaIntegracoes,
          and(eq(empresaIntegracoes.empresaId, empresas.id), eq(empresaIntegracoes.ativo, true)),
        )
        .groupBy(empresas.id),
    async tokenDoCron(): Promise<string | null> {
      const [c] = await tx
        .select({ valor: configuracoes.valor })
        .from(configuracoes)
        .where(
          and(isNull(configuracoes.empresaId), eq(configuracoes.chave, "backfill_cron_token")),
        );
      return c?.valor.trim() || null;
    },
  };
}
