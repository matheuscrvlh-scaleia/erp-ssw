import { defineConfig } from "drizzle-kit";

// `db:gerar` só lê o schema (não conecta). `db:migrar` usa DATABASE_URL_MIGRACAO, com o papel
// erp_migracao (dono das tabelas), nunca com o papel do app.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  schemaFilter: ["erp"],
  dbCredentials: { url: process.env["DATABASE_URL_MIGRACAO"] ?? "" },
  migrations: { schema: "drizzle", table: "migracoes_erp" },
  strict: true,
  verbose: true,
});
