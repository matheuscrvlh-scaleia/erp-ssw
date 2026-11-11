# Runbook — deploy do ERP SSW na VPS

Arquivos: `infra/compose.yaml`, `infra/Caddyfile`, `infra/redis.conf`, `infra/deploy.sh`,
`infra/.env.example`, `infra/docker/*.Dockerfile`. CI: `.github/workflows/ci.yml` (todo push/PR).
As imagens são montadas na própria VPS (`git pull` + build; sem registro de imagens). Validado
localmente em 10/11/2026 (§1.3).

A ingestão do SSW (FTP, BI2, webhook, XML, projeções do Romaneio) é o **worker-ssw**, sistema
separado com compose, Redis e deploy próprios (ADR 0012). Este runbook cobre o ERP e o que liga os
dois: a rede `erp-interna` (§1.4), as conexões do Postgres (§4.1) e a ordem na virada (§10).

## 1. Visão geral

```
internet ──80/443 tcp, 443 udp──▶ caddy (borda: TLS automático, HTTP/2 e 3, cabeçalhos, limites, log)
                                   │  rede "interna" (sem saída para a internet)
                                   ├──▶ web:8080   SPA estática (Caddy sem TLS, N réplicas)
                                   ├──▶ api:3001   Fastify + jobs do ERP no BullMQ (N réplicas) ─┐
                                   │                                                             │ rede "dados" (sem saída)
                                   │                                                             ├──▶ redis:6379 (senha, AOF)
                                   │  rede externa "erp-interna" (§1.4)                          │ rede "saida"
                                   └──▶ worker-ssw:3003 (/api/public/*; outro compose)           ├──▶ Postgres (Supabase),
                                        ▲ api ──▶ /interno/v1/* (WORKER_SSW_URL)                 │    SMTP, Google, Ahgora
                                       migrador (execução única) ────────────────────────────────┘
```

### 1.1 Rotas e limites da borda

| Caminho               | Destino | Teto de corpo                 | Observação                                         |
| --------------------- | ------- | ----------------------------- | -------------------------------------------------- |
| `/api/public/*`       | worker-ssw | 64 MiB (`LIMITE_CORPO_PUBLICO_MB`) | integrações do SSW por segredo; arquivo em base64 (455 ~39 MB) |
| `/api/public/ranking/*` | api   | 1 MiB (`LIMITE_CORPO_API_MB`) | link público do ranking (é da API, não do worker-ssw) |
| `/api/*`              | api     | 1 MiB (`LIMITE_CORPO_API_MB`) | JSON; `Cache-Control: no-store` se a API não mandar |
| `/healthz`, `/readyz` | api     | —                             | monitoramento externo                              |
| `/metrics`, `/docs*`  | 404     | —                             | métricas só pela rede interna; swagger nunca       |
| resto                 | web     | 64 KiB                        | `/assets/*` 1 ano imutável; `index.html` `no-cache` |

**Teto da borda = `bodyLimit` de quem está atrás, nunca maior.** Medido: com a borda em 2 MiB e a
API em 1 MiB, um corpo de 1,5 MiB virava **502** — a API responde 413 e fecha a conexão no meio do
envio, e o Caddy perde o upstream. Com os tetos iguais a borda responde 413 sozinha. As rotas
públicas de arquivo do worker-ssw usam `bodyLimit: 64 * 1024 * 1024`; se ele mudar, muda o `.env`.

### 1.2 Tempos (de dentro para fora)

Consulta da API corta em `DB_TIMEOUT_CONSULTA_MS` = 30 s (mensagem "reduza o período") → borda espera
o cabeçalho da resposta até 60 s → corpo de upload pode levar até 5 min (`read_body`) e download até
5 min (`write`). Desligamento: a API termina as requisições e os jobs do ERP em andamento em até
25 s (`server.ts`; `stop_grace_period` 30 s); o job que não terminar volta para a fila do BullMQ.
Ações das telas de ingestão esperam o worker-ssw por 5 s (mais o `aguardarMs` de quem espera o
resultado: BI2 60 s, testar SSW 30 s; importar, aplicar e retomar/descartar ciclo, 55 s, abaixo dos
60 s da borda); sem resposta, "O worker do SSW não respondeu".

### 1.3 O que foi validado localmente (Docker Desktop, 10/11/2026)

Sem tocar banco real: `DATABASE_URL` apontando para `127.0.0.1:1` (recusa na hora). Rodada feita
com o worker ainda neste compose (antes do ADR 0012): refazer com a `erp-interna` e o worker-ssw.

- Build das 5 imagens; hadolint, shellcheck, actionlint, `caddy validate` e `caddy fmt` limpos;
  `docker compose config` ok.
- Pilha inteira `healthy` (caddy, web, 2× api, worker, redis); `/healthz` 200; `/readyz` 503
  "Dependência indisponível: banco." (o Redis com senha respondeu); `/metrics` e `/docs` 404;
  cabeçalhos de segurança e CSP presentes; asset com `immutable` e `zstd`; asset inexistente e
  `.map` 404; HTTP → HTTPS 308; corpo acima do teto 413.
