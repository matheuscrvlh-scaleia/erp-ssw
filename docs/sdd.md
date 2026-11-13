# SDD — ERP SSW

- Situação: rascunho para avaliação do dono (12/11/2026)
- Requisitos: `docs/prd.md`. Regras de negócio: `docs/regras/`. Decisões: `docs/adr/`. Passo a
  passo para portar um domínio: `docs/molde.md`.
- Este documento resume e liga; quando divergir de `docs/arquitetura.md` ou de um ADR, valem eles.

## 1. Visão geral

```
navegador ──HTTPS──▶ proxy da VPS ──▶ web (Caddy :80, host 8081)
                                        ├─ SPA estática (React)
                                        ├─ /api/public/*  ──▶ worker-ssw (worker.ssw.scaleia.ai)
                                        └─ /api/*         ──▶ api (Fastify :3000, host 3001)
                                                                ├─ Postgres (Supabase, schema erp)
                                                                ├─ Redis (limite de taxa, filas BullMQ)
                                                                ├─ SMTP/Resend (convite, senha)
                                                                ├─ S3 (logos)
                                                                ├─ Ahgora (ponto)
                                                                └─ worker-ssw (HTTP interno /interno/v1)
worker-ssw (outro repositório) ──▶ mesmo Postgres, papel erp_worker
```

Três contêineres sobem pelo `docker-compose.yml` da raiz: `api`, `web` e `redis`. O worker-ssw tem
compose e deploy próprios.

## 2. Princípios que não se negociam

1. Regra de negócio no backend, em TypeScript. O banco guarda dados e RLS, nada mais: sem função,
   gatilho, view materializada, cron, extensão, Vault ou Auth do banco.
2. Paridade com o sistema atual (telas, números, URLs, textos, exportações, login), salvo as
   mudanças decididas (`docs/mudancas-visiveis.md`).
3. Multiempresa em todo dado de cliente (`empresa_id`), com RLS como segunda barreira.
4. Português no domínio, nas rotas, na UI e nos erros. TypeScript estrito, sem `any`, sem código
   morto.
5. Uma forma só de fazer cada coisa: API em MVC (ADR 0014), SQL puro sem ORM (ADR 0015), contrato
   zod compartilhado entre api e web (ADR 0013).

## 3. Repositório (ADR 0013)

```
apps/
  api/        projeto próprio (package.json, bun.lock, tsconfig, eslint, Dockerfile), MVC (ADR 0014)
    src/
      server.ts · app.ts · config.ts   processo · monta o Fastify · variáveis de ambiente validadas
      controllers/         C: rotas HTTP (Fastify) por recurso; middleware/ (sessão, guardas, contexto,
                           segurança, erro → resposta)
      models/<recurso>/    M: <recurso>.service.ts (operações) · <recurso>.repository.ts (SQL puro)
      models/repositories.ts  M: todos os repositórios presos à transação com contexto
      models/common/        M: catálogos (telas, módulos, papéis, permissões), datas, zod, erros padrão (origem)
      views/               V: apresentação (dado do model → resposta do contrato) e e-mails
      views/contracts/     V: contratos zod de cada endpoint (origem)
      dominio/             regras puras (origem)
      db/                  cliente `pg` com contexto de empresa, tag `sql`, ajudantes de linha,
                           aplicador de migrations, seeds
      jobs/                BullMQ: registro, agendamentos, processadores
      infra/               clientes externos: e-mail, S3, Redis, Ahgora, worker-ssw, senhas, tokens, log
    migrations/            migrations em SQL escrito à mão (NNNN_nome.sql)
    bootstrap/roles.sql    papéis do banco (aplicado uma vez pelo DBA, antes da primeira migration)
  web/        projeto próprio (SPA)
    src/
      routes/              rotas por arquivo (TanStack Router)
      modules/<dominio>/   telas e consultas de cada domínio
      componentes/         comum + ui (shadcn)
      acesso/              sessão, guarda de rota, inatividade
      dominio/ shared/     cópias iguais às da api
docker-compose.yml · docs/ · scripts/ · .github/
```

