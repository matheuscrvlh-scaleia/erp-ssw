import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*/vitest.config.ts", "apps/*/vitest.config.ts"],
    // `bun run test:cobertura` (CI): relatório de cobertura do código de produção.
    coverage: {
      provider: "v8",
      include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.ts"],
      exclude: ["**/*.test.{ts,tsx}", "**/routeTree.gen.ts"],
      reporter: ["text-summary", "lcov"],
    },
  },
});