- Redis: sem senha → `NOAUTH`; `noeviction` e AOF ativos; `DEBUG` desligado; nenhuma porta no host;
  rede interna sem saída para a internet; raiz somente leitura e `cap_drop: ALL` em tudo.
- `deploy.sh` sob carga, `deploy.sh voltar`, backup e restauração do Redis (§6.2, §7).

### 1.4 Rede `erp-interna` e o worker-ssw

Os dois compose (este e o do worker-ssw) se falam só pela rede Docker externa `erp-interna`, criada
uma vez na VPS antes do primeiro `up` de qualquer um deles (o `deploy.sh` recusa sem ela):

```bash
docker network create erp-interna
```

Nela ficam o caddy e a api do ERP e o worker-ssw (contêiner `worker-ssw`, porta 3003):

- borda → worker-ssw: `/api/public/*` (webhook SSW2181, `ftp-relatorio-import`,
  `ssw-ciclo-aplicar`, `xml-orfaos-retry`), em `WORKER_SSW_PUBLICO` (padrão `worker-ssw:3003`);
- api → worker-ssw: HTTP interno `/interno/v1/*` (execuções, situação e as operações manuais da
  Importação SSW) em `WORKER_SSW_URL` (ex.
  `http://worker-ssw:3003`), com `Authorization: Bearer <WORKER_SSW_TOKEN>`. O token é um dos
  `INTERNO_TOKENS` do worker-ssw: para girar, pôr o novo lá como `atual,anterior`, trocar aqui
  (`SEM_PULL=1 ./deploy.sh`) e só depois tirar o antigo de lá.

Sem `WORKER_SSW_URL`/`WORKER_SSW_TOKEN` a API sobe e as telas de ingestão leem o banco; as ações
(rodar FTP/BI2, testar SSW, reprocessar, retomar/descartar ciclo, importar, aplicar, pausar o
FTP, liberar a trava) respondem 503 "Integração com o worker do SSW não configurada". Com o worker-ssw fora do ar, as mesmas ações respondem 503 "O worker do SSW não
respondeu" e o resto do ERP segue. Worker-ssw em VPS separada: a `erp-interna` vira uma rede
privada entre as VPS (WireGuard ou a rede privada do provedor), nunca porta publicada.

## 2. Tamanho da VPS

**Recomendado: 4 vCPU, 8 GB de RAM, 80 GB SSD NVMe, Ubuntu 24.04 LTS, na mesma região do projeto
Supabase** (conferir em Dashboard → Settings → General; se for `sa-east-1`, VPS em São Paulo).
Mínimo para operar depois da virada: 2 vCPU / 4 GB, sem folga para pico nem para o migrador.

- **Região antes de tudo.** Cada requisição abre uma transação com `SET LOCAL` do contexto e faz
  uma ou mais consultas: são várias idas ao Postgres por tela. Na mesma região são 1–3 ms por ida;
  de outro continente, ~120 ms cada.
- **Memória** (limites do compose): api 2 × 768 MB + redis 512 MB + caddy 256 MB + web 128 MB
  ≈ 2,4 GB, mais o worker-ssw na mesma VPS (~1 GB + o Redis dele) ≈ 3,4 GB; o migrador da virada roda ao lado com até 2 GB; Docker e SO ~1 GB. Pico
  ≈ 6,5 GB → 8 GB. As listas detalhadas e as exportações montam JSON grande em memória (objeto +
  string + compressão) e o worker-ssw lê CSV de ~39 MB; é a memória que limita, não a CPU.
- **CPU**: a agregação pesada roda no Postgres. Na VPS gasta CPU o argon2id do login (proposital:
  dezenas de ms por tentativa), serializar JSON, TLS e compressão. 2 réplicas × 1,5 + worker-ssw 1
  + borda 1 cabem em 4 vCPU com folga.
- **Disco**: imagens (api ~300 MB, worker-ssw ~270 MB, web/caddy ~90 MB, migrador ~900 MB, sem
  compressão), 3 versões guardadas para rollback ≈ 5 GB; logs rotacionados (100 MB por contêiner);
  AOF do Redis (pequeno). 40 GB bastam; 80 GB é conforto.
- **Rede**: IPv4 público obrigatório (o pooler do Supabase é IPv4); IPv6 desejável (§4.1).
- **Crescer**: primeiro vertical (16 GB, `API_REPLICAS=3`), depois segunda VPS atrás de um
  balanceador — a API não guarda estado e o limite de taxa já está no Redis.

## 3. Endurecimento do host (uma vez)

Ubuntu 24.04 LTS. Como root na primeira sessão; depois só o usuário `deploy`.

