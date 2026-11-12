import { defineConfig } from "vitest/config";

import { apelidos } from "./apelidos";

export default defineConfig({
  resolve: { alias: apelidos },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/testes/ambiente.ts"],
    // Teste de componente com Radix/roteador passa de 5 s quando a suíte inteira roda em paralelo.
    testTimeout: 20_000,
    // `bun run test:cobertura` (CI): relatório de cobertura do código de produção.
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "**/routeTree.gen.ts"],
      reporter: ["text-summary", "lcov"],
    },
  },
});
