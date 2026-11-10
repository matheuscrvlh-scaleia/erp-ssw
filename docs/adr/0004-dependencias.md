# ADR 0004 — Versões das dependências

**Status:** aceita (10/11/2026)

## Contexto
Na data, várias bibliotecas já têm major nova (TypeScript 7, ESLint 10, Vite 8, Vitest 5,
BullMQ 6, ioredis 6, lucide-react 1). O `typescript-eslint` só suporta TypeScript `< 6.1`.

## Decisão
Ficamos na última linha estável conhecida e mantida de cada uma: TypeScript 5.9, ESLint 9,
Vite 7, Vitest 4, BullMQ 5, ioredis 5, nodemailer 7, `fastify-type-provider-zod` 6 (zod 4),
`@fastify/rate-limit` 10, `@fastify/swagger-ui` 5, lucide-react 0.577 (mesmos ícones do sistema
atual). `bunfig.toml` mantém `minimumReleaseAge = 86400`.

## Consequências
Subir de major é trabalho planejado (uma ADR por salto), não efeito colateral de `bun update`.
