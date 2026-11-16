# ADR 0019 — Postgres próprio em Docker no lugar do Supabase

- Situação: aceita (16/11/2026, decisão do dono)
- Substitui: o item 4 de `docs/arquitetura.md` (Postgres do Supabase `erp-ssw`)

## Contexto

O ERP usa o Supabase só como Postgres: o login é da api (argon2id + JWT), os arquivos vão para um
S3 compatível, a única lógica no banco é RLS por `current_setting`, e o schema `erp` não usa
extensão, função nem papel do Supabase. O plano Pro custaria só para hospedar um Postgres.

## Decisão

1. **Postgres 17 no docker-compose do ERP** (serviço `postgres`, volume `postgres_dados`), mesma
   versão maior do Supabase de onde os dados vêm. Porta só no `127.0.0.1` do host.
2. **Papéis criados na 1ª subida** por `apps/api/bootstrap/docker-roles.sh` (roles.sql + senhas do
   `.env`). Os mesmos três de antes, sem BYPASSRLS; RLS e GRANTs não mudam.
3. **worker-ssw na mesma VPS**, ligado ao banco pela rede Docker `erp_banco` (external no compose
   dele). Sem TLS: o tráfego não sai do host.
4. **Backup** pelo serviço `backup` (`pg_dump -Fc` diário, 7 dias). A cópia para fora da VPS é
   obrigatória e fica com a operação (docs/deploy.md §4).
5. **Virada** por `scripts/migrar-do-supabase.sh`: `pg_dump | pg_restore` de `erp` e `migracoes`
   numa transação, conferindo a contagem de linhas por tabela (docs/deploy.md §6).

## Consequências

- Sem custo do Supabase; em troca, backup fora da VPS, atualização do Postgres e espaço em disco
  passam a ser nossos.
- Sem PITR: o pior caso de perda é desde o último dump (até 24 h). Se isso não servir, entra
  arquivamento de WAL (pgBackRest ou WAL-G) num ADR próprio.
- Desenvolvimento local usa o mesmo compose (`docker compose up -d redis postgres`).