`@erp/shared` (na api: `views/contracts`, `views/contract.ts`, `models/common`) e `@erp/domain` têm
origem na api e cópia byte a byte no web (`src/shared`, `src/domain`). Os imports `@erp/shared/*` e
`@erp/domain/*` são resolvidos pelo `paths` do `tsconfig.json` de cada app. Mudou na api, roda
`scripts/copiar-compartilhado.sh` no mesmo commit; o CI confere com `--conferir`. O worker-ssw leva
a sua própria cópia, com os mesmos imports.

## 4. Stack

| Camada | Escolha |
| --- | --- |
| Web | Vite 7, React 19, Tailwind 4, shadcn/Radix, TanStack Router e Query, react-hook-form + zod |
| API | Node 22 LTS, Fastify 5, Zod 4 (`fastify-type-provider-zod`), Swagger fora de produção |
| Dados | Postgres (Supabase usado como Postgres comum), `pg` com SQL puro e tag `sql`, sem ORM (ADR 0015) |
| Jobs | BullMQ + Redis, no processo da api (`JOBS_LIGADOS`, `AGENDAMENTOS_LIGADOS`) |
| Auth | argon2id (`@node-rs/argon2`), bcryptjs só para validar hash antigo, JWT EdDSA (`jose`) |
| Arquivos | S3 compatível (`@aws-sdk/client-s3`) |
| Observabilidade | pino (JSON), `prom-client`, `@fastify/under-pressure` |
| Testes | só no web: vitest + Testing Library e jsdom (a api não tem testes, decisão do dono) |
| Ferramentas | bun (instalação e scripts; nunca npm), ESLint estrito com tipos, Prettier |

## 5. API

### 5.1 Camadas de um recurso (MVC, ADR 0014)

| Arquivo | Responsabilidade |
| --- | --- |
| `controllers/<recurso>.controller.ts` | HTTP fino: rota com o contrato zod (a validação roda antes do handler), guardas, contexto; chama o model e entrega à view. Sem SQL, sem regra, sem montar JSON |
| `models/<recurso>/<recurso>.service.ts` | Operações: permissão de negócio, transação, regra de domínio, auditoria. Declara a porta `Repositorio<Recurso>`. Devolve dado do model, nunca a resposta do endpoint (não usa `SaidaDe`) |
| `models/<recurso>/<recurso>.repository.ts` | Acesso a dados em SQL puro, consultas set-based, nenhuma regra escondida |
| `views/<recurso>.view.ts` | `apresentar<Coisa>(dado) → SaidaDe<contrato>`: tira campo interno, renomeia, monta envelope e rótulo. Pura: sem consulta, sem regra |

Quando o dado do model já é a resposta, não se cria view identidade: o controller devolve direto.
Os jobs entram pela fila e chamam o model, como um controller. As dependências se compõem em
`src/app.ts` e `src/server.ts` (sem container de injeção).

Os recursos são acesso, agendamentos, ahgora, auditoria, auth, bonificação de entrega, cadastros,
calendário, códigos de ocorrência, coletas, comprovantes, configurações, CT-e, filtros, histórico,
ingestão, ingestão SSW, listagem, logs, manutenção, ocorrências, painel da Plataforma, performance,
plataforma, prazo do parceiro, prazos, ranking, recálculo, romaneio, segredos e usuários.

### 5.2 Contratos e erros

- Cada endpoint tem um contrato em `views/contracts/<dominio>.ts` (método, caminho, entrada,
  saída). A api usa o contrato para validar; o web usa o mesmo contrato para chamar e tipar. Os
  tipos saem dos schemas (`z.infer`, `SaidaDe`, `EntradaDe`), nunca escritos à mão.
- O schema de saída é o molde da resposta: o serializer do Fastify só deixa sair o que ele declara.
- Rotas: `/api/v1/<dominio>/<recurso>`. Rotas públicas de integração em `/api/public/*`, com os
  caminhos de hoje.
