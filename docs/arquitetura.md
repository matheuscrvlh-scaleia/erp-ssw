# ERP SSW — arquitetura

Sistema novo que substitui o painel BI da FR Transportes (repo `fr-transportes`). Código 100% novo.
O usuário final não pode perceber diferença: mesmas telas, mesmos números, mesmos filtros, mesmas
URLs, mesmas exportações, mesmo login e senha. Muda a engenharia por trás.

## Decisões do dono (10/11/2026)

1. **Front + back têm toda a lógica.** Regra de negócio mora no backend (TypeScript).
2. **O banco só guarda dados.** Sem funções, gatilhos, views materializadas, `pg_cron`, `pg_net`,
   Vault ou Auth do banco. A única lógica no banco é **RLS** (políticas declarativas que leem
   `current_setting(...)`), como defesa em profundidade.
3. **Login, sessão e permissão são do backend + front.** Senhas atuais migradas sem o usuário
   perceber (hash bcrypt de hoje validado no 1º login e regravado em argon2id).
4. **Banco: Postgres do Supabase, projeto DEVELOP** (`vyockehhhvomqcjqnuwb`), usado como Postgres
   comum. Schema novo próprio (`erp`), sem tocar no `public` legado.
5. Base funcional = versão multiempresa (empresas, módulos por empresa, Plataforma, logs).
6. Nada de código morto: só entra o que alguma tela, rota pública ou job usa hoje.

## Referências do sistema atual (só leitura)

- Código: `C:\Users\Matheus Carvalho\Desktop\repos\fr-transportes` — a versão mais completa está
  em `.claude\worktrees\agent-ae0264d9f8203d8fa` (branch `feat/multiempresa`, com F0–F6). Telas em
  `src/routes`, `src/features/*/components`; servidor em `src/features/**/*.functions.ts`.
