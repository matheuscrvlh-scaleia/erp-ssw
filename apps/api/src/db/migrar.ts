/**
 * Aplica as migrations de `migracoes/` (SQL escrito à mão, `NNNN_nome.sql`) em ordem de nome,
 * cada uma na sua transação, e anota em `migracoes.aplicadas` as que já rodaram.
 *
 * Uso: DATABASE_URL_MIGRACAO=... bun run db:migrar (em apps/api), com o papel `erp_migracao`
 * (dono das tabelas), nunca com o papel do app.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { Client } from "pg";

const PASTA = join(import.meta.dirname, "..", "..", "migracoes");

const url = process.env["DATABASE_URL_MIGRACAO"];
if (!url) throw new Error("Defina DATABASE_URL_MIGRACAO para migrar o banco.");

const cliente = new Client({ connectionString: url, application_name: "erp-migrar" });
await cliente.connect();
try {
  // Duas execuções ao mesmo tempo não aplicam a mesma migration duas vezes.
  await cliente.query("select pg_advisory_lock(hashtext('erp-migracoes'))");
  await cliente.query(`create schema if not exists migracoes;
    create table if not exists migracoes.aplicadas (
      nome text primary key,
      aplicada_em timestamptz not null default now()
    )`);
  const arquivos = (await readdir(PASTA)).filter((a) => a.endsWith(".sql")).sort();
  await adotarControleDoDrizzle(arquivos);
  const { rows } = await cliente.query<{ nome: string }>("select nome from migracoes.aplicadas");
  const aplicadas = new Set(rows.map((r) => r.nome));
  for (const arquivo of arquivos.filter((a) => !aplicadas.has(a))) {
    const texto = await readFile(join(PASTA, arquivo), "utf8");
    await cliente.query("begin");
    try {
      await cliente.query(texto);
      await cliente.query("insert into migracoes.aplicadas (nome) values ($1)", [arquivo]);
      await cliente.query("commit");
    } catch (erro) {
      await cliente.query("rollback");
      throw new Error(`Migration ${arquivo} falhou.`, { cause: erro });
    }
    process.stdout.write(`aplicada: ${arquivo}\n`);
  }
} finally {
  await cliente.end();
}

/**
 * Transição: o banco migrado pelo drizzle-kit anotava as migrations em
 * `drizzle.migracoes_erp`, uma linha por arquivo, na ordem. Na primeira execução, as N primeiras
 * de `migracoes/` contam como aplicadas.
 */
async function adotarControleDoDrizzle(arquivos: string[]): Promise<void> {
  const { rows } = await cliente.query<{ ja: boolean; drizzle: string | null }>(
    `select exists (select 1 from migracoes.aplicadas) as ja,
            to_regclass('drizzle.migracoes_erp')::text as drizzle`,
  );
  if (rows[0]?.ja || !rows[0]?.drizzle) return;
  const { rows: contagem } = await cliente.query<{ n: number }>(
    "select count(*)::int as n from drizzle.migracoes_erp",
  );
  const feitas = arquivos.slice(0, contagem[0]?.n ?? 0);
  await cliente.query(
    "insert into migracoes.aplicadas (nome) select unnest($1::text[]) on conflict do nothing",
    [feitas],
  );
  process.stdout.write(`adotadas do drizzle-kit: ${feitas.length}\n`);
}
