// ESLint (flat config) do monorepo. A raiz chama `configurarEslint` uma vez; cada arquivo usa o
// tsconfig mais próximo (projectService). Formatação é do Prettier: eslint-config-prettier
// desliga o que conflita.
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * @param {{ tsconfigRootDir: string; web: string[]; ignorar?: string[]; shadcn?: string[] }} opcoes
 *   `web`: globs do código React (browser). `shadcn`: componentes gerados pelo shadcn, onde só
 *   as regras que exigiriam reescrever o componente viram desligadas.
 */
export function configurarEslint({ tsconfigRootDir, web, ignorar = [], shadcn = [] }) {
  return tseslint.config(
    {
      ignores: [
        "**/dist/**",
        "**/coverage/**",
        "**/node_modules/**",
        "**/.worktrees/**",
        "**/.migrador/**",
        "**/*.gen.ts",
        "**/drizzle/**",
        "**/*.js",
        "**/*.mjs",
        ...ignorar,
      ],
    },
    {
      files: ["**/*.{ts,tsx}"],
      extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
      languageOptions: {
        ecmaVersion: 2023,
        sourceType: "module",
        globals: { ...globals.node },
        parserOptions: { projectService: true, tsconfigRootDir },
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
        // Log do servidor é o pino; console só no navegador (warn/error).
        "no-console": "error",
        eqeqeq: ["error", "always", { null: "ignore" }],
      },
    },
    {
      files: web,
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
    ...(shadcn.length > 0
      ? [
          {
            files: shadcn,
            rules: {
              "react/no-unknown-property": "off",
              "@typescript-eslint/no-unnecessary-condition": "off",
            },
          },
        ]
      : []),
    {
      files: ["**/*.test.{ts,tsx}"],
      rules: {
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/unbound-method": "off",
      },
    },
    prettier,
  );
}
