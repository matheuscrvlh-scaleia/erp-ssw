#!/usr/bin/env bash
# Deploy sem queda na VPS (rodar em infra/ ou de qualquer lugar):
#   ./deploy.sh <tag>            publica a tag (SHA curto do release.yml)
#   ./deploy.sh <tag> --migrar   roda as migrations da tag ANTES de trocar a API
#   ./deploy.sh voltar           volta para a tag anterior do histórico (rollback)
#
# Para web e api, uma de cada vez:
#   1. sobe réplicas NOVAS da tag ao lado das antigas (--scale 2N --no-recreate);
#   2. espera todas as novas ficarem `healthy` (HEALTHCHECK da imagem); se não ficarem, remove
#      as novas e para — as antigas nunca saíram do ar;
#   3. manda SIGTERM nas antigas: param de aceitar conexão e terminam o que está em andamento;
#      o Caddy já vê as novas pelo DNS e refaz noutra réplica o que bater em porta fechada.
# Os jobs do ERP rodam na api: a réplica antiga devolve à fila o job interrompido. Depois: caddy
# (só recria se a CADDY_TAG mudou) e `caddy reload`. Grava a tag no .env e no histórico. O
# worker-ssw tem deploy próprio (outro compose).
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

TAG="${1:?uso: ./deploy.sh <tag> [--migrar] | ./deploy.sh voltar}"
MIGRAR=0
if [[ "${2:-}" == "--migrar" ]]; then MIGRAR=1; fi

if [[ "$TAG" == voltar ]]; then
  [[ -s "$HISTORICO" ]] || falhar "sem histórico de deploy para voltar"
  # Linha: "<data> <tag no ar> <- <tag anterior>"
  TAG="$(tail -n 1 "$HISTORICO" | awk '{print $4}')"
  [[ -n "$TAG" && "$TAG" != "?" ]] || falhar "histórico sem tag anterior"
  log "voltando para $TAG (migration não é desfeita: conferir se a versão convive com o banco)"
fi
[[ "$TAG" =~ ^[A-Za-z0-9._-]+$ ]] || falhar "tag inválida: $TAG"

export IMAGEM_TAG="$TAG"
compose() { docker compose "$@"; }
saude() {
  docker inspect --format \
    '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$1"
}

rolar() {
  local servico="$1" antigos novos n c fim tudo_ok
  antigos="$(compose ps -q "$servico" | sort)"
  n=$(wc -w <<<"$antigos")
  if [[ "$n" -eq 0 ]]; then
    log "$servico: nada rodando; subindo do zero"
    compose up -d --no-deps "$servico"
    return
  fi
  log "$servico: $n antiga(s); subindo $n nova(s) com a tag $TAG"
  compose up -d --no-deps --no-recreate --scale "$servico=$((n * 2))" "$servico"
  novos="$(comm -13 <(echo "$antigos") <(compose ps -q "$servico" | sort))"

  fim=$((SECONDS + ESPERA_SAUDE_S))
  while :; do
    tudo_ok=1
    for c in $novos; do
      case "$(saude "$c")" in
        healthy) ;;
        unhealthy | exited | dead) tudo_ok=0; fim=0 ;;
        *) tudo_ok=0 ;;
      esac
    done
    [[ "$tudo_ok" -eq 1 ]] && break
    if ((SECONDS >= fim)); then
      log "$servico: réplicas novas não ficaram saudáveis; removendo-as (as antigas seguem no ar)"
      for c in $novos; do docker logs --tail 30 "$c" 2>&1 | sed "s/^/  [$c] /" || true; done
      # shellcheck disable=SC2086
      docker rm -f $novos >/dev/null
      exit 1
    fi
    sleep 3
  done

  log "$servico: novas saudáveis; drenando as antigas"
  # stop_grace_period do compose não vale para `docker stop`: o tempo vai explícito.
  # shellcheck disable=SC2086
  docker stop --time 30 $antigos >/dev/null
  # shellcheck disable=SC2086
  docker rm $antigos >/dev/null
  log "$servico: ok"
}

log "baixando imagens da tag $TAG"
if [[ "${SEM_PULL:-0}" != 1 ]]; then
  compose pull --quiet web api
  if [[ "$MIGRAR" -eq 1 ]]; then compose --profile ferramentas pull --quiet migrador; fi
fi

if [[ "$MIGRAR" -eq 1 ]]; then
  # Migration tem de ser compatível com a versão no ar (expandir antes, contrair depois): as
  # réplicas antigas seguem atendendo até as novas ficarem saudáveis.
  log "migrations (erp_migracao) da tag $TAG"
  compose run --rm migrador migrar
fi

compose up -d --no-deps redis
rolar web
rolar api

log "caddy: recarregando o Caddyfile"
# Espera o Caddy reler o DNS (refresh 5 s) antes do reload: o reload cancela as novas tentativas
# de quem estiver no meio de uma, e o cache ainda pode ter o IP de uma réplica que acabou de sair.
sleep 7
# Recria o caddy só se a CADDY_TAG ou o ambiente dele mudaram (queda de segundos; §6.3).
compose up -d --no-deps caddy
compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

anterior="$(grep -E '^IMAGEM_TAG=' .env | cut -d= -f2- || true)"
if grep -qE '^IMAGEM_TAG=' .env; then
  sed -i "s/^IMAGEM_TAG=.*/IMAGEM_TAG=$TAG/" .env
else
  printf 'IMAGEM_TAG=%s\n' "$TAG" >>.env
fi
printf '%s %s <- %s\n' "$(date -u +%FT%TZ)" "$TAG" "${anterior:-?}" >>"$HISTORICO"
log "pronto: $TAG no ar (anterior: ${anterior:-?}; rollback: ./deploy.sh voltar)"