- Banco: `C:\Users\Matheus Carvalho\Desktop\erp-ssw-referencia\banco\` — `schema-public.sql`
  (estrutura completa do DEVELOP), `funcoes/*.sql` (as 217 funções, uma por arquivo, definição real),
  `tabelas-tamanho.txt`.
- Regras de negócio decididas com o cliente: `fr-transportes/docs/decisoes/*.md`.
- Mapa de telas e chamadas: `fr-transportes` (branch `feat/vps`) `docs/vps/paridade.md`.
- Especificação extraída para este projeto: `docs/regras/*.md` (fonte da verdade para portar).

## Stack

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Monorepo | bun workspaces | já é a ferramenta do time; rápido |
| Web | Vite + React 19 + TS strict + Tailwind 4 + shadcn/Radix + TanStack Router + TanStack Query + react-hook-form | SPA simples de servir; roteamento tipado; cache de dados |
| API | Node 22 LTS + Fastify 5 + TS strict + Zod 4 (`fastify-type-provider-zod`) | rápido, schema-first, ecossistema maduro |
| Banco | Postgres (Supabase DEVELOP) + **Drizzle ORM** + `pg` | schema como código, migrations versionadas, SQL tipado, RLS declarado |
| Jobs | **BullMQ + Redis**, dentro do processo da API (`JOBS_LIGADOS`) | padrão de mercado; agendamento repetível, retry, concorrência por fila; os jobs do ERP são poucos e leves |
| Auth | argon2id (`@node-rs/argon2`), JWT de acesso curto (`jose`, EdDSA), refresh opaco rotativo em cookie httpOnly | padrão OWASP; sessão revogável |
| Arquivos | S3 compatível (`@aws-sdk/client-s3`) | logo da empresa; troca de provedor sem código |
| Segredos de integração | AES-256-GCM no backend (chave mestra por env, rotação por versão) | sem Vault do banco |
| Observabilidade | pino (JSON), `/healthz`, `/readyz`, métricas Prometheus | 12-factor, SRE |
| Testes | vitest (unidade das regras de domínio e casos de uso) | regra no TS precisa de teste no TS |

## Estrutura

```
apps/
  web/                    SPA
  api/                    HTTP (Fastify) + jobs do ERP no BullMQ (src/jobs: limpar sessões, prazos
                          configurados, classificação de códigos, recifrar segredos)
  migrador/               carga única public → erp
packages/
  config/                 tsconfig, eslint, prettier
  shared/                 contratos zod (entrada/saída de cada endpoint), tipos, permissões, formatação
  dominio/                regras de negócio PURAS (sem I/O): prazo, ocorrência efetiva, finalizadores,
                          atraso, gravação do CT-e, performance, romaneio, ranking, bonificação,
                          leitores dos relatórios SSW (prévia da importação e migrador)...
  db/                     Drizzle: schema, migrations, políticas RLS, client com contexto de empresa
docs/
  arquitetura.md          este arquivo
  regras/                 especificação das regras extraídas do sistema atual
  adr/                    decisões
```

### Camadas dentro de `apps/api/src/modulos/<dominio>/`

```
rotas.ts          HTTP: valida (zod do shared), chama caso de uso, serializa. Sem SQL, sem regra.
casos-de-uso.ts   orquestra: permissão de negócio, transação, chama domínio e repositório.
repositorio.ts    acesso a dados (Drizzle). Consultas set-based; nenhuma regra de negócio escondida.
*.test.ts         testes dos casos de uso com repositório falso.
```

Regras puras (cálculos) ficam em `packages/dominio` e são usadas pela API, pela web e pelo
migrador. O worker-ssw leva a sua cópia do núcleo do CT-e (ADR 0012).

## Ingestão do SSW: o worker-ssw (ADR 0012)

A ingestão (FTP, BI2, webhook SSW2181, XML CT-e, aplicação dos ciclos, projeções do Romaneio,
SLA pelos arquivos, coletas do 050 pelo FTP) é um sistema separado, o **worker-ssw**, com Redis,
compose e deploy próprios, que grava no mesmo schema `erp` com o papel `erp_worker` (GRANT mínimo,
RLS valendo). O ERP:

- **lê** o estado da ingestão direto do banco nas telas de Plataforma (Importação SSW, XML CT-e,
  Diagnóstico SSW, integrações) e em `GET /api/v1/ssw/atualizacao`/`saude`;
- **pede ações** ao worker-ssw pelo HTTP interno (`/interno/v1/*`, `WORKER_SSW_URL` +
  `WORKER_SSW_TOKEN`): rodar FTP/BI2, testar a SSW API, reprocessar webhook e XML órfãos,
  projeções depois de descartar um ciclo, situação dos jobs. A auditoria de quem pediu é gravada
  **antes** do pedido. Sem a configuração, as ações respondem 503 e as leituras seguem;
- cadastra as integrações (`empresa_integracoes`, cifradas): o ERP grava, o worker-ssw lê, com as
  mesmas `SEGREDOS_CHAVES`.

A borda do ERP encaminha `/api/public/*` (menos o link público do ranking) ao worker-ssw pela rede
Docker `erp-interna`: as URLs das integrações externas não mudam (docs/deploy.md §1.4).

**Agregação pesada** (ex.: performance de 250 mil CT-e) é feita por consulta SQL montada no backend
(Drizzle/`sql` parametrizado), com a regra expressa em TypeScript: o backend decide o que filtrar,
agrupar e calcular; o banco só executa a consulta. Nada de função armazenada.

**O que hoje é gatilho, matview ou cron** vira:
- valor calculado e gravado pelo caso de uso no momento da escrita (ex.: `fora_universo`, prazo);
- tabela de leitura (projeção) mantida pelo worker-ssw (ex.: romaneio por viagem, placa por
  motorista);
- job agendado no BullMQ: os do ERP na API (ex.: limpar sessões, prazos configurados), os da
  ingestão no worker-ssw (ex.: sincronização FTP, BI2, heartbeat SSW).

## Multiempresa e segurança

- Toda tabela de dado de cliente tem `empresa_id uuid not null`.
- O backend conecta com um papel **sem BYPASSRLS** (`erp_app`; o worker-ssw com `erp_worker`, também
  sem BYPASSRLS e com GRANT só no que a ingestão usa). Cada requisição roda numa transação
  que faz `SET LOCAL app.empresa_id`, `app.usuario_id` e `app.plataforma` (on/off). As políticas RLS
  são `empresa_id = current_setting('app.empresa_id')::uuid` (+ exceção para plataforma onde fizer
  sentido). Sem contexto ⇒ nenhuma linha.
- Migrations rodam com outro papel (`erp_migracao`), nunca o do app.
- Autorização no backend: guards por papel na empresa (`empresa_usuarios.papel`), por tela
  (permissões do cargo/departamento + exceções do usuário), por módulo liberado e por admin de
  plataforma. RLS é a segunda barreira, não a primeira.
- Auth: login com e-mail + senha (rate limit + bloqueio progressivo), Google OAuth opcional por env,
  recuperação de senha por e-mail (SMTP), access token 15 min em memória no front, refresh token
  opaco rotativo (cookie `httpOnly`, `Secure`, `SameSite=Strict`, hash no banco, detecção de reuso),
  logout revoga a família. Troca de empresa ativa reemite o token.
- OWASP ASVS / API Top 10: validação zod em toda entrada, sem SQL concatenado, erros sem detalhe
  interno, CORS restrito, helmet, rate limit, limite de corpo por rota, segredos nunca em log.
- Auditoria (quem mudou o quê) gravada pelo caso de uso, na mesma transação.

## Convenções

- TypeScript `strict` + `noUncheckedIndexedAccess`; sem `any`; sem `as` para calar o compilador.
- **Português** no domínio, rotas, mensagens e comentários (`ctrc`, `romaneio`, `ocorrencia`,
  `listarCtrcs`). Mensagem de erro fala com o operador ("reduza o período...").
- Rotas REST: `/api/v1/<dominio>/<recurso>`; rotas públicas de integração em `/api/public/*` com os
  mesmos caminhos de hoje e segredo por header (as do SSW atendidas pelo worker-ssw; o link público
  do ranking pela API).
- Funções pequenas, nomes que dizem a intenção, sem efeito colateral escondido; injeção de
  dependência pela composição em `app.ts` (sem container mágico).
- Toda regra portada de uma função SQL cita a origem num comentário curto
  (`// origem: calcular_performance (sistema atual)`) e tem teste com os casos-limite da spec.
- Sem código morto, sem `_v2/_v3`, sem flag para comportamento antigo.
- Prettier: `printWidth 100`, aspas duplas, ponto e vírgula, `trailingComma all`. LF.
- Dependência nova: estável, mantida, mais de 24 h publicada (`bunfig.toml`).

## Ondas

| Onda | Entrega |
| --- | --- |
| 0 | Especificação das regras (`docs/regras/`); fundação (monorepo, api, web, worker, auth, contexto de empresa, RLS); schema de domínio |
| 1 | Domínios em paralelo: performance/ctrc, romaneio/prazo, ocorrências/comprovantes/coletas/histórico/calendário, ranking/bonificação/ahgora, admin/plataforma/auditoria/exportação |
| 2 | Ingestão (SSW/BI2/FTP/XML/webhook) — hoje no worker-ssw (ADR 0012); migrador de dados `public` → `erp`; infra (Docker/Caddy/CI) |
| 3 | Revisão de segurança e de código; consolidação |
