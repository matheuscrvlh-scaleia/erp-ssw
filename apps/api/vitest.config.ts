import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const src = (caminho: string) => fileURLToPath(new URL(`./src/${caminho}`, import.meta.url));

export default defineConfig({
  // Os mesmos caminhos do tsconfig.json.
  resolve: {
    alias: [
      { find: /^@erp\/dominio\/nucleo$/, replacement: src("dominio/nucleo/index.ts") },
      {
        find: /^@erp\/dominio\/ingestao\/relatorios$/,
        replacement: src("dominio/ingestao/relatorios/index.ts"),
      },
      { find: /^@erp\/dominio\/(.*)$/, replacement: src("dominio/$1") },
      { find: /^@erp\/shared\/(.*)$/, replacement: src("shared/$1") },
      { find: /^@erp\/db$/, replacement: src("db/index.ts") },
      { find: /^@erp\/db\/schema$/, replacement: src("db/schema/index.ts") },
      { find: /^@erp\/db\/segredos$/, replacement: src("db/segredos.ts") },
      { find: /^@erp\/db\/seeds$/, replacement: src("db/seeds/catalogo.ts") },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // `bun run test:cobertura` (CI): relatório de cobertura do código de produção.
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts"],
      reporter: ["text-summary", "lcov"],
    },
  },
});
