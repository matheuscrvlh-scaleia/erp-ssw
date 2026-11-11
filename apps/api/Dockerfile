# API (Fastify). Contexto = raiz do repositório (monorepo): `docker compose build api`.
FROM oven/bun:1.4.2-slim AS build
WORKDIR /repo
COPY . .
# Build com tudo; depois reinstala só as dependências de runtime (as que o esbuild deixou de fora).
RUN bun install --frozen-lockfile --ignore-scripts --filter "@erp/api" \
    && bun run --cwd apps/api build \
    && rm -rf node_modules \
    && bun install --frozen-lockfile --ignore-scripts --production --filter "@erp/api" \
    && rm -rf node_modules/@erp

FROM node:22-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORTA=3000
WORKDIR /app
COPY apps/api/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "--enable-source-maps", "dist/server.js"]
