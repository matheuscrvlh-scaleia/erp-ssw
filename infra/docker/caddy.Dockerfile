# syntax=docker/dockerfile:1.12
#
# Caddy de borda (o único contêiner exposto: 80/tcp, 443/tcp e 443/udp). Contexto = infra/docker:
#   docker build -f infra/docker/caddy.Dockerfile -t erp-caddy:local infra/docker
#
# Imagem oficial + usuário sem privilégio dono dos diretórios de dados (certificados) e config.
# O Caddyfile NÃO entra na imagem: vem montado de infra/Caddyfile, para que mudar config seja
# `caddy reload` (sem derrubar conexão) e não um contêiner novo. Para abrir 80/443 sem root, o
# binário oficial já tem cap_net_bind_service; o compose derruba as capabilities e devolve só essa.
ARG CADDY_IMAGEM=caddy:2.11-alpine@sha256:78bd35025c7ba85961dd149ae670315129954e77abe2383ac47c89106b35ade9

FROM ${CADDY_IMAGEM}
ARG VERSAO=dev
ARG COMMIT=desconhecido
ARG CRIADO_EM=
LABEL org.opencontainers.image.title="erp-caddy" \
      org.opencontainers.image.description="Caddy de borda do ERP SSW (TLS, HTTP/2 e 3, proxy, cabeçalhos)" \
      org.opencontainers.image.version="${VERSAO}" \
      org.opencontainers.image.revision="${COMMIT}" \
      org.opencontainers.image.created="${CRIADO_EM}" \
      org.opencontainers.image.licenses="UNLICENSED"

RUN addgroup -S -g 10000 borda && adduser -S -D -H -u 10000 -G borda borda \
    && mkdir -p /data/caddy /config/caddy \
    && chown -R borda:borda /data /config
USER 10000:10000

# Admin API só no localhost do contêiner (padrão do Caddy): é por ela que o healthcheck e o
# `caddy reload` falam. Nunca exposta.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:2019/config/"]

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
