#!/usr/bin/env bash
# Deploy na VPS com build na própria máquina (rodar de qualquer lugar):
#   ./deploy.sh              git pull + build + troca
#   ./deploy.sh --migrar     idem, rodando as migrations ANTES de trocar a API
#   SEM_PULL=1 ./deploy.sh   usa o código já presente (voltar: git checkout <commit> antes)
#
# web (host 8081 → 80) e api (host 3001 → 3000) publicam porta fixa no host, então têm uma réplica
# cada e a troca recria o contêiner: alguns segundos fora do ar. Uma de cada vez, esperando ficar
# `healthy` (HEALTHCHECK da imagem); se não ficar, mostra o log e para. A api antiga recebe SIGTERM
# e devolve à fila o job interrompido. Depois: caddy (só recria se a imagem ou o ambiente dele
# mudaram) e `caddy reload`. Grava o commit no histórico. O worker-ssw tem deploy próprio.
# Runbook: docs/deploy.md §6.
set -euo pipefail

cd "$(dirname "$0")"
ESPERA_SAUDE_S="${ESPERA_SAUDE_S:-180}"
HISTORICO=.deploy-historico

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
falhar() { printf '[deploy] %s\n' "$*" >&2; exit 1; }

[[ -f .env ]] || falhar "falta infra/.env (modelo: .env.example)"
docker network inspect erp-interna >/dev/null 2>&1 ||
  falhar "falta a rede erp-interna: docker network create erp-interna (docs/deploy.md §1)"

MIGRAR=0
case "${1:-}" in
  "") ;;
  --migrar) MIGRAR=1 ;;
  *) falhar "uso: ./deploy.sh [--migrar]" ;;
esac

if [[ "${SEM_PULL:-0}" != 1 ]]; then
  log "git pull"
  git -C .. pull --ff-only
fi
TAG="$(git -C .. rev-parse --short HEAD)"

compose() { docker compose "$@"; }
saude() {
  docker inspect --format \
    '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$1"
}

trocar() {
  local servico="$1" c fim
  log "$servico: recriando com a tag $TAG"
  compose up -d --no-deps "$servico"
  c="$(compose ps -q "$servico")"
  fim=$((SECONDS + ESPERA_SAUDE_S))
  while :; do
    case "$(saude "$c")" in
      healthy) break ;;
      unhealthy | exited | dead) fim=0 ;;
    esac
    if ((SECONDS >= fim)); then
      docker logs --tail 30 "$c" 2>&1 | sed "s/^/  [$servico] /" || true
      falhar "$servico: não ficou saudável (voltar: git checkout <commit> && SEM_PULL=1 ./deploy.sh)"
    fi
    sleep 3
  done
  log "$servico: ok"
}

log "montando as imagens de $TAG"
compose build web api caddy
if [[ "$MIGRAR" -eq 1 ]]; then compose --profile ferramentas build migrador; fi

if [[ "$MIGRAR" -eq 1 ]]; then
  # Migration tem de ser compatível com a versão no ar (expandir antes, contrair depois): a api
  # antiga segue atendendo até ser trocada.
  log "migrations (erp_migracao) de $TAG"
  compose run --rm migrador migrar
fi

compose up -d --no-deps redis
trocar web
trocar api

log "caddy: recarregando o Caddyfile"
# Espera o Caddy reler o DNS (refresh 5 s) antes do reload: o reload cancela as novas tentativas
# de quem estiver no meio de uma, e o cache ainda pode ter o IP de uma réplica que acabou de sair.
sleep 7
# Recria o caddy só se a imagem ou o ambiente dele mudaram (queda de segundos; §6.3).
compose up -d --no-deps caddy
compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

anterior="$(tail -n 1 "$HISTORICO" 2>/dev/null | awk '{print $2}' || true)"
printf '%s %s <- %s\n' "$(date -u +%FT%TZ)" "$TAG" "${anterior:-?}" >>"$HISTORICO"
log "pronto: $TAG no ar (anterior: ${anterior:-?}; voltar: git checkout <commit> && SEM_PULL=1 ./deploy.sh)"
