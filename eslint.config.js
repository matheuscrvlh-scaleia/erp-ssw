import { configurarEslint } from "@erp/config/eslint";

export default configurarEslint({
  tsconfigRootDir: import.meta.dirname,
  web: ["apps/web/**/*.{ts,tsx}"],
  shadcn: ["apps/web/src/componentes/ui/**/*.tsx"],
});
