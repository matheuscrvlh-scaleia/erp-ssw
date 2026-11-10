# ADR 0011 — `@fastify/swagger-ui` 6 (sai do `@fastify/static` vulnerável)

**Status:** aceita (10/11/2026) — complementa a ADR 0004

## Contexto
`bun audit` acusava uma alta e uma moderada no `@fastify/static` 9.3 (desvio de guarda de rota por
path traversal e caminho não canônico, até 10.1.1), que só entra pelo `@fastify/swagger-ui` 5. A
linha 5 do swagger-ui não aceita `@fastify/static` 10.

## Decisão
Subir `@fastify/swagger-ui` para 6.1 (Fastify 5, `@fastify/static` ^10.1 → 10.1.10, corrigido).
O swagger-ui só é registrado fora de produção (`/docs`), e a borda devolve 404 em `/docs` de todo
jeito; a API não muda.

## Consequências
Restam três moderadas sem correção dentro das faixas, todas fora do caminho de produção ou sem uso
da parte vulnerável: `esbuild` 0.18 (via `drizzle-kit`, só no `db:gerar`), `minimatch` 10.2
(ESLint/typescript-eslint, só no lint) e `uuid` 8 (dentro do `exceljs`, que não chama v3/v5/v6 com
`buf`). Saem quando as dependências que os trazem subirem; forçar `overrides` cruzando major
quebraria quem os usa.
