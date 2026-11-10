import { fileURLToPath, URL } from "node:url";

import { defineProject } from "vitest/config";

export default defineProject({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    name: "web",
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/testes/ambiente.ts"],
  },
});