- Erro de negócio (`ErroDeNegocio`; no model, `naoEncontrado`, `semPermissao`, `conflito`) vira
  resposta com código e mensagem para o operador; erro inesperado vira `ERRO_INTERNO`, sem detalhe
  interno. O timeout do banco vira "reduza o período" no tratador central.

### 5.3 Regras de domínio

`src/domain` tem só funções puras (sem I/O, sem relógio escondido; quem precisa de "hoje" recebe
`agora`). Principais: núcleo do CT-e (finalização, ocorrência efetiva, atraso, prazo, universo,
gravação), performance, romaneio, ranking, bonificação, calendário, acesso, leitores dos relatórios
SSW. Toda regra portada de uma função SQL cita a origem num comentário. Fica fora de `models/`
porque é copiado byte a byte para o web e o worker-ssw.

Agregação pesada (ex.: performance sobre centenas de milhares de CT-e) é uma consulta SQL montada
no backend com a tag `sql`: o backend decide o que filtrar, agrupar e calcular, e o banco só
executa.

## 6. Dados

- **Schema `erp`** no Postgres do projeto Supabase `erp-ssw`. Nunca escrever no schema `public`.
- **Consultas (ADR 0015):** `pg` direto com a tag `sql` (`src/db/sql.ts`). Todo valor interpolado
  vira parâmetro `$n`; um `Sql` interpolado entra como trecho; array vira um parâmetro só, com cast
  explícito (`= any(${ids}::uuid[])`); jsonb por `sql.json(...)`; identificador dinâmico só por
  `sql.identificador`. Colunas saem em camelCase por `as "campo"`; nas tabelas largas,
  `camposDaLinha`, `valoresDeInsercao` e `atribuicoes` (`src/db/rows.ts`).
- **Tipos:** date, timestamp, timestamptz e interval chegam em texto; instantes são convertidos com
  `comInstantes` / `instanteDoBanco`. bigint e numeric ficam em texto.
- **Migrations:** `.sql` escritos à mão em `apps/api/migrations/`, a fonte da verdade do DDL.
  `bun run db:migrar` (`src/db/migrate.ts`, papel `erp_migracao`) aplica as pendentes em ordem de
  nome, cada uma na sua transação e sob advisory lock, e anota em `migracoes.aplicadas`.
- **Papéis:** `erp_app` (api, sem BYPASSRLS), `erp_worker` (worker-ssw, GRANT mínimo, sem
  BYPASSRLS), `erp_migracao` (dono das tabelas, só para migrar). Criados por `bootstrap/roles.sql`.
- **Contexto por transação:** cada requisição roda numa transação (`Banco.transacao`) com
  `set_config` local de `app.empresa_id`, `app.usuario_id` e `app.plataforma`. Sem contexto, nenhuma
  linha.
- **RLS** em toda tabela com `empresa_id`
  (`empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid`, mais
  `app.plataforma = 'on'` onde a Plataforma administra); tabelas de identidade sem RLS (ADR 0002).
- **O que hoje é gatilho, matview ou cron** vira valor gravado pelo caso de uso, projeção mantida
  pelo worker-ssw ou job agendado. `atualizado_em` é gravado pelo backend no UPDATE.
- **Conexão:** cifrada com `sslmode=no-verify`, sem certificado da CA.

## 7. Autenticação e sessão

| Item | Como funciona |
| --- | --- |
| Login | E-mail e senha, com limite de tentativas e bloqueio progressivo. Mesma mensagem para e-mail inexistente e senha errada |
| Senhas antigas | Hash bcrypt do sistema atual validado no 1º login e regravado em argon2id na mesma transação |
| Token de acesso | JWT EdDSA de 15 min, só em memória no web, com `kid` para rotação (`JWT_CHAVES_ANTERIORES`) |
| Refresh | Opaco e rotativo, em cookie `httpOnly`, `Secure`, `SameSite=Strict`, preso a `/api/v1/auth`; só o hash vai ao banco. Reuso fora da janela de concorrência revoga a família inteira |
| Limites da sessão | 8 h no máximo desde o login; 1 h sem uso encerra (api e web) |
| Acesso em cache | O acesso calculado (permissões, módulos, papel) fica 30 s em cache; qualquer escrita da api limpa na hora |
| Empresa ativa | Trocar a empresa reemite o token (ADR 0003) |
| Convite e redefinição | Token de uso único por e-mail; dois cliques no mesmo link, só um vale |
| Fora | Login social (decisão de 12/11/2026). A remoção do Google ainda não está na `develop` (§18) |

