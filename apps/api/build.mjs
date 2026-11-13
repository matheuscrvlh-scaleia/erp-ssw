// Empacota a API num único ESM. Os caminhos @erp/* (views/contracts, models/common, domain, db) vêm
// do tsconfig.json e entram no bundle; as dependências de node_modules ficam de fora (instaladas na
// imagem).
import { build } from "esbuild";

await build({
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.js",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  tsconfig: "tsconfig.json",
  plugins: [
    {
      name: "dependencias-externas",
      setup(b) {
        b.onResolve({ filter: /^[^./]/ }, (args) =>
          args.path.startsWith("@erp/") ? undefined : { path: args.path, external: true },
        );
      },
    },
  ],
});
