# Deploy do ERP SSW

Configuração padrão por enquanto: um `docker-compose.yml` na raiz, com o Dockerfile de cada app em
`apps/api/Dockerfile` e `apps/web/Dockerfile`. No desenvolvimento sobe só o Redis
(`docker compose up -d redis`, em `127.0.0.1:6379`); api e web rodam com `bun run dev`.

## 1. O que sobe

```
internet ──8081 (host)──▶ web:80    Caddy: SPA estática, /api/public/* → https://worker.ssw.scaleia.ai,
                                     resto de /api → api:3000
internet ──3001 (host)──▶ api:3000  Fastify + jobs do ERP (BullMQ) ──▶ redis:6379 (sem porta no host)
                                     └──▶ Postgres (Supabase), SMTP, Google, Ahgora
worker-ssw: outro compose; ERP e worker se falam pelos domínios públicos (worker.ssw.scaleia.ai)
```

- O sistema inteiro responde na 8081; a 3001 expõe a api direto (`/healthz`, `/readyz`).
- O Docker ignora o ufw para porta publicada: 3001 e 8081 ficam abertas para a internet.
- HTTPS fica com o proxy que estiver na frente da VPS. Os links dos e-mails usam o domínio
  cadastrado em Plataforma › Integrações.

## 2. Primeiro deploy

```bash
git clone https://github.com/matheuscrvlh-scaleia/erp-ssw.git ~/erp && cd ~/erp
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
  os segredos das integrações (das empresas e da Plataforma) e deriva o segredo do cookie do login
  pelo Google. O **mesmo valor** vai no `.env` do worker-ssw. Fica no ambiente, nunca no banco:
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
