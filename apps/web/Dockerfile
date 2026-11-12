# Web (SPA Vite) servida por Caddy na porta 80, repassando /api para a api.
# Contexto = apps/web: `docker compose build web`.
FROM oven/bun:1.4.2-slim AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun run build \
    && find dist -name '*.map' -delete

FROM caddy:2.11-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80
