import { fileURLToPath } from "node:url";

const src = (caminho: string) => fileURLToPath(new URL(`./src/${caminho}`, import.meta.url));

/**
 * Os mesmos caminhos do tsconfig.json, para o Vite e o vitest. Tipo próprio, sem o `Alias` do
 * Vite: o vitest traz outra versão do Vite, e os dois tipos não casam.
 */
export const aliases: { find: RegExp; replacement: string }[] = [
  { find: /^@\//, replacement: src("") },
  { find: /^@erp\/domain\/core$/, replacement: src("domain/core/index.ts") },
  {
    find: /^@erp\/domain\/ingestion\/reports$/,
    replacement: src("domain/ingestion/reports/index.ts"),
  },
  { find: /^@erp\/domain\/(.*)$/, replacement: src("domain/$1") },
  { find: /^@erp\/shared\/(.*)$/, replacement: src("shared/$1") },
];
