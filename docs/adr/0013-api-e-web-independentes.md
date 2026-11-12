# ADR 0013 — api e web como projetos independentes

- Situação: aceita (12/11/2026, decisão do dono)
- Substitui: o monorepo com bun workspaces (`packages/config`, `packages/shared`,
  `packages/dominio`, `packages/db`)

## Contexto

O dono quer cada app na sua pasta, com o próprio código e as próprias configurações, e o
docker-compose como único ponto que junta os dois. Na raiz ficam só `apps/`, `docs/`, o
`docker-compose.yml` e o que é do repositório (`.github`, `.gitignore`, guias).

## Decisão

1. `apps/api` e `apps/web` têm cada um `package.json`, `bun.lock`, `bunfig.toml`, `tsconfig.json`,
   `eslint.config.js`, `vitest.config.ts`, `.prettierignore`, `Dockerfile` e `.dockerignore`. A
   configuração do Prettier fica no `package.json`. Os comandos (`dev`, `test`, `lint`,
   `typecheck`, `build`, `db:*`) rodam dentro da pasta do app.
2. `packages/db` vira `apps/api/src/db` (+ `apps/api/drizzle`, `apps/api/bootstrap`), porque só a
   api usa.
3. `packages/shared` e `packages/dominio` viram **cópias**: origem em `apps/api/src/{shared,dominio}`,
   cópia igual em `apps/web/src/{shared,dominio}`. É o mesmo modelo do worker-ssw (ADR 0012): os
   imports continuam `@erp/shared/*` e `@erp/dominio/*`, resolvidos pelo `paths` do `tsconfig.json`
   de cada app (e pelo `vitest.config.ts`/`apelidos.ts` do web), então os arquivos ficam idênticos
   e a sincronia é um `diff -r`.
4. A imagem de cada app é construída só com a pasta dele (`context: ./apps/<app>`). O CI roda
   tipos, lint, testes e build num job por app.

## Consequências

- Mudança em contrato ou regra pura vai às duas cópias no mesmo commit; o revisor confere com
  `diff -r apps/api/src/shared apps/web/src/shared` (idem `dominio`; só o README fica na api).
- Dependência nova entra no `package.json` de cada app que a usa; cada `bun.lock` é auditado no CI.
- O worker-ssw passa a copiar de `apps/api/src/{shared,dominio,db}`.
