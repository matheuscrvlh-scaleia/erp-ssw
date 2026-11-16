# Deploy do ERP SSW

Configuração padrão por enquanto: um `docker-compose.yml` na raiz, com o Dockerfile de cada app em
`apps/api/Dockerfile` e `apps/web/Dockerfile`. No desenvolvimento sobem só o Redis e o Postgres
(`docker compose up -d redis postgres`, em `127.0.0.1:6379` e `127.0.0.1:5432`); api e web rodam com
`bun run dev`, cada um na sua pasta (`apps/api`, `apps/web`).

## 1. O que sobe

```
internet ──8081 (host)──▶ web:80    Caddy: SPA estática, /api/public/* → https://worker.ssw.scaleia.ai,
                                     resto de /api → api:3000
internet ──3001 (host)──▶ api:3000  Fastify + jobs do ERP (BullMQ) ──▶ redis:6379, postgres:5432
                                     └──▶ SMTP, Ahgora
postgres:5432 (127.0.0.1 no host)   Postgres 17, schema erp; rede erp_banco para o worker-ssw
backup                              dump diário em ./backups (§4)
worker-ssw: outro compose na mesma VPS; banco pela rede erp_banco, o resto pelos domínios públicos
```

- O sistema inteiro responde na 8081; a 3001 expõe a api direto (`/healthz`, `/readyz`).
- O Docker ignora o ufw para porta publicada: 3001 e 8081 ficam abertas para a internet. Postgres
  e Redis só escutam no `127.0.0.1` do host.
- HTTPS fica com o proxy que estiver na frente da VPS. Os links dos e-mails usam o domínio
  cadastrado em Plataforma › Integrações.

## 2. Primeiro deploy

```bash
git clone https://github.com/matheuscrvlh-scaleia/erp-ssw.git ~/erp && cd ~/erp
cp .env.example .env && chmod 600 .env     # preencher (§4 e §5)
docker compose up -d postgres              # 1ª subida: cria os papéis com as senhas do .env
# banco novo: migrations (§4); vindo do Supabase: §6
docker compose up -d --build
docker compose ps                          # api "healthy"
curl -fsS http://127.0.0.1:3001/readyz     # 200 prova banco e Redis
```

## 3. Atualizar e voltar

```bash
git pull --ff-only && docker compose up -d --build     # recria api e web (segundos fora do ar)
git checkout <commit> && docker compose up -d --build  # voltar para uma versão anterior
docker compose logs -f api                             # logs
```

Mudou só o `.env`? `docker compose up -d` recria quem usa a variável.

## 4. Banco

Postgres 17 do próprio compose (serviço `postgres`, volume `postgres_dados`), banco `postgres`,
schema `erp`. Na 1ª subida, com o volume vazio, `apps/api/bootstrap/docker-roles.sh` cria
`erp_migracao`, `erp_app` e `erp_worker` (todos sem BYPASSRLS) com as senhas `ERP_*_SENHA` do
`.env`. Depois disso mudar o `.env` não troca senha nenhuma:
`docker compose exec postgres psql -U postgres -c "\password erp_app"` e atualizar o `.env`.

- A api conecta com `erp_app` em `postgres://erp_app:<senha>@postgres:5432/postgres`, sem TLS (rede
  interna do Docker). O worker-ssw usa `erp_worker` pela rede `erp_banco` (mesmo host `postgres`).
- Migration nova: `bun run db:migrar` (em `apps/api`) com
  `DATABASE_URL_MIGRACAO=postgres://erp_migracao:<senha>@127.0.0.1:5432/postgres`, na VPS ou de
  uma máquina confiável por túnel (`ssh -L 5432:127.0.0.1:5432 <vps>`).
- Conexões: `API_DB_MAX_CONEXOES` (10) + as do worker-ssw (5 a 10) + backup (1) cabem no
  `max_connections` padrão (100).

**Backup.** O serviço `backup` faz `pg_dump -Fc` do banco ao subir e a cada 24 h em `BACKUP_PASTA`
(padrão `./backups`, fora do git) e apaga os com mais de `BACKUP_DIAS` (7). Os dumps ficam na
mesma VPS: copiar a pasta para fora dela (outro servidor ou bucket), senão perder a VPS é perder
os dados. Conferir: `docker compose logs backup` (`backup ok: ...`). Restaurar num volume vazio,
com os papéis já criados:

