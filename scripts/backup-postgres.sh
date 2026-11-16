#!/bin/sh
# Serviço `backup` do docker-compose: dump do banco ao subir e a cada 24 h em /backups, apagando os
# com mais de BACKUP_DIAS dias. Formato custom (-Fc): restaurar com pg_restore (docs/deploy.md §4).
# atalho: intervalo fixo de 24 h contado da subida do contêiner, sem horário marcado.
set -u

while :; do
  arquivo="/backups/erp-$(date +%Y-%m-%d).dump"
  if pg_dump -Fc -d postgres -f "$arquivo.parcial"; then
    mv "$arquivo.parcial" "$arquivo"
    echo "backup ok: $arquivo ($(du -h "$arquivo" | cut -f1))"
  else
    rm -f "$arquivo.parcial"
    echo "backup FALHOU: $arquivo" >&2
  fi
  find /backups -name 'erp-*.dump' -mtime +"${BACKUP_DIAS:-7}" -delete
  sleep 86400
done
