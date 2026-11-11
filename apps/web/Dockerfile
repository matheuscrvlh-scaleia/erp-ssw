# Web (SPA Vite) servida por Caddy na porta 80, repassando /api para a api.
# Contexto = raiz do repositório (monorepo): `docker compose build web`.
FROM oven/bun:1.4.2-slim AS build
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile --ignore-scripts --filter "@erp/web" \
    && bun run --cwd apps/web build \
    && find apps/web/dist -name '*.map' -delete

FROM caddy:2.11-alpine
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
EXPOSE 80