```bash
docker compose exec -T postgres pg_restore -U postgres -d postgres --exit-on-error \
  --single-transaction < backups/erp-AAAA-MM-DD.dump
```

## 5. Chaves, segredos e Plataforma › Integrações

O `.env` tem só três variáveis obrigatórias, guardadas também no gerenciador de senhas. Nenhuma vai
para imagem, git ou GitHub:

- **`DATABASE_URL`**: papel `erp_app` (§4).
- **`JWT_CHAVE_PRIVADA`** (Ed25519). O `kid` sai da própria chave (RFC 7638):
  ```bash
  openssl genpkey -algorithm ed25519 -out jwt.pem
  printf "JWT_CHAVE_PRIVADA='%s'\n" "$(awk 'NF{printf "%s\\n",$0}' jwt.pem)"   # para o .env
  shred -u jwt.pem
  ```
  Rotação: a chave nova entra em `JWT_CHAVE_PRIVADA` e a pública da antiga em
  `JWT_CHAVES_ANTERIORES='["<PEM público>"]'` até os tokens dela vencerem (15 min).
- **`SEGREDOS_CHAVES`** (chave mestra): `echo "SEGREDOS_CHAVES=1:$(openssl rand -base64 32)"`. Cifra
  os segredos das integrações (das empresas e da Plataforma). O **mesmo valor** vai no `.env` do worker-ssw. Fica no ambiente, nunca no banco:
  guardada junto do que protege, não protegeria nada. Sem ela os segredos do banco não decifram.
  Rotação: `SEGREDOS_CHAVES=1:<antiga>,2:<nova>` (a maior vira a atual), recriar a api e o
  worker-ssw e pedir o job `docker compose run --rm --no-deps api --enable-source-maps
  dist/server.js --recifrar-segredos`. Só tirar a `1:` quando o log disser `falhas: []`.

O resto se configura na tela **Plataforma › Integrações** (só admin da Plataforma). Os segredos
vão cifrados com a chave mestra, e o que se salva vale em até 30 s, sem reiniciar:

- **Domínio do sistema**: endereço público (ex.: `https://erp.empresa.com.br`), usado nos links do
  convite e do "esqueci minha senha".
- **E-mail (Resend)**: remetente (domínio verificado no Resend) e a chave da API. O botão
  **Testar** manda um e-mail na hora. Sem isso, em produção, o convite e o "esqueci minha senha"
  falham com aviso.
- **worker-ssw**: endereço (`https://worker.ssw.scaleia.ai`) e o token de serviço (um dos que o
  worker-ssw aceita). Sem eles as ações das telas de ingestão respondem 503 e as leituras seguem.

## 6. Virada do Supabase para o Postgres do compose (uma vez)

O Supabase `erp-ssw` era usado como Postgres comum (sem Auth, Storage, funções nem extensões no
`erp`), então a cópia é um `pg_dump`/`pg_restore` dos schemas `erp` e `migracoes` com donos,
GRANTs e RLS. 5,8 GB em nov/2026.

1. `.env` com `POSTGRES_SENHA` e `ERP_*_SENHA` novas (`openssl rand -hex 24`, sem símbolo que
   precise de escape na URL) e `docker compose up -d postgres`.
2. Parar quem escreve: `docker compose stop api` aqui e `docker compose stop worker-ssw` no
   worker-ssw.
3. Copiar e conferir (o script recusa se o destino já tiver o schema `erp`; no fim compara a
   contagem de linhas de cada tabela nos dois lados):
   ```bash
   ORIGEM_URL='postgres://erp_migracao.<projeto>:<senha>@<pooler>:5432/postgres?sslmode=require' \
     scripts/migrar-do-supabase.sh
   ```
4. Trocar `DATABASE_URL` aqui (§4) e no worker-ssw (docs/deploy.md de lá), `docker compose up -d`
   nos dois, `curl -fsS http://127.0.0.1:3001/readyz` e conferir o login e uma tela de dados.
5. Voltar, se preciso: o Supabase fica intacto. Basta repor as `DATABASE_URL` antigas. Desligar o
   projeto só depois de alguns dias rodando aqui e com um backup copiado para fora da VPS.
