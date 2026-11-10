# syntax=docker/dockerfile:1.12
#
# Web (apps/web, SPA Vite). Contexto = raiz do repositório:
#   docker build -f infra/docker/web.Dockerfile -t erp-web:local .
#
# Sem build-arg: o navegador fala com a API na mesma origem (/api, pela borda), então o bundle é
# o mesmo em qualquer ambiente. Runtime: Caddy servindo o dist na porta 8080, usuário não-root,
# sem TLS (quem fala com a internet é a borda, infra/Caddyfile).
ARG BUN_IMAGEM=oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61
ARG CADDY_IMAGEM=caddy:2.11-alpine@sha256:78bd35025c7ba85961dd149ae670315129954e77abe2383ac47c89106b35ade9

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
    bun install --frozen-lockfile --ignore-scripts --filter "@erp/web"

FROM deps AS build
COPY packages packages
COPY apps/web apps/web
RUN bun run --cwd apps/web build \
    # Source map não vai para o público (o código-fonte inteiro estaria a um clique).
    && find apps/web/dist -name '*.map' -delete

FROM ${CADDY_IMAGEM} AS final
ARG VERSAO=dev
ARG COMMIT=desconhecido
ARG CRIADO_EM=
LABEL org.opencontainers.image.title="erp-web" \
      org.opencontainers.image.description="SPA do ERP SSW (estático servido por Caddy)" \
      org.opencontainers.image.version="${VERSAO}" \
      org.opencontainers.image.revision="${COMMIT}" \
      org.opencontainers.image.created="${CRIADO_EM}" \
      org.opencontainers.image.licenses="UNLICENSED"

# Usuário sem privilégio; a porta 8080 não precisa de capability (o compose derruba todas).
RUN addgroup -S -g 10001 web && adduser -S -D -H -u 10001 -G web web
COPY infra/docker/web.Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
# O Caddy quer diretório de dados mesmo sem TLS: vai para /tmp (tmpfs no compose).
ENV XDG_DATA_HOME=/tmp/caddy-data \
    XDG_CONFIG_HOME=/tmp/caddy-config
USER 10001:10001
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/__saude"]

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
