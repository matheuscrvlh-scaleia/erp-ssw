import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "migrador", include: ["src/**/*.test.ts"], environment: "node" },
});