```bash
# 3.1 Usuário sem root, só chave
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
install -m 600 -o deploy -g deploy /dev/stdin /home/deploy/.ssh/authorized_keys <<'EOF'
ssh-ed25519 AAAA... operador
EOF
passwd deploy   # senha só para o sudo; o SSH não aceita senha

cat >/etc/ssh/sshd_config.d/10-endurecido.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers deploy
MaxAuthTries 3
LoginGraceTime 20
X11Forwarding no
AllowTcpForwarding no
EOF
sshd -t && systemctl reload ssh
# Testar `ssh deploy@<ip>` NOUTRO terminal antes de fechar esta sessão.

# 3.2 Firewall: 22, 80, 443/tcp e 443/udp (HTTP/3)
apt-get update && apt-get install -y ufw fail2ban unattended-upgrades
ufw default deny incoming
ufw default allow outgoing
ufw limit 22/tcp            # melhor: ufw allow from <IP fixo de quem opera> to any port 22 proto tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw enable

# 3.3 fail2ban no SSH
cat >/etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban

# 3.4 Atualização automática de segurança (reinício de madrugada, se o kernel pedir)
dpkg-reconfigure -f noninteractive unattended-upgrades
cat >/etc/apt/apt.conf.d/52erp-reboot <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
EOF

# 3.5 Swap de 2 GB (amortece pico; não é memória de trabalho) e o que o Redis pede
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
cat >/etc/sysctl.d/90-erp.conf <<'EOF'
vm.swappiness=10
# Redis: o fork do BGSAVE/BGREWRITEAOF não falha por falta de memória "prometida".
vm.overcommit_memory=1
EOF
sysctl --system

# 3.6 Relógio certo (JWT tem validade: relógio torto = 401 aleatório)
timedatectl set-timezone America/Sao_Paulo
timedatectl set-ntp true
```

**Docker** do repositório oficial (não o `docker.io` do Ubuntu), com **userns-remap**:

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

cat >/etc/docker/daemon.json <<'EOF'
{
  "userns-remap": "default",
  "no-new-privileges": true,
  "live-restore": true,
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "5" }
}
EOF
systemctl restart docker
usermod -aG docker deploy
```

- **userns-remap, não rootless**: o root de dentro do contêiner vira usuário sem privilégio no host
  (as imagens já rodam sem root; isto é a segunda camada). O rootless esconde o IP real do cliente
  (rootlesskit), e o limite de taxa por IP viraria global.
- `live-restore`: atualizar o Docker não derruba os contêineres.
- Grupo `docker` equivale a root no host: só o `deploy` entra nele.
- **Docker ignora o ufw para porta publicada.** Por isso só o caddy publica porta. Nunca publicar
  porta de api, web, redis ou worker-ssw.

## 4. Banco (Postgres do Supabase, projeto DEVELOP)

Nunca o projeto de produção do sistema atual (`quyrhwmfbqikkpmiivuq`). Schema `erp`; o `public` é
do sistema atual e não se escreve nele.

### 4.1 Conexão: pooler, IPv4 e TLS

- A conexão direta (`db.<ref>.supabase.co:5432`) é **só IPv6** (sem o add-on de IPv4 pago).
  **Recomendado: pooler Supavisor em modo sessão**, IPv4, porta **5432** (host exato em
  Dashboard → Connect → Session pooler):
  `postgres://erp_app.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres`.
  O usuário leva o sufixo `.<ref>` do projeto. Modo sessão porque a conexão do `pg` manda
  `statement_timeout` e `application_name` como parâmetros de partida; o modo transação (6543)
  não é usado.
- Alternativa: IPv6 na VPS e no Docker (`"ipv6": true` + `fixed-cidr-v6` no `daemon.json`,
  `enable_ipv6: true` na rede `saida`) para a conexão direta. Mais peças móveis.
- **TLS verificado**: baixar o certificado CA do projeto (Dashboard → Database → SSL
  Configuration) para `infra/certs/supabase-ca.crt` (montado somente leitura em `/etc/erp/certs`)
  e terminar a URL com `?sslmode=verify-full&sslrootcert=/etc/erp/certs/supabase-ca.crt`.
- **Restrição de rede** (Dashboard → Database → Network Restrictions): liberar só o IPv4 da VPS e o
  de quem aplica SQL à mão. Ativar depois de listar quem conecta hoje, ou alguém fica trancado fora.
- **Orçamento de conexões**: `API_REPLICAS × API_DB_MAX_CONEXOES` + as do worker-ssw (o
  `DB_MAX_CONEXOES` do compose dele, papel `erp_worker`) (+1 do migrador) = 2 × 10 + 5 + 1 = 26 no
  padrão (worker-ssw com 5). Os dois sistemas somam no mesmo Postgres. Tem de caber no _Pool Size_ do pooler (Dashboard →
  Database → Connection pooling; depende do tamanho da instância) somado ao que o sistema atual já
  usa. Se não couber: subir o Pool Size ou baixar `API_DB_MAX_CONEXOES`. Deploy sem queda dobra as
  réplicas da API por alguns segundos: deixar folga de mais `API_REPLICAS × API_DB_MAX_CONEXOES`
  (as réplicas novas só abrem conexão quando atendem).
- Conferência: `/readyz` 200 depois do primeiro `up` (§6.1) prova DNS, TLS, papel e senha.

### 4.2 Papéis (uma vez, pelo DBA)

