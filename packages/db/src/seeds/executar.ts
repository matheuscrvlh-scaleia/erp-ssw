import { conectarBanco } from "../cliente";
import { semearCatalogo } from "./catalogo";

// Uso: DATABASE_URL_MIGRACAO=... bun run --cwd packages/db semear (depois de db:migrar).
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
