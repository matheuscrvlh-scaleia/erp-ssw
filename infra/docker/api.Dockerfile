# syntax=docker/dockerfile:1.12
#
# API (apps/api, Fastify 5). Contexto = raiz do repositório (.dockerignore na raiz):
#   docker build -f infra/docker/api.Dockerfile -t erp-api:local .
#
# Estágios: manifestos (só os package.json) → deps (bun install congelado) → build (esbuild,
# dist/server.js com os @erp/* dentro) → deps-producao (só as dependências de runtime) → final
# (Node 22 LTS distroless, sem shell, usuário não-root). Nenhum segredo entra na imagem: a
# configuração vem toda do ambiente (apps/api/src/config/env.ts valida no boot).
#
# Imagens base fixadas por digest (atualizar tag + digest juntos; docs/deploy.md §11).
ARG BUN_IMAGEM=oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61
ARG NODE_IMAGEM=gcr.io/distroless/nodejs22-debian13:nonroot@sha256:1b90ca047c3a1046ad3527998c747c25b6a88dde91ba8c71b98669d5813aaa21

# ---------------------------------------------------------------------------------------------
# Só os package.json dos workspaces: a camada do `bun install` fica em cache enquanto só o
# código muda. Workspace novo em apps/* ou packages/* entra sozinho (o bun.lock exige todos).
FROM ${BUN_IMAGEM} AS manifestos
WORKDIR /repo
COPY apps apps
COPY packages packages
RUN find apps packages -mindepth 2 -maxdepth 2 ! -name package.json -exec rm -rf {} +

# ---------------------------------------------------------------------------------------------
FROM ${BUN_IMAGEM} AS deps
WORKDIR /repo
# bunfig.toml junto: minimumReleaseAge e linker=hoisted valem aqui como na máquina do dev.
COPY package.json bun.lock bunfig.toml ./
COPY --from=manifestos /repo/apps apps
COPY --from=manifestos /repo/packages packages
# --frozen-lockfile: falha se o bun.lock não bater com os package.json. --ignore-scripts:
# nenhum postinstall de dependência roda no build (binários nativos vêm por optionalDependencies).
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts --filter "@erp/api"

# ---------------------------------------------------------------------------------------------
FROM deps AS build
COPY packages packages
COPY apps/api apps/api
RUN bun run --cwd apps/api build

# ---------------------------------------------------------------------------------------------
# Dependências de runtime: as que o esbuild deixou de fora (fastify, pg, drizzle-orm, jose,
# argon2...). Mesmo bun.lock, sem devDependencies.
FROM ${BUN_IMAGEM} AS deps-producao
WORKDIR /repo
COPY package.json bun.lock bunfig.toml ./
COPY --from=manifestos /repo/apps apps
COPY --from=manifestos /repo/packages packages
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts --production --filter "@erp/api" \
    # Os @erp/* são links para apps/ e packages/, que não vão para a imagem (já estão no dist).
    && rm -rf node_modules/@erp node_modules/.cache

# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGEM} AS final
ARG VERSAO=dev
ARG COMMIT=desconhecido
ARG CRIADO_EM=
LABEL org.opencontainers.image.title="erp-api" \
      org.opencontainers.image.description="API do ERP SSW (Fastify 5)" \
      org.opencontainers.image.version="${VERSAO}" \
      org.opencontainers.image.revision="${COMMIT}" \
      org.opencontainers.image.created="${CRIADO_EM}" \
      org.opencontainers.image.licenses="UNLICENSED"

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORTA=3000
WORKDIR /app
# package.json só pelo "type": "module" (o dist é ESM). Tudo de dono root: o processo só lê.
COPY apps/api/package.json ./package.json
COPY --from=deps-producao /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist

# 65532 = nonroot da distroless. O compose ainda monta a raiz como somente leitura.
USER 65532:65532
EXPOSE 3000

# Sem shell nem curl: o próprio Node checa. /healthz não toca no banco (vivo ≠ pronto; o /readyz
# é do monitoramento externo).
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
    CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORTA||3000)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

# A distroless já tem ENTRYPOINT ["/nodejs/bin/node"].
CMD ["--enable-source-maps", "dist/server.js"]