`packages/db/bootstrap/papeis.sql` cria `erp_migracao` (dono do schema `erp`; roda migrations e
seeds), `erp_app` (API; sem BYPASSRLS, só DML) e `erp_worker` (worker-ssw; sem BYPASSRLS, sem
herdar papel, só o GRANT mínimo das tabelas da ingestão e do que ela grava). As permissões vêm das
migrations: `erp_app` em `0002_permissoes_app.sql`, `erp_worker` em `0008_worker_ssw.sql` (que
também põe o `erp_worker` nas policies de RLS). Banco que já tinha os papéis antes do ADR 0012:
rodar só `create role erp_worker login nobypassrls noinherit;` **antes** da migration 0008 (sem o
papel ela falha).

```bash
# De uma máquina confiável, com o papel postgres (conexão direta ou pooler em modo sessão):
psql "postgres://postgres.<ref>@aws-0-<regiao>.pooler.supabase.com:5432/postgres?sslmode=verify-full&sslrootcert=supabase-ca.crt" \
  -f packages/db/bootstrap/papeis.sql
psql "<mesma URL>" -c '\password erp_migracao'
psql "<mesma URL>" -c '\password erp_app'
psql "<mesma URL>" -c '\password erp_worker'   # vai para o .env do worker-ssw, não para este
```

`\password` calcula o hash no cliente: a senha não passa em texto pelo log de SQL (não usar o SQL
Editor do Dashboard para isso). Senhas longas e aleatórias (`openssl rand -hex 32`), guardadas no
gerenciador de senhas e no `infra/.env`.

### 4.3 Migrations e catálogo (papel `erp_migracao`)

Rodam da VPS, com a imagem `erp-migrador` da mesma tag da API. Só o migrador recebe
`DATABASE_URL_MIGRACAO`; a API e o worker-ssw nunca. Mudança de schema que o worker-ssw use:
migration aqui primeiro (expandir), deploy do worker-ssw depois, contrair num deploy seguinte.

```bash
cd ~/erp/infra
docker compose run --rm migrador migrar   # drizzle-kit migrate (tabela drizzle.migracoes_erp)
docker compose run --rm migrador semear   # catálogo global (telas, módulos), idempotente
```

Em deploy com migration: `./deploy.sh --migrar` roda o `migrar` da versão nova **antes** de
trocar a API. A migration tem de ser compatível com a versão que ainda está no ar (expandir antes,
contrair num deploy seguinte): as réplicas antigas continuam atendendo até as novas ficarem
saudáveis.

## 5. Chaves e segredos

Todos ficam só no `infra/.env` da VPS (dono `deploy`, `chmod 600`) e numa cópia no gerenciador de
senhas. Nenhum vai para imagem, git ou GitHub. Variáveis de ambiente aparecem no `docker inspect`:
quem tem acesso ao Docker tem acesso a tudo (por isso o grupo `docker` é só do `deploy`).

### 5.1 JWT (EdDSA / Ed25519)

```bash
openssl genpkey -algorithm ed25519 -out jwt-2026-11.pem
# Uma linha com \n literal, para o .env (aspas simples):
printf "JWT_CHAVE_PRIVADA='%s'\n" "$(awk 'NF{printf "%s\\n",$0}' jwt-2026-11.pem)"
openssl pkey -in jwt-2026-11.pem -pubout -out jwt-2026-11.pub.pem   # pública, para a rotação
shred -u jwt-2026-11.pem   # depois de copiar para o .env e o gerenciador de senhas
```

`JWT_KID=2026-11` (identifica a chave no cabeçalho do token).

**Rotação planejada** (ex.: a cada 6 meses): gerar o par novo; no `.env`, trocar
`JWT_CHAVE_PRIVADA` e `JWT_KID` pelos novos e pôr a pública antiga em
`JWT_CHAVES_ANTERIORES='{"2026-11":"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"}'`;
`SEM_PULL=1 ./deploy.sh`. Depois de 15 min (vida do access token) a antiga pode sair do `.env`
no próximo deploy. O refresh token é opaco (no banco) e não depende da chave.

**Vazamento**: trocar sem manter a anterior. Todo access token em uso vira 401, e o front renova
sozinho pelo cookie de refresh (`apps/web/src/lib/api.ts`): ninguém precisa entrar de novo. Se o
vazamento for do banco (sessões), revogar as sessões lá.

### 5.2 `COOKIE_SEGREDO` e `REDIS_SENHA`

- `COOKIE_SEGREDO`: `openssl rand -base64 48`. Assina só o cookie de passagem do login pelo Google;
  trocar derruba apenas quem estiver no meio desse login.
- `REDIS_SENHA`: `openssl rand -hex 32` (hex porque vai dentro da URL `redis://`). Trocar: editar o
  `.env`, `docker compose up -d redis` e `SEM_PULL=1 ./deploy.sh`. O Redis reinicia (segundos),
  então fazer fora do horário.

### 5.3 Chave mestra dos segredos de integração (AES-256-GCM)

Senha do SFTP, token do SSW etc. ficam no banco cifrados pela aplicação
(`packages/db/src/segredos.ts`), com chave versionada. As variáveis (`SEGREDOS_CHAVES`,
`SEGREDOS_CHAVE_ATUAL`) vão no `.env` da API (que cifra ao cadastrar a integração) e, **com o mesmo
valor**, no do worker-ssw (que decifra para falar com FTP, SSW e BI2).

