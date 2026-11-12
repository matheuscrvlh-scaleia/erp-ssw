# ADR 0014 — API em MVC (Model, View, Controller)

- Situação: aceita (12/11/2026, decisão do dono)
- Substitui: as camadas por módulo `apps/api/src/modulos/<dominio>/{rotas,casos-de-uso,repositorio}.ts`

## Contexto

O dono quer o backend em MVC. A API já tinha a separação certa (HTTP fino, orquestração, acesso a
dados, regra pura), mas espalhada por módulo e sem uma camada de apresentação: os casos de uso
devolviam a resposta pronta do endpoint (`SaidaDe<contrato>`), então a regra conhecia o formato do
JSON e a apresentação (tirar campo interno, renomear, envelope, texto de e-mail) ficava misturada
com a decisão de negócio.

## Referências

- Fowler, _GUI Architectures_ — o Model ignora a apresentação:
  <https://martinfowler.com/eaaDev/uiArchs.html>
- Fowler, _Service Layer_ (fronteira de operações e transação, parte do Model):
  <https://martinfowler.com/eaaCatalog/serviceLayer.html>; _Transform View_ (a View de dados):
  <https://martinfowler.com/eaaCatalog/transformView.html>; _Repository_:
  <https://martinfowler.com/eaaCatalog/repository.html>
- AdonisJS (MVC oficial em TypeScript): `app/controllers`, `app/models`, `app/transformers` como
  a View de API JSON, controller que valida, chama o serviço e serializa pelo transformer —
  <https://docs.adonisjs.com/guides/getting-started/folder-structure>,
  <https://docs.adonisjs.com/guides/frontend/transformers>, <https://github.com/adonisjs/starter-kits>
- Laravel, API Resources ("a transformation layer between your models and the JSON responses") e
  Form Requests (validação antes do controller): <https://laravel.com/docs/12.x/eloquent-resources>,
  <https://laravel.com/docs/12.x/validation>
- Rails em modo API (`ActionController::API`, view JSON): <https://guides.rubyonrails.org/api_app.html>

## Decisão

Pastas por camada, como AdonisJS, Laravel e Rails; dentro de cada camada, o recurso.

```
apps/api/src/
  server.ts                         processo: banco, Redis, jobs e HTTP (composição)
  controllers/<recurso>.controller.ts    C
  models/<recurso>/<recurso>.service.ts  M  operações de negócio (Service Layer)
  models/<recurso>/<recurso>.repository.ts  M  dados (Drizzle)
  models/repositorios.ts            M  todos os repositórios presos à transação com contexto
  models/erros.ts                   M  erros de negócio (`naoEncontrado`, `conflito`, ...)
  models/cte/                       M  gravação do CT-e pelo núcleo + SQL comum de CT-e
  views/<recurso>.view.ts           V  apresentação: model → corpo da resposta; e-mails
  http/app.ts                       monta o Fastify e registra os controllers
  http/tratador-erros.ts            erro → resposta (código e mensagem ao operador)
  http/middleware/                  sessão, guardas, contexto da empresa, segurança, métricas
  jobs/                             entrada pela fila (BullMQ): o job chama o model, como um controller
  dominio/                          M  regras puras, sem I/O (cópia no web e no worker-ssw, ADR 0013)
  shared/contratos/                 contratos zod: entrada (validação) e saída (forma da View)
  db/                               M  schema Drizzle, cliente com contexto, RLS
  infra/                            adaptadores externos (S3, SMTP, Google, Ahgora, tokens, worker-ssw)
  config/                           ambiente
```

### Controller (`controllers/<recurso>.controller.ts`)

- Um plugin Fastify por recurso (`controlador<Recurso>`), registrado em `http/app.ts`.
- Declara a rota com o contrato (`schema: { querystring/body/params: entrada, response: saida }`):
  a validação acontece antes do handler (o "Form Request" do Laravel).
- Aplica as guardas (`http/middleware/guardas`), monta o contexto (empresa, ator), chama o service
  e entrega o resultado à view. Sem SQL, sem regra, sem montar JSON à mão.

### Model (`models/`, `dominio/`, `db/`)

- `<recurso>.service.ts`: as operações (Service Layer). Permissão de negócio, transação
  (`db(async (repos) => ...)`), auditoria na mesma transação, chamada às regras puras de `dominio/`.
  Declara a porta `Repositorio<Recurso>` que usa.
- O service devolve dado do model (tipos dele ou entidades de `shared`), **não** a resposta do
  endpoint: não importa `SaidaDe` nem o objeto `contratos<Recurso>`.
- `<recurso>.repository.ts`: Drizzle, consultas set-based, nenhuma regra escondida.
- `dominio/` continua a casa das regras puras (prazo, ocorrência efetiva, performance, ranking...).
  Fica fora de `models/` porque é copiado byte a byte para o web e o worker-ssw (ADR 0012/0013).

### View (`views/<recurso>.view.ts` + saída do contrato)

- Funções puras `apresentar<Coisa>(dadoDoModel) → SaidaDe<contrato>` (Transform View): tirar campo
  interno, renomear, envelope, rótulo e formatação de exibição. Sem I/O, sem consulta, sem decisão
  de negócio (número calculado é do model).
- O schema de saída do contrato (`shared/contratos`) é o molde: o serializer do Fastify só deixa
  sair o que ele declara.
- Quando o dado do model já é a resposta (ex.: `{ inseridos, atualizados }`), o controller devolve
  direto; não se cria view identidade.
- E-mails são views (`views/auth.view.ts`).

## Consequências

- A regra não sabe o formato do JSON: mudar a apresentação não toca no model, e o mesmo model
  serve controller e job.
- Os caminhos mudaram (`modulos/*` → `controllers/`, `models/`, `views/`; `plugins/` →
  `http/middleware/`; `compartilhado/` → `models/cte/`; `infra/repositorios.ts` e `http/erros.ts` →
  `models/`). As URLs, contratos e respostas **não** mudaram: os testes de contrato
  (`*.controller.test.ts`) são os mesmos.
- Branch aberta antes desta mudança: rebase na `develop`; o git segue os arquivos movidos
  (`git mv`), e o conflito fica só no que mudou de conteúdo.
