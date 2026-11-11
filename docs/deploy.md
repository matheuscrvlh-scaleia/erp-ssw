# Deploy do ERP SSW

Configuração padrão por enquanto: um `docker-compose.yml` na raiz, com o Dockerfile de cada app em
`apps/api/Dockerfile` e `apps/web/Dockerfile`. No desenvolvimento sobe só o Redis
(`docker compose up -d redis`, em `127.0.0.1:6379`); api e web rodam com `bun run dev`.

## 1. O que sobe

```
internet ──8081 (host)──▶ web:80    Caddy: SPA estática, /api/public/* → worker-ssw:3000,
                                     resto de /api → api:3000
internet ──3001 (host)──▶ api:3000  Fastify + jobs do ERP (BullMQ) ──▶ redis:6379 (sem porta no host)
                                     └──▶ Postgres (Supabase), SMTP, Google, Ahgora
rede externa "erp-interna": api e web ↔ worker-ssw (outro compose, porta 3000; host 3002)
```

- O sistema inteiro responde na 8081; a 3001 expõe a api direto (`/healthz`, `/readyz`).
- O Docker ignora o ufw para porta publicada: 3001 e 8081 ficam abertas para a internet.
- HTTPS fica com o proxy que estiver na frente da VPS (a api monta os links com
  `https://$DOMINIO`).

## 2. Primeiro deploy

```bash
git clone https://github.com/matheuscrvlh-scaleia/erp-ssw.git ~/erp && cd ~/erp
docker network create erp-interna          # uma vez; o worker-ssw entra nela também
cp .env.example .env && chmod 600 .env     # preencher (§3)
mkdir -p certs                             # CA do Supabase em certs/supabase-ca.crt (§4)
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

Postgres do Supabase, schema `erp`, já preparado (migrations e papéis aplicados). A api conecta
com o papel `erp_app` (sem BYPASSRLS) em `DATABASE_URL`, de preferência pelo pooler em modo
sessão, porta 5432, com TLS verificado:

```
...?sslmode=verify-full&sslrootcert=/etc/erp/certs/supabase-ca.crt
```

A pasta `certs/` da raiz é montada em `/etc/erp/certs` (fora do git). Migration nova:
`bun run db:migrar` de uma máquina confiável, com o papel de migração.

Conexões no Postgres: `API_DB_MAX_CONEXOES` (padrão 10) + as do worker-ssw; tem de caber no Pool
Size do pooler junto com o que o sistema atual usa.

## 5. Chaves e segredos

Ficam só no `.env` da VPS (`chmod 600`) e numa cópia no gerenciador de senhas. Nenhum vai para
imagem, git ou GitHub.

- **JWT (Ed25519)**:
  ```bash
  openssl genpkey -algorithm ed25519 -out jwt.pem
  printf "JWT_CHAVE_PRIVADA='%s'\n" "$(awk 'NF{printf "%s\\n",$0}' jwt.pem)"   # para o .env
  shred -u jwt.pem
  ```
- **`COOKIE_SEGREDO`**: `openssl rand -base64 48`.
- **`SEGREDOS_CHAVES`** (cifra os segredos de integração no banco):
  `echo "SEGREDOS_CHAVES=1:$(openssl rand -base64 32)"`, com `SEGREDOS_CHAVE_ATUAL=1`. O **mesmo
  valor** vai no `.env` do worker-ssw. Sem ela os segredos do banco não decifram: guardar separada
  do backup do banco.
- **worker-ssw**: `WORKER_SSW_URL=http://worker-ssw:3000` e `WORKER_SSW_TOKEN` (um dos tokens que
  o worker-ssw aceita). Sem eles as ações das telas de ingestão respondem 503 e as leituras seguem.