```bash
echo "SEGREDOS_CHAVES=1:$(openssl rand -base64 32)"   # 32 bytes aleatórios em base64
echo "SEGREDOS_CHAVE_ATUAL=1"
```

**Rotação**: acrescentar a nova (`SEGREDOS_CHAVES=1:<antiga>,2:<nova>`), `SEGREDOS_CHAVE_ATUAL=2`,
`SEM_PULL=1 ./deploy.sh` e o mesmo par no worker-ssw (deploy dele): gravação nova sai com a 2,
leitura usa a versão da linha. Pedir o job de recifrar
(`docker compose run --rm --no-deps api dist/server.js --recifrar-segredos`: só enfileira; uma
réplica da API no ar com `JOBS_LIGADOS=true` regrava cada segredo, e o segredo anterior do webhook,
com a chave atual e loga "segredos recifrados com a chave atual" com o total e as falhas). Só
remover a `1:` (aqui e no worker-ssw) quando o log disser `falhas: []` e nenhuma linha estiver mais
na versão 1.

**Nunca perder a chave**: sem ela os segredos do banco não decifram (recadastrar integração por
integração). Guardar no gerenciador de senhas, **separada** do backup do banco: backup + chave
juntos equivalem aos segredos em texto.

## 6. Deploy

### 6.1 Primeiro deploy

Pré-requisitos (§13): VPS endurecida (§3), DNS do domínio apontando para ela, papéis do banco
criados (§4.2), rede `erp-interna` criada (§1.4).

```bash
git clone https://github.com/matheuscrvlh-scaleia/erp-ssw.git ~/erp
cd ~/erp/infra
cp .env.example .env && chmod 600 .env
$EDITOR .env      # §4 e §5; AGENDAMENTOS_LIGADOS=false;
                  # WORKER_SSW_URL/WORKER_SSW_TOKEN quando o worker-ssw estiver no ar (§1.4)
# CA do Supabase em certs/supabase-ca.crt (§4.1)

docker compose config --quiet              # falha se faltar variável obrigatória
docker compose --profile ferramentas build # web, api, caddy e migrador, a partir do código
docker compose run --rm migrador migrar    # §4.3
docker compose run --rm migrador semear
docker compose up -d
docker compose ps                          # todos (healthy) em ~40 s
curl -fsS https://<dominio>/healthz        # {"status":"ok"}
curl -fsS https://<dominio>/readyz         # {"status":"pronto"}
```

Depois: conferir os cabeçalhos (`curl -sI https://<dominio>/`, securityheaders.com, ssllabs.com),
abrir o sistema com o console do navegador aberto (nenhuma violação de CSP, §6.5) e, se usar
Google, cadastrar `https://<dominio>/api/v1/auth/google/retorno` no Google Cloud Console.

Fase lado a lado: subdomínio próprio (ex.: `novo.<dominio>`), API com
`AGENDAMENTOS_LIGADOS=false`, worker-ssw com a ingestão desligada (não ingere nada; ver o runbook
dele), o sistema atual seguindo no domínio de hoje.

### 6.2 Deploy sem queda

Na VPS:

```bash
~/erp/infra/deploy.sh               # git pull + build + troca; ou: ./deploy.sh --migrar
```

O `deploy.sh` faz `git pull --ff-only`, monta as imagens (`erp-*:local`) e, para web e depois api: sobe réplicas novas ao lado das antigas, espera o
HEALTHCHECK de todas (até 180 s) e só então manda SIGTERM nas antigas, que terminam o que estão
atendendo. O Caddy enxerga as réplicas pelo DNS interno do Docker (relido a cada 5 s) e refaz em
outra réplica a requisição que bater em porta fechada (`lb_try_duration`). Se as novas não ficarem
saudáveis, o script as remove e para — as antigas nunca saíram. Os jobs do ERP rodam nas
réplicas da API: a antiga devolve à fila o job interrompido e uma nova o retoma. Depois recarrega o
Caddyfile e grava o commit em `infra/.deploy-historico`.

Mudou só o `.env` (segredo novo, limite)? `SEM_PULL=1 ./infra/deploy.sh`: as réplicas novas nascem
com o ambiente novo.

Cuidado: durante a troca do web convivem por segundos duas versões; uma aba que pegar o
`index.html` novo e pedir um asset à réplica velha recebe 404 (nunca `index.html` no lugar de JS) e
o app pede recarga.

### 6.3 Atualizar a borda (Caddy)

- **Só o `Caddyfile`**: `docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile` —
  sem queda (o `deploy.sh` já faz).
- **Imagem do caddy mudou (`infra/docker/caddy.Dockerfile`) ou variável dele no `.env`**: o
  `deploy.sh` recria o contêiner, alguns
  segundos sem atender. Fazer fora do horário: `docker compose up -d caddy`.

### 6.4 Rollback

