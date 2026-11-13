import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import { aliases } from "./aliases";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      // Rotas por arquivo em src/routes (gera src/routeTree.gen.ts), com code splitting por rota.
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
      tailwindcss(),
    ],
    resolve: { alias: aliases },
    server: {
      port: 5173,
      // Em desenvolvimento a API roda à parte: o navegador fala só com o Vite (mesma origem, o
      // cookie de refresh com SameSite=Strict funciona sem CORS).
      proxy: { "/api": { target: env["API_URL_DEV"] ?? "http://localhost:3001" } },
    },
    build: { sourcemap: true },
  };
});
