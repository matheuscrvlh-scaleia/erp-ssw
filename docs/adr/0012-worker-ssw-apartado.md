# ADR 0012 — Worker do SSW apartado (`worker-ssw`)

- Situação: aceita (10/11/2026, decisão do dono)
- Substitui: a parte de ingestão do `apps/worker` e o `packages/ingestao` deste repositório

## Contexto

O dono quer o worker separado do back e do front: um sistema próprio, com Docker, Node e
Fastify, que faz a consulta ao SSW. Decisões do dono (10/11/2026):

1. O worker-ssw **grava direto no banco** (schema `erp` do mesmo Postgres), com papel próprio e RLS.
2. Os jobs que **não falam com o SSW ficam no backend do ERP**.
3. O worker-ssw leva **cópia própria** do código de que precisa (núcleo do CT-e, tabelas que usa).
4. O DEVELOP só é preparado para a VPS **depois** da separação.

## Decisão

### Repositórios

| Sistema     | Pasta                                         | Faz                                                        |
| ----------- | --------------------------------------------- | ---------------------------------------------------------- |
| ERP SSW     | `C:\Users\Matheus Carvalho\Desktop\erp-ssw`    | API + web + migrador + jobs do ERP; dono do schema `erp`  |
| Worker SSW  | `C:\Users\Matheus Carvalho\Desktop\worker-ssw` | tudo que busca, recebe e aplica dado do SSW                |

### O que é de cada um

**worker-ssw** (Node 22 + Fastify 5 + BullMQ + Redis próprio + Docker):

- Fontes: FTP/SFTP (relatórios 036, 038, 306, 455, 930 e 050), XML de CT-e, BI2 0017, API do
  SSW (token), webhook do SSW.
- Ciclo de aplicação (staging → CT-e e ocorrências, estorno 86, previsão do SSW, histórico de
  prazo, auditoria da ingestão) e a gravação de CT-e que ele exige.
- Projeções do Romaneio (incremental e completa, inclusive `romaneio_conferente_cte`), SLA pelos
  arquivos, coletas do 050, limpeza da ingestão.
- Jobs: `sincronizar-ftp`, `sincronizar-ftp-retroativo`, `aplicar-ciclos`, `bi2-0017`,
  `verificar-token-ssw`, `processar-webhook-ssw`, `reprocessar-xml-orfaos`, `sla-arquivos`,
  `limpar-ingestao-arquivos`, `limpar-ingestao-ssw`, `projecoes-romaneio`,
  `projecoes-romaneio-completa`, `coletas` (050) e o despachante (`agendador`).
- HTTP **público**, com as mesmas URLs de hoje: `/api/public/ssw-ocorrencias` (webhook),
  `/api/public/ftp-relatorio-import`, `/api/public/ssw-ciclo-aplicar` e
  `/api/public/xml-orfaos-retry`. A borda (Caddy do ERP) encaminha `/api/public/*` ao worker-ssw;
  as integrações externas não mudam.
- HTTP **interno** (`/interno/v1/*`, abaixo), só na rede interna.
- `/saude/vivo`, `/saude/pronto` e `/metrics`.

**ERP** (este repositório):

- API, web e migrador, como hoje.
- Jobs do ERP **dentro do processo da API** (BullMQ com o Redis do ERP): `limpar-sessoes`,
  `recalcular-prazos-configurados`, `propagar-classificacao-codigo`, `recalcular-ctes-do-codigo`,
  `recifrar-segredos`. Liga e desliga por `JOBS_LIGADOS`.
- Telas de Admin › Importação SSW, XML CT-e, Diagnóstico SSW e integrações: **leem o estado
  direto do banco** (tabelas compartilhadas) e **pedem ações ao worker-ssw pelo HTTP interno**.
- `GET /api/v1/ssw/atualizacao` e `GET /api/v1/ssw/saude` continuam no ERP (leitura do banco).
- Cadastro das integrações (`empresa_integracoes`, cifrado com AES-256-GCM): o ERP grava, o
  worker-ssw lê. Os dois usam as mesmas `SEGREDOS_CHAVES`/`SEGREDOS_CHAVE_ATUAL`.

### Banco

- O schema `erp` tem **um dono só: o ERP**. Toda migration nasce em `erp-ssw/packages/db`. O
  worker-ssw não tem migration.
- Papel novo **`erp_worker`**: login, `NOBYPASSRLS`, `NOINHERIT`, só DML nas tabelas que o
  worker-ssw usa (GRANT na migration do ERP). Contexto por transação com `SET LOCAL` de
  `app.empresa_id` / `app.plataforma` / `app.usuario_id`, igual à API.
- O worker-ssw guarda a sua cópia das definições Drizzle das tabelas que usa e, **no boot,
  confere** em `information_schema` que cada tabela e coluna existe com o tipo esperado. Faltou =
  não sobe (mensagem com a lista). É o contrato de schema entre os dois.
- Mudança de schema que o worker-ssw precise: migration no ERP primeiro (expandir), deploy do
  worker-ssw depois; remover coluna só depois que o worker-ssw parar de usá-la (contrair).

### HTTP interno (ERP → worker-ssw)