```bash
cd ~/erp/infra
tail -5 .deploy-historico             # "<data> <commit no ar> <- <commit anterior>"
git -C .. checkout <commit-anterior>
SEM_PULL=1 ./deploy.sh                # monta e troca sem queda com o código desse commit
git -C .. checkout main               # depois de corrigir, volta à main e ./deploy.sh
```

O banco **não** volta junto: se a versão nova trouxe migration, conferir se a anterior convive com
ela (por isso migrations em duas etapas, §4.3).

### 6.5 CSP quebrando uma tela

Sintoma: tela em branco ou recurso que não carrega, com "Refused to ..." no console. Mitigação
imediata: `CSP_CABECALHO=Content-Security-Policy-Report-Only` no `.env` + `docker compose up -d
caddy` (§6.3); a política passa a só avisar. Corrigir a diretiva em `infra/Caddyfile` e voltar para
`Content-Security-Policy`. Logos das empresas: `LOGO_ORIGEM` = origem de `LOGO_URL_BASE`.

## 7. Backups

| O quê                               | Onde                     | Como / frequência                                      |
| ----------------------------------- | ------------------------ | ------------------------------------------------------ |
| `infra/.env` (segredos, chaves)     | gerenciador de senhas    | a cada mudança; chave AES separada do backup do banco  |
| Redis (`redis_dados`)               | fora da VPS, cifrado     | diário, abaixo                                         |
| certificados (`caddy_dados`)        | fora da VPS, cifrado     | semanal, abaixo                                        |
| `infra/.deploy-historico`           | junto dos anteriores     | idem                                                   |
| banco                               | Supabase                 | backups/PITR do próprio Supabase (fora desta VPS)      |

**Redis** guarda filas e agendamentos do BullMQ, histórico de jobs e contadores de limite/bloqueio
de login. Perder o Redis = perder os jobs que estavam na fila (os agendamentos se recriam no boot da
API a partir do banco); não perde dado de negócio. Por isso backup diário com 7 dias basta.
**Certificados**: regeneram sozinhos, mas o Let's Encrypt limita emissões repetidas (5 por semana
para o mesmo nome) — perder o volume num dia de incidente pode deixar o site sem HTTPS.

```bash
# /etc/cron.daily/erp-backup (root, chmod 700)
set -eu
cd /home/deploy/erp/infra
destino=/var/backups/erp && install -d -m 700 "$destino"
# Redis: snapshot consistente pelo próprio servidor (não copia arquivo em escrita).
docker compose exec -T redis sh -c 'REDISCLI_AUTH="$REDIS_SENHA" redis-cli --rdb /data/backup.rdb' >/dev/null
docker compose cp redis:/data/backup.rdb "$destino/redis-$(date +%F).rdb"
# Certificados (semanal basta; diário não custa nada).
docker run --rm -v erp_caddy_dados:/d:ro -v "$destino":/b alpine:3 \
  tar czf "/b/caddy-dados-$(date +%F).tgz" -C /d .
cp .deploy-historico "$destino/" 2>/dev/null || true
find "$destino" -name 'redis-*.rdb' -mtime +7 -delete
find "$destino" -name 'caddy-dados-*.tgz' -mtime +35 -delete
# e mandar $destino para fora (restic/rclone cifrado para um bucket do dono)
```

**Restaurar o Redis** (testado localmente). Atenção: com `appendonly yes` e sem AOF no volume, o
Redis 7.4 **ignora** o `dump.rdb` e sobe vazio (medido). Por isso a primeira subida é sem AOF, e o
AOF é ligado a quente, gerado a partir do que foi carregado:

```bash
cd ~/erp/infra
docker compose stop api redis
docker run --rm -v erp_redis_dados:/d -v /var/backups/erp:/b:ro alpine:3 \
  sh -c 'rm -rf /d/appendonlydir /d/dump.rdb && cp /b/redis-<data>.rdb /d/dump.rdb && chown 999:1000 /d/dump.rdb'
docker compose run -d --name redis-restauro redis \
  sh -c 'exec redis-server /usr/local/etc/redis/redis.conf --requirepass "$REDIS_SENHA" --appendonly no'
docker exec redis-restauro sh -c 'export REDISCLI_AUTH="$REDIS_SENHA"; redis-cli dbsize; redis-cli config set appendonly yes'
docker exec redis-restauro sh -c 'REDISCLI_AUTH="$REDIS_SENHA" redis-cli info persistence' | grep aof_rewrite_in_progress   # esperar :0
docker stop redis-restauro && docker rm redis-restauro
docker compose up -d redis && SEM_PULL=1 ./deploy.sh
```

Recuperação de desastre (VPS perdida): nova VPS → §3 → `.env` do gerenciador de senhas → restaurar
os volumes → §6.1 com a última tag do histórico (sem `migrar`: o banco não mudou). 30–60 min,
quase tudo no §3.

## 8. Logs

- Todos os contêineres logam **JSON no stdout** (pino na API); o Docker guarda com
  rotação (20 MB × 5 por contêiner, no compose e no `daemon.json`): alguns dias de histórico.
