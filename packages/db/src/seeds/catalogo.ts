import { MODULOS } from "@erp/shared/acesso/modulos";
import { ROTULO_DA_TELA, TELAS } from "@erp/shared/acesso/telas";
import { and, eq, notInArray, sql } from "drizzle-orm";

import { type Banco } from "../cliente";
import { modulos, moduloTelas, telas } from "../schema";

/**
 * Catálogo de telas e módulos a partir de `@erp/shared` (a fonte da verdade). Idempotente: pode
 * rodar a cada deploy; atualiza nomes e a ligação módulo × tela sem apagar liberações.
 * Roda com o papel de migração (catálogo não é dado de empresa).
 */
export async function semearCatalogo(banco: Banco): Promise<void> {
  await banco.transaction(async (tx) => {
    await tx
      .insert(telas)
      .values(TELAS.map((chave) => ({ chave, rotulo: ROTULO_DA_TELA[chave] })))
      .onConflictDoUpdate({ target: telas.chave, set: { rotulo: sql`excluded.rotulo` } });

    await tx
      .insert(modulos)
      .values(
        MODULOS.map((m) => ({
          chave: m.chave,
          nome: m.nome,
          descricao: m.descricao,
          essencial: m.essencial,
          ordem: m.ordem,
        })),
      )
      .onConflictDoUpdate({
        target: modulos.chave,
        set: {
          nome: sql`excluded.nome`,
          descricao: sql`excluded.descricao`,
          essencial: sql`excluded.essencial`,
          ordem: sql`excluded.ordem`,
        },
      });

    for (const m of MODULOS) {
      await tx
        .delete(moduloTelas)
        .where(
          and(
            eq(moduloTelas.moduloChave, m.chave),
            notInArray(moduloTelas.telaChave, [...m.telas]),
          ),
        );
      await tx
        .insert(moduloTelas)
        .values(m.telas.map((telaChave) => ({ moduloChave: m.chave, telaChave })))
        .onConflictDoNothing();
    }
  });
}
