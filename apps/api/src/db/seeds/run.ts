import { conectarBanco } from "../client";
import { semearCatalogo } from "./catalog";

// Uso: DATABASE_URL_MIGRACAO=... bun run db:semear (em apps/api, depois de db:migrar).
const url = process.env["DATABASE_URL_MIGRACAO"];
if (!url) throw new Error("Defina DATABASE_URL_MIGRACAO para semear o catálogo.");

const conexao = conectarBanco({
  url,
  maxConexoes: 1,
  timeoutConsultaMs: 60_000,
  nomeAplicacao: "erp-semear",
});
try {
  await semearCatalogo(conexao.banco);
} finally {
  await conexao.encerrar();
}