- Segredo fora do log: a borda omite `Authorization`/`Cookie`, apaga os cabeçalhos de segredo das
  rotas públicas (`X-Ftp-Ingest-Secret`, `X-Ingest-Secret`, `X-Cron-Token`, `Apikey`) e troca
  `secret`, `token`, `senha`, `code`, `state`... da query por `***` (as rotas públicas do SSW
  passam pela borda antes do worker-ssw); a API mascara `*.senha`, `*.token`, `*.segredo`.

```bash
cd ~/erp/infra
docker compose logs -f --since 10m api
docker compose logs --since 1h caddy | grep '"status":5'              # 5xx da borda
docker compose logs --since 1h api | grep -E '"level":(50|60)'        # erros (pino)
docker compose logs --since 1h api | grep -E 'job falhou|worker-ssw não respondeu'
docker compose logs --no-log-prefix --since 1h caddy \
  | jq -r 'select(.msg=="handled request") | [.status, .duration, .request.uri] | @tsv' \
  | sort -k2 -nr | head                                                # requisições mais lentas
```

LGPD: log tem IP e id de usuário; não estender a retenção sem motivo. Histórico longo e busca:
Grafana Alloy lendo os logs do Docker para Loki/Grafana Cloud ou Better Stack — fora desta VPS.

## 9. Monitoramento e métricas

De fora da VPS (UptimeRobot, Better Stack, Healthchecks.io):

| Verificação                         | Frequência | Alerta            | Significa                                   |
| ----------------------------------- | ---------- | ----------------- | ------------------------------------------- |
| `GET https://<dominio>/healthz`     | 1 min      | 2 falhas seguidas | API ou borda fora                           |
| `GET https://<dominio>/readyz`      | 5 min      | 2 falhas seguidas | API não alcança o Postgres ou o Redis        |
| `GET https://<dominio>/login` 200   | 5 min      | 2 falhas          | web fora                                    |
| validade do certificado             | diária     | < 14 dias         | renovação automática falhou                 |

Na VPS: `docker compose ps` mostra `unhealthy` (com `JOBS_LIGADOS`, o `/readyz` da API falha se um
Worker do BullMQ parar; o Docker não reinicia contêiner `unhealthy` sozinho — o alerta é o log ou
o agente abaixo). O worker-ssw tem monitoramento próprio (`/saude/*` e `/metrics` dele). Alerta de disco > 80% (o provedor costuma oferecer).

**Métricas Prometheus** (`/metrics` da API: padrão do Node + `http_requisicao_duracao_segundos`):
existem só com `METRICAS_TOKEN` no `.env` e só pela rede interna (a borda devolve 404). Para
coletar, um agente (Grafana Alloy ou Prometheus em modo agent) num contêiner ligado à rede
`erp_interna`, mandando para fora (Grafana Cloud):

```yaml
scrape_configs:
  - job_name: erp-api
    authorization: { credentials_file: /run/secrets/metricas_token }
    dns_sd_configs: [{ names: [api], type: A, port: 3001 }] # uma série por réplica
```

Vale alertar também: memória do Redis (`INFO memory`, `used_memory` > 80% de `maxmemory`: com
`noeviction`, no teto o Redis recusa escrita e jobs/login falham) e fila crescendo sem parar.

## 10. Virada (sistema atual → ERP SSW)

Antes: fase lado a lado (§6.1) com os roteiros de paridade de tela aprovados, migrador de dados
ensaiado contra o DEVELOP com tempo medido, TTL do DNS em 300 s na semana da virada, aviso aos
usuários da janela.

0. **worker-ssw no ar antes**: subido pelo runbook dele, na `erp-interna` (§1.4), com a ingestão
   ainda desligada, `/saude/pronto` ok e o contrato do schema aceito no boot. No `.env` daqui,
   `WORKER_SSW_URL`/`WORKER_SSW_TOKEN` e `SEM_PULL=1 ./deploy.sh`; Plataforma › Diagnóstico SSW
   mostra a situação dos jobs vinda do worker-ssw.
1. **Congelar o atual**: desligar a ingestão do sistema atual (crons e funções que puxam FTP/BI2/
   SSW) para não processar duas vezes. Usuários fora (janela combinada).
2. **Ponto de restauração**: conferir o backup/PITR do Supabase do momento.
3. **Migrar**: `docker compose run --rm migrador migrar`, `semear` e
   `docker compose run --rm migrador dados` (§12). Conferir o relatório do migrador (contagens por
   tabela e empresa) contra o atual. Depois, no worker-ssw, `reconstruir-projecoes` por empresa
   (as projeções do Romaneio são dele; o relatório do migrador lembra).
4. **Ligar a ingestão e os agendamentos**: no worker-ssw, ligar a ingestão (runbook dele) e
   acompanhar o primeiro ciclo de cada uma; aqui, `AGENDAMENTOS_LIGADOS=true` no `.env` →
   `SEM_PULL=1 ./deploy.sh` (jobs do ERP: limpar sessões, prazos configurados). No log da API,
   "agendamentos" por fila; `job falhou` = parar e olhar.