## 8. Autorização

Guardas no backend (`controllers/middleware/guards`), nesta ordem: autenticado → empresa ativa →
módulo liberado para a empresa (`exigirModulo`) → permissão da ação na tela
(`exigirPermissao(tela, "ver" | "editar" | "excluir")`) → papel (`exigirAdminDaEmpresa`) ou equipe
da Plataforma (`exigirAdminPlataforma`).

- **Permissão por ação** (`models/common/access/permissions.ts`): cada tela declara as ações que tem
  (Ver; Criar/Editar; Excluir). O cargo dá permissões; a exceção por usuário concede ("Sim") ou nega
  ("Não"). Admin e Super Admin têm tudo pelo código. Telas dadas por regra (ex.: Logs) e as da
  Plataforma não entram em cargo de empresa.
- **Plataforma:** a equipe tem cargos próprios sobre as telas da Plataforma (Ver / Criar-Editar /
  Excluir, guarda `exigirPermissaoDaPlataforma`); o Super Admin da Plataforma tem tudo.
- Toda escrita confere a ação do endpoint, não só a tela. O web esconde o que não é permitido, mas
  quem decide é a api. RLS é a segunda barreira. Regras de segurança do Admin e da Plataforma estão
  no ADR 0007.

## 9. Jobs (BullMQ, na api)

Rodam no processo da api quando `JOBS_LIGADOS=true`; os agendados (cron) só com
`AGENDAMENTOS_LIGADOS=true`, para que uma única réplica agende. Jobs: limpeza de sessões e tokens
vencidos, prazos configurados, recálculos, classificação de códigos de ocorrência e recifragem de
segredos após rotação da chave mestra. O job é fino: chama o model. Os jobs de ingestão (FTP, BI2,
heartbeat SSW) são do worker-ssw.

## 10. Integração com o worker-ssw (ADR 0012)

- O ERP **lê** direto do banco o que as telas de ingestão mostram.
- O ERP **pede** ao worker-ssw as execuções e operações manuais pelo HTTP interno
  (`WORKER_SSW_URL` + token; contrato em `views/contracts/worker-ssw.ts`, igual nos dois lados).
  O ERP valida a entrada e grava a auditoria antes de chamar. Sem configuração, as ações respondem
  503 e as leituras seguem.
- O ERP cadastra as integrações por empresa (`empresa_integracoes`, cifradas); o worker-ssw lê com
  a mesma `SEGREDOS_CHAVES`.
- O web encaminha `/api/public/*` (menos o link público do ranking) ao worker-ssw: as URLs das
  integrações externas não mudam.
- Mudança de regra do núcleo do CT-e vai aos dois repositórios. O worker-ssw mantém a sua cópia
  Drizzle das tabelas que usa e confere `information_schema` no boot.

## 11. Web

- SPA servida pelo Caddy. Em desenvolvimento, o Vite repassa `/api` para a api (mesma origem, o
  cookie `SameSite=Strict` funciona sem CORS).
- Rotas por arquivo com code splitting; `_autenticado` protege as telas, renova a sessão e controla
  a inatividade. O arquivo da rota só aponta para a página em `src/modules/<dominio>/`, no caminho
  de hoje (`CAMINHO_DA_TELA`): guarda e menu saem dele.
- Dados pelo TanStack Query, chamando a api pelo contrato (`chamar(contrato, ...)`), com erro
  traduzido para mensagem ao operador; depois de gravar, `invalidateQueries` da chave do domínio.
