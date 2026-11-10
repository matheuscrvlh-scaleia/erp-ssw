# syntax=docker/dockerfile:1.12
#
# Worker (apps/worker, BullMQ). Contexto = raiz do repositório:
#   docker build -f infra/docker/worker.Dockerfile -t erp-worker:local .
#
# Mesmo esquema da API (ver api.Dockerfile): bun para instalar e empacotar, Node 22 distroless
# sem root para rodar. Sem porta pública: só o /healthz interno (PORTA_SAUDE) para o HEALTHCHECK.
ARG BUN_IMAGEM=oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61
ARG NODE_IMAGEM=gcr.io/distroless/nodejs22-debian13:nonroot@sha256:1b90ca047c3a1046ad3527998c747c25b6a88dde91ba8c71b98669d5813aaa21

FROM ${BUN_IMAGEM} AS manifestos
WORKDIR /repo
COPY apps apps
COPY packages packages
RUN find apps packages -mindepth 2 -maxdepth 2 ! -name package.json -exec rm -rf {} +

FROM ${BUN_IMAGEM} AS deps
WORKDIR /repo
COPY package.json bun.lock bunfig.toml ./
COPY --from=manifestos /repo/apps apps
COPY --from=manifestos /repo/packages packages
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts --filter "@erp/worker"

FROM deps AS build
COPY packages packages
COPY apps/worker apps/worker
RUN bun run --cwd apps/worker build

FROM ${BUN_IMAGEM} AS deps-producao
WORKDIR /repo
COPY package.json bun.lock bunfig.toml ./
COPY --from=manifestos /repo/apps apps
COPY --from=manifestos /repo/packages packages
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts --production --filter "@erp/worker" \
    && rm -rf node_modules/@erp node_modules/.cache

FROM ${NODE_IMAGEM} AS final
ARG VERSAO=dev
ARG COMMIT=desconhecido
ARG CRIADO_EM=
LABEL org.opencontainers.image.title="erp-worker" \
      org.opencontainers.image.description="Worker do ERP SSW (BullMQ: ingestão, projeções, agendamentos)" \
      org.opencontainers.image.version="${VERSAO}" \
      org.opencontainers.image.revision="${COMMIT}" \
      org.opencontainers.image.created="${CRIADO_EM}" \
      org.opencontainers.image.licenses="UNLICENSED"

ENV NODE_ENV=production \
    PORTA_SAUDE=3002
WORKDIR /app
COPY apps/worker/package.json ./package.json
COPY --from=deps-producao /repo/node_modules ./node_modules
COPY --from=build /repo/apps/worker/dist ./dist

USER 65532:65532

# 200 = Redis responde e nenhum Worker do BullMQ parou (apps/worker/src/main.ts).
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
    CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORTA_SAUDE||3002)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

CMD ["--enable-source-maps", "dist/main.js"]