5. **Trocar o DNS**: registro A/AAAA do domínio de hoje para o IP da VPS. Em seguida, no `.env`,
   `DOMINIO=<domínio de hoje>` (e `GOOGLE_REDIRECT_URI`, se usar Google), `docker compose up -d
   caddy` e `SEM_PULL=1 ./deploy.sh` (a API passa a usar o `WEB_URL` novo nos e-mails e no CORS).
   O Caddy emite o certificado assim que o DNS responde com o IP da VPS (segundos). URLs, telas e
   rotas públicas (`/api/public/*`, webhook do SSW, agora atendidas pelo worker-ssw atrás da
   mesma borda) são as mesmas: integrações externas não mudam. Antes, em Plataforma → Empresa →
   Integrações, cadastrar e ligar "Rotas públicas da ingestão" com o mesmo valor do
   `FTP_INGEST_SECRET` de hoje (ADR 0010); sem isso as rotas respondem 503.
6. **Conferir**: login de usuários reais (senha antiga validada e regravada em argon2id),
   `/readyz`, telas principais, logs sem 5xx, primeiros jobs ok.

**Voltar** (se algo grave aparecer): DNS de volta para o sistema atual (até 5 min com TTL 300 s),
desligar a ingestão do worker-ssw, `AGENDAMENTOS_LIGADOS=false` + `SEM_PULL=1 ./deploy.sh` na
VPS, religar a ingestão do atual. O que
entrou só no ERP SSW durante a janela (cadastros, ajustes feitos por usuários) não volta sozinho:
anotar e refazer no atual. Por isso a janela de decisão é curta (mesmo dia).

## 11. Manutenção

- **Imagens base fixadas por digest** (`oven/bun`, distroless `nodejs22`, `node:22-trixie-slim`,
  `caddy`, `redis`): para atualizar, `docker pull <imagem>:<tag>`, pegar o digest
  (`docker image inspect --format '{{index .RepoDigests 0}}'`), trocar tag + digest juntos e deixar
  o CI (Trivy) validar. Mesma regra do `bunfig.toml`: nada publicado há menos de 24 h. Mesmo cuidado
  com as actions e imagens de ferramenta dos workflows (fixadas por SHA/digest).
- **Exceções do Trivy** (`infra/.trivyignore.yaml`): toda exceção com motivo e `expired_at`; quando
  vence, o CI volta a falhar de propósito.
- **Limpeza** (mensal): `docker image prune -a --filter until=720h` (mantém o último mês para
  rollback).
- **Node**: imagens em Node 22 LTS (o `engines` e o `target` do esbuild também). Trocar de LTS =
  base das imagens, `NODE_VERSION` do CI e `target` dos `build.mjs` juntos.

## 12. Contrato do `apps/migrador`

A imagem `erp-migrador` (`infra/docker/migrador.Dockerfile`) já existe e espera:

1. pacote em `apps/migrador` (workspace do bun); entrada `src/main.ts` (rodada com `tsx`) ou, se o
   `package.json` tiver script `build`, `dist/main.js` (preferido);
2. configuração só por variável de ambiente, validada no boot: `DATABASE_URL_MIGRACAO` já chega
   pelo compose; variáveis próprias vão em `infra/migrador.env` (opcional, fora do git);
3. idempotente (pode rodar de novo depois de uma falha) e com relatório de conferência no stdout;
4. arquivo temporário só em `/tmp` (tmpfs de 256 MB; o resto é somente leitura); memória até 2 GB.

`docker compose run --rm migrador dados [args]` repassa os argumentos.

O migrador não grava as projeções do Romaneio (`romaneio_*`, `cte_dados_relatorios`): são do
worker-ssw. Na virada, depois do `dados`, roda o `reconstruir-projecoes` do worker-ssw por empresa
(§10, passo 3); o relatório do migrador traz o lembrete como passo final.

## 13. O que o dono precisa providenciar

1. **VPS**: 4 vCPU / 8 GB / 80 GB NVMe, Ubuntu 24.04, IPv4 público (IPv6 se der), na região do
   projeto Supabase.
2. **Domínio/DNS**: registro A (e AAAA) do subdomínio da fase lado a lado apontando para a VPS
   antes do primeiro `up`; acesso ao DNS do domínio de hoje para a virada (TTL 300 s na semana).
3. **E-mail da conta ACME** (avisos do Let's Encrypt).
4. **SMTP** de envio (host, porta, usuário, senha, remetente) para convite e "esqueci minha senha".
5. **Supabase DEVELOP**: senha do `postgres` para o DBA criar os papéis (§4.2), certificado CA,
   Pool Size adequado (§4.1) e liberação do IP da VPS em Network Restrictions.
6. **Repositório no GitHub** (`matheuscrvlh-scaleia/erp-ssw`): a VPS faz `git clone`/`git pull`
   dele (repositório público, sem token).
7. Opcional: Google OAuth (client id/secret), bucket S3 dos logos (`LOGO_URL_BASE`/`LOGO_ORIGEM`),
   monitor externo (§9) e destino do backup fora da VPS (§7).
8. Gerenciador de senhas para o `infra/.env` e as chaves (§5).
