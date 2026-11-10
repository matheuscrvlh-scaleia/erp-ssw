import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "dominio", include: ["src/**/*.test.ts"] },
});
