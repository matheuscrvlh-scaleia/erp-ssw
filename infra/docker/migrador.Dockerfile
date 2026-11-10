# syntax=docker/dockerfile:1.12
#
# Ferramenta de banco, de execução única (não é serviço): migrations do schema erp, catálogo
# (seeds) e o migrador de dados public → erp (apps/migrador, quando existir). Contexto = raiz:
#   docker build -f infra/docker/migrador.Dockerfile -t erp-migrador:local .
#   docker compose run --rm migrador migrar|semear|dados   (infra/docker/migrador.sh)
#
# Runtime com shell (Node 22 slim) porque o entrypoint escolhe o comando; usuário `node` (1000),
# sem segredo na imagem. Leva as devDependencies: drizzle-kit (migrate) e tsx (seeds e migrador
# rodam do TypeScript, sem etapa de build obrigatória).
ARG BUN_IMAGEM=oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61
ARG NODE_IMAGEM=node:22-trixie-slim@sha256:be1e2a3dc2c4fd68cdfadad2a696a280e0d2749098bee509230174d72fb768c6

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
    bun install --frozen-lockfile --ignore-scripts

# Monta /saida só com o que a ferramenta usa: node_modules, packages/* e apps/migrador (se
# existir; com script `build`, ele roda aqui e o entrypoint prefere o dist).
FROM deps AS build
COPY packages packages
COPY apps apps
RUN if [ -f apps/migrador/package.json ] \
       && grep -q '"build"' apps/migrador/package.json; then \
      bun run --cwd apps/migrador build; \
    fi \
    && mkdir -p /saida/apps \
    && cp -r package.json node_modules packages /saida/ \
    && if [ -d apps/migrador ]; then cp -r apps/migrador /saida/apps/; fi \
    # Links de workspace que não vêm junto (@erp/api, @erp/web...) ficariam quebrados.
    && find /saida/node_modules/@erp -maxdepth 1 -xtype l -delete \
    && rm -rf /saida/node_modules/.cache

FROM ${NODE_IMAGEM} AS final
ARG VERSAO=dev
ARG COMMIT=desconhecido
ARG CRIADO_EM=
LABEL org.opencontainers.image.title="erp-migrador" \
      org.opencontainers.image.description="Migrations, catálogo e migração de dados do ERP SSW (execução única)" \
      org.opencontainers.image.version="${VERSAO}" \
      org.opencontainers.image.revision="${COMMIT}" \
      org.opencontainers.image.created="${CRIADO_EM}" \
      org.opencontainers.image.licenses="UNLICENSED"

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /saida /app
COPY --chmod=0755 infra/docker/migrador.sh /usr/local/bin/migrador
USER 1000:1000

# Execução única: não há processo de longa duração para checar.
HEALTHCHECK NONE

ENTRYPOINT ["/usr/local/bin/migrador"]
CMD ["ajuda"]