- Formulários com react-hook-form + o zod do contrato, e a mesma regra do `dominio` quando há
  cálculo na tela.
- Mesmo visual do sistema atual: classes e textos copiados da tela de referência; componentes em
  `src/components/ui` (shadcn).
- Exportação para Excel (exceljs) e PDF (jspdf).

## 12. Segurança

- Validação zod em toda entrada; consultas sempre parametrizadas; limite de corpo de 1 MB.
- `helmet` (CSP desligada só com o Swagger, fora de produção), CORS restrito a `WEB_URL` e
  `CORS_ORIGENS`, limite de taxa global e por rota (no Redis em produção), `under-pressure`.
- Segredos de integração em AES-256-GCM com chave mestra por ambiente (`SEGREDOS_CHAVES`,
  versionada para rotação); nunca no banco em claro, nunca em log (URL com `secret`/`token`/`senha`
  é mascarada).
- `trustProxy` só para os proxies configurados (`PROXIES_CONFIAVEIS`), para o IP do limite de taxa
  ser o do cliente.
- Auditoria gravada pelo caso de uso, na mesma transação da escrita.

## 13. Observabilidade

- Log JSON (pino) com `x-request-id`.
- `/healthz` (processo de pé) e `/readyz` (banco e Redis respondendo); health check do Docker na api.
- `/metrics` (Prometheus), só com `METRICAS_TOKEN`.

## 14. Implantação

- `docker compose up -d --build` na VPS. A imagem de cada app é construída só com a pasta dele.
- Portas no host: web 8081 e api 3001 (o Docker ignora o ufw: ficam abertas); Redis só em
  `127.0.0.1`. HTTPS fica no proxy da frente.
- Variáveis em `.env` na raiz (modelo em `.env.example`). Obrigatórias: `DATABASE_URL`,
  `JWT_CHAVE_PRIVADA`, `SEGREDOS_CHAVES`. Domínio, e-mail e worker-ssw ficam em
  Plataforma › Integrações (cifrados no banco).
- Ambiente novo: o DBA roda `bootstrap/roles.sql` uma vez; depois `bun run db:migrar` em
  `apps/api`, de uma máquina confiável, com `DATABASE_URL_MIGRACAO` (papel de migração).
- Detalhes: `docs/deploy.md`.

## 15. Boas práticas

O passo a passo com exemplo (módulo Calendário) e o checklist de domínio portado estão em
`docs/molde.md`. Em resumo:

### 15.1 Código

- TypeScript `strict` + `noUncheckedIndexedAccess`; sem `any`, sem `as` para calar o compilador.
- Português no domínio, rotas, mensagens e comentários. Mensagem de erro fala com o operador
  ("reduza o período...").
- Funções pequenas, nomes que dizem a intenção, sem efeito colateral escondido.
- Regra portada cita a origem: `// origem: calcular_performance (sistema atual)`.
- Sem código morto, sem `_v2/_v3`, sem flag para comportamento antigo. O que perde uso sai no
  mesmo commit, com dependência, exportação e documentação.
- Prettier: `printWidth 100`, aspas duplas, ponto e vírgula, `trailingComma all`, LF.

### 15.2 Camadas

- Regra pura em `dominio/` (recebe `agora`, não lê relógio nem banco).
- O service decide e devolve dado do model; a view só apresenta; o controller só liga HTTP ao
  model. Nada de SQL fora do repository, nada de regra no repository ou na view.
- Escrita: uma transação só (`db(async ({ recurso, auditoria }) => ...)`), com a auditoria dentro.
- Recurso novo: repository registrado em `models/repositories.ts`, controller em `app.ts`.

### 15.3 SQL e banco

- Todo valor por parâmetro (tag `sql`); nunca concatenar texto em consulta.
- Consulta set-based, com teto (`limit`) na consulta ampla.
- Sem checagem de tipo das colunas: todo repository novo ou alterado roda contra o banco antes do
  merge.
