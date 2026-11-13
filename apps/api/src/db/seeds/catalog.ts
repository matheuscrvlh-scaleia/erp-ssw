import { MODULOS } from "@erp/shared/access/modules";
import { ROTULO_DA_TELA, TELAS } from "@erp/shared/access/screens";

import { type Banco } from "../client";
import { sql } from "../sql";

/**
 * Catálogo de telas e módulos a partir de `@erp/shared` (a fonte da verdade). Idempotente: pode
 * rodar a cada deploy; atualiza nomes e a ligação módulo × tela sem apagar liberações.
 * Roda com o papel de migração (catálogo não é dado de empresa).
 */
export async function semearCatalogo(banco: Banco): Promise<void> {
  await banco.transacao(async (tx) => {
    await tx.executar(sql`
      insert into erp.telas (chave, rotulo)
      select * from unnest(${[...TELAS]}::text[], ${TELAS.map((t) => ROTULO_DA_TELA[t])}::text[])
      on conflict (chave) do update set rotulo = excluded.rotulo`);

    await tx.executar(sql`
      insert into erp.modulos (chave, nome, descricao, essencial, ordem)
      select * from unnest(
        ${MODULOS.map((m) => m.chave)}::text[], ${MODULOS.map((m) => m.nome)}::text[],
        ${MODULOS.map((m) => m.descricao)}::text[], ${MODULOS.map((m) => m.essencial)}::boolean[],
        ${MODULOS.map((m) => m.ordem)}::int[])
      on conflict (chave) do update set nome = excluded.nome, descricao = excluded.descricao,
        essencial = excluded.essencial, ordem = excluded.ordem`);

    for (const m of MODULOS) {
      await tx.executar(sql`
        delete from erp.modulo_telas
        where modulo_chave = ${m.chave} and tela_chave <> all(${[...m.telas]}::text[])`);
      await tx.executar(sql`
        insert into erp.modulo_telas (modulo_chave, tela_chave)
        select ${m.chave}, unnest(${[...m.telas]}::text[])
        on conflict do nothing`);
    }
  });
}
