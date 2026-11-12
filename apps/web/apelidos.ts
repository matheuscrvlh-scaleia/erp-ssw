import { fileURLToPath } from "node:url";

const src = (caminho: string) => fileURLToPath(new URL(`./src/${caminho}`, import.meta.url));

/**
 * Os mesmos caminhos do tsconfig.json, para o Vite e o vitest. Tipo próprio, sem o `Alias` do
 * Vite: o vitest traz outra versão do Vite, e os dois tipos não casam.
 */
export const apelidos: { find: RegExp; replacement: string }[] = [
  { find: /^@\//, replacement: src("") },
  { find: /^@erp\/dominio\/nucleo$/, replacement: src("dominio/nucleo/index.ts") },
  {
    find: /^@erp\/dominio\/ingestao\/relatorios$/,
    replacement: src("dominio/ingestao/relatorios/index.ts"),
  },
  { find: /^@erp\/dominio\/(.*)$/, replacement: src("dominio/$1") },
  { find: /^@erp\/shared\/(.*)$/, replacement: src("shared/$1") },
];