- Migration: próximo número da pasta, escrita à mão e revisada; aplicada não se edita (correção é
  migration nova). Tabela nova no schema `erp`, snake_case, `empresa_id uuid not null` com FK e RLS
  na mesma migration; revogar do `erp_app` o que ele não deve fazer.
- Mudança de dado de acesso ou de permissão preserva o acesso de hoje e é simulada só com SELECT
  no banco real antes de aplicar (ex.: `0014_migrar_acesso_para_permissoes.sql`).
- Proibido no banco: função, gatilho, view materializada, extensão, cron. Nunca escrever em
  `public` nem tocar no projeto de produção do sistema atual.

### 15.4 Código compartilhado

- A origem é a api. Mudou `dominio`, `views/contracts` ou `models/common`, roda
  `scripts/copiar-compartilhado.sh` no mesmo commit.
- Regra do núcleo do CT-e vai também ao worker-ssw.

### 15.5 Processo

- bun em tudo (nunca npm); comandos rodam dentro da pasta do app.
- Cada agente trabalha num worktree em `.worktrees/<nome>`, com branch própria; só o coordenador faz
  merge na `main`. Reestruturação grande só em worktree, nunca no working tree compartilhado.
- Decisão de produto ou de arquitetura vira ADR (`docs/adr/`, formato do ADR 0001); diferença
  visível ao usuário entra em `docs/mudancas-visiveis.md`.
- Dependência nova: estável, mantida, publicada há mais de 24 h (`bunfig.toml`), declarada no
  `package.json` de cada app que a usa.

## 16. Qualidade

- Cada app roda `typecheck`, `lint` (ESLint + Prettier) e `build` dentro da própria pasta; o web
  roda também `test`.
- CI (GitHub Actions), um job por app: tipos, lint, build e, no web, testes com cobertura;
  conferência das cópias (`copiar-compartilhado.sh --conferir`); osv-scanner nos dois `bun.lock`;
  build das imagens + Trivy; hadolint, actionlint, `docker compose config`, Caddyfile; gitleaks no
  histórico.
- Ações de terceiros fixadas por SHA no CI.

## 17. Decisões registradas

| ADR | Decisão |
| --- | --- |
| 0001 | Formato dos ADRs |
| 0002 | RLS nas tabelas com `empresa_id`; identidade sem RLS |
| 0003 | Empresa ativa por sessão |
| 0004 | Versões das dependências |
| 0005 | Decisões do dono aplicadas na fundação |
| 0006 | Ranking de equipes e bonificação corrigidos |
| 0007 | Segurança do Admin e da Plataforma |
| 0008 | Ingestão SSW em pacote, com Redis (hoje no worker-ssw, ADR 0012) |
| 0009, 0010 | Webhook SSW: quarentena de token e segredo por empresa |
| 0011 | `@fastify/swagger-ui` 6 |
| 0012 | Ingestão no worker-ssw |
| 0013 | api e web como projetos independentes |
| 0014 | API em MVC |
| 0015 | SQL puro, sem ORM |

## 18. Pendências técnicas

1. Login com Google: a remoção (código, `GOOGLE_*`, `openid-client`, `erp.identidades_externas`)
   está na branch `codigo/apartar-apps`, fora da `develop`. A migration dela foi gerada pelo
   drizzle-kit como `0013`, número que já foi usado: precisa ser reescrita como `.sql` com o
   próximo número.
2. Branches abertas antes do ADR 0015 (`codigo/apartar-apps`, `plataforma/multitenant`) ainda usam
   o Drizzle: rebase na `develop` antes do merge. Depois, apagar `drizzle.migracoes_erp` do banco.
3. Atualizar o worker-ssw para copiar `dominio` e os contratos das pastas novas da api (ADR 0013 e
   0014).
4. Portas 3001 e 8081 abertas para a internet na VPS: decidir se a api fica só atrás do web.
5. Metas de desempenho e disponibilidade (PRD §6) para virar alerta e teste de carga.
