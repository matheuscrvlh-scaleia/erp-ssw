// ESLint (flat config) do web. Formatação é do Prettier: eslint-config-prettier desliga o que
// conflita.
import { readdirSync } from "node:fs";

import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

// Dependências entre pastas (ADR 0016 §6). Cada migração de módulo remove a sua linha das listas.
const MODULOS = readdirSync(new URL("./src/modulos", import.meta.url), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

// Quem ainda chama `chamar` fora do api.ts do módulo e de lib/.
const CHAMAM_FORA_DO_API = [
  "src/acesso/sessao.ts", // atalho: sai na migração das telas de acesso
  "src/routes/aceitar-convite.tsx", // atalho: sai na migração das telas de acesso
  "src/routes/login.tsx", // atalho: sai na migração das telas de acesso
  "src/routes/redefinir-senha.tsx", // atalho: sai na migração das telas de acesso
  "src/routes/_autenticado/sem-acesso.tsx", // atalho: sai na migração das telas de acesso
  "src/modulos/bonificacao-entrega/**", // atalho: sai na migração do módulo bonificacao-entrega
  "src/modulos/calendario/**", // atalho: sai na migração do módulo calendario
  "src/modulos/codigos/**", // atalho: sai na migração do módulo codigos
  "src/modulos/coletas/**", // atalho: sai na migração do módulo coletas
  "src/modulos/filtros/**", // atalho: sai na migração do módulo filtros
  "src/modulos/historico/**", // atalho: sai na migração do módulo historico
  "src/modulos/ingestao/**", // atalho: sai na migração do módulo ingestao
  "src/modulos/ingestao-ssw/**", // atalho: sai na migração do módulo ingestao-ssw
  "src/modulos/plataforma/**", // atalho: sai na migração do módulo plataforma
  "src/modulos/ranking/**", // atalho: sai na migração do módulo ranking
];

/** Arquivo interno de outro módulo que ainda é importado (o público é só o `api.ts`). */
const INTERNOS_AINDA_IMPORTADOS = [
  "filtros/componentes", // atalho: sai na migração do módulo filtros
  "filtros/regras", // atalho: sai na migração do módulo filtros
  "listagem/busca", // atalho: sai na migração do módulo ranking
  "admin/use-alteracoes", // atalho: sai na migração do módulo plataforma
  "admin/use-integracoes", // atalho: sai na migração do módulo plataforma
  "admin/use-aba-cargos", // atalho: sai na migração do módulo plataforma
  "admin/componentes/MatrizDeCargos", // atalho: sai na migração do módulo plataforma
  "ahgora/PaginaAhgora", // atalho: sai na migração do módulo plataforma
  "ingestao/PaginaImportacaoSsw", // atalho: sai na migração do módulo plataforma
  "ingestao/PaginaXmlCte", // atalho: sai na migração do módulo plataforma
  "ingestao-ssw/PaginaDiagnostico", // atalho: sai na migração do módulo plataforma
  "ingestao-ssw/PaginaIngestao", // atalho: sai na migração do módulo plataforma
];

/** Import de outro módulo que não seja o `api.ts` dele, nem relativo que saia da pasta do módulo. */
function importsDoModulo(modulo, profundidade) {
  const liberados = INTERNOS_AINDA_IMPORTADOS.join("|");
  return {
    files: [`src/modulos/${modulo}/${"*/".repeat(profundidade)}*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: `^@/modulos/(?!${modulo}/)(?!(?:${liberados})$)[^/]+/(?!api$)`,
              message:
                "De outro módulo, só o api.ts. Peça usada por dois módulos sobe para componentes/comum, hooks ou lib (ADR 0016 §6).",
            },
            {
              regex: `^(?:\.\./){${profundidade + 1}}`,
              message: "Import relativo saindo do módulo: use @/modulos/<outro>/api (ADR 0016 §6).",
            },
          ],
        },
      ],
    },
  };
}

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**", "**/*.gen.ts", "**/*.js", "**/*.mjs"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: true },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        { considerDefaultExhaustiveForUnions: true },
      ],
      "no-console": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    settings: { react: { version: "19" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react/prop-types": "off",
      "no-console": ["error", { allow: ["warn", "error"] }],
      // `throw redirect(...)` é como o TanStack Router desvia a navegação no beforeLoad.
      "@typescript-eslint/only-throw-error": [
        "error",
        { allow: [{ from: "package", package: "@tanstack/router-core", name: "Redirect" }] },
      ],
      // Handler async em atributo JSX é o padrão do React (onClick={async () => ...}).
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  {
    // Componentes gerados pelo shadcn: só as regras que exigiriam reescrever o componente.
    files: ["src/componentes/ui/**/*.tsx"],
    rules: {
      "react/no-unknown-property": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/modulos/*/api.ts", "src/lib/**", "**/*.test.{ts,tsx}", ...CHAMAM_FORA_DO_API],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportDeclaration[source.value='@/lib/api'] > ImportSpecifier[imported.name='chamar']",
          message:
            "Só o api.ts do módulo chama a rede: declare a consulta ou a mutação lá (ADR 0016 §4).",
        },
      ],
    },
  },
  ...MODULOS.flatMap((m) => [0, 1, 2, 3].map((p) => importsDoModulo(m, p))),
  {
    files: [
      "src/componentes/comum/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "(?:^@/|/)modulos/",
              message: "componentes/comum, hooks e lib não dependem de módulo (ADR 0016 §6).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/unbound-method": "off",
    },
  },
  prettier,
);
