import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "ingestao", include: ["src/**/*.test.ts"], environment: "node" },
});
