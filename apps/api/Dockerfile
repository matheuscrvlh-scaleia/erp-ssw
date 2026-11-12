# API (Fastify). Contexto = apps/api: `docker compose build api`.
FROM oven/bun:1.4.2-slim AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
# Build com tudo; depois reinstala só as dependências de runtime (as que o esbuild deixou de fora).
RUN bun run build \
    && rm -rf node_modules \
    && bun install --frozen-lockfile --ignore-scripts --production

FROM node:22-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORTA=3000
WORKDIR /app
COPY package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "--enable-source-maps", "dist/server.js"]