Autenticação: `Authorization: Bearer <token de serviço>`, comparado em tempo constante. O
worker-ssw aceita dois tokens (`INTERNO_TOKENS=atual,anterior`) para girar sem queda; o ERP manda
um (`WORKER_SSW_TOKEN`). Base: `WORKER_SSW_URL` (rede interna do Docker). Sem token configurado o
ERP responde 503 "Integração com o worker do SSW não configurada" nas ações; as telas de leitura
continuam.

A auditoria da ação (quem pediu) fica no ERP, gravada **antes** de chamar o worker-ssw.

| Método | Caminho                                              | Corpo / query                                          | Resposta                                                                 |
| ------ | ---------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| POST   | `/interno/v1/empresas/:empresaId/execucoes`          | `{ job, dados?, deduplicar? }`                         | `202 { execucaoId }`; `409` se `deduplicar` já está na fila              |
| GET    | `/interno/v1/execucoes/:job/:execucaoId`             | `?aguardarMs=0..60000` (espera até terminar ou vencer) | `{ estado: "na_fila"|"rodando"|"concluida"|"falhou", resultado?, erro? }` |
| GET    | `/interno/v1/empresas/:empresaId/situacao`           | —                                                      | `{ jobs: [{ job, estado, ultimaExecucao?, proximaExecucao? }], tokenSswGeradoEm? }` |

Operações manuais da tela Admin › Importação SSW (as mesmas de hoje; o usuário não pode perder
nenhuma). Respostas no formato que a tela já usa, e erro em português para o operador:

| Método | Caminho                                                         | Corpo                                   | Faz                                                        |
| ------ | --------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| POST   | `/interno/v1/empresas/:empresaId/ciclos/:chave/retomar`         | —                                       | retoma o ciclo                                              |
| POST   | `/interno/v1/empresas/:empresaId/ciclos/:chave/descartar`       | `{ motivo? }`                           | descarta o ciclo (e recalcula as projeções afetadas)        |
| POST   | `/interno/v1/empresas/:empresaId/relatorios`                    | `{ nomeArquivo, conteudoBase64 }`       | importação manual de relatório (até 64 MB)                  |
| POST   | `/interno/v1/empresas/:empresaId/aplicacoes`                    | `{ simular: boolean, ... }` (o de hoje) | aplica ou simula a aplicação                                |
| GET    | `/interno/v1/empresas/:empresaId/ftp`                           | —                                       | ligado/pausado, trava, progresso (Redis)                   |
| PUT    | `/interno/v1/empresas/:empresaId/ftp/ativo`                     | `{ ativo: boolean }`                    | pausa/religa o FTP                                          |
| POST   | `/interno/v1/empresas/:empresaId/ftp/liberar-trava`             | —                                       | força a liberação da trava do FTP                           |
| POST   | `/interno/v1/empresas/:empresaId/xml`                           | `{ nomeArquivo, conteudoBase64 }`       | importação manual de XML/zip (grava itens, arquivos, órfãos) |

O ERP repassa o corpo validado pelo seu contrato de tela; quem grava e decide é o worker-ssw.
Leituras puras (pipeline, aplicações, arquivos XML) continuam no ERP direto do banco.

- `job` aceito só da lista de jobs que podem ser pedidos de fora: `sincronizar-ftp`,
  `sincronizar-ftp-retroativo`, `aplicar-ciclos`, `bi2-0017`, `verificar-token-ssw`,
  `processar-webhook-ssw`, `reprocessar-xml-orfaos`, `projecoes-romaneio`,
  `projecoes-romaneio-completa`. `dados` é validado pelo zod do job.
- `erro` é mensagem para o operador (português, sem detalhe interno).
- O contrato zod fica em `worker-ssw/src/contrato-interno.ts` e é **copiado** para
  `erp-ssw/packages/shared/src/contratos/worker-ssw.ts` (mesmo conteúdo; o teste de cada lado
  confere os exemplos do contrato).

### Gravação de CT-e

A regra de gravar CT-e (núcleo + `regravarCte`/`criarCte`) é usada pelos dois: pelo worker-ssw
(ingestão) e pelo ERP (`recalcular-ctes-do-codigo`, `recalcular-prazos-configurados`). Fica em
`erp-ssw/packages/dominio` + repositório na API, e o worker-ssw leva a sua cópia. Mudança de regra
do núcleo vai aos dois (lista de arquivos copiados no README do worker-ssw).

### Migrador

O migrador continua no ERP e copia também as tabelas da ingestão. As funções puras que ele usava
do `packages/ingestao` (hash da linha, data de referência) passam para `packages/dominio`. A
reconstrução das projeções do Romaneio sai do migrador: na virada roda o comando do worker-ssw
(`reconstruir-projecoes`).

### Deploy

Dois `compose` na mesma VPS (ou em VPS separadas), cada um com o seu Redis. Rede Docker externa
`erp-interna` liga o Caddy e a API do ERP ao worker-ssw. Orçamento de conexões do Postgres soma os
dois sistemas.

## Consequências

- Deploy e escala independentes: ingestão pesada não divide CPU/memória com a API.
- Duas cópias do núcleo do CT-e: risco de divergência, coberto pela lista de arquivos copiados e
  pelos testes de paridade de cada lado.
- O schema compartilhado acopla os dois; o contrato no boot do worker-ssw transforma quebra
  silenciosa em falha explícita na subida.
