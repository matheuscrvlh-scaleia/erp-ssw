# Molde — como portar um domínio

Passo a passo para trazer um domínio do sistema atual (ex.: Ocorrências) para o ERP. O módulo
**Calendário** está pronto nos três lados e serve de exemplo para copiar: siga os arquivos dele
lado a lado com este guia.

| Camada | Calendário (exemplo) |
| --- | --- |
| Regra pura | `apps/api/src/dominio/calendario.ts` |
| Contrato | `apps/api/src/views/contratos/calendario.ts` |
| Tabela + RLS | `apps/api/migracoes/0000_schema_erp.sql` (`erp.feriados`) |
| API | `apps/api/src/{controllers/calendario.controller,models/calendario/calendario.{service,repository},views/calendario.view}.ts` |
| Tela | `apps/web/src/routes/_autenticado/calendario.tsx` → `apps/web/src/modulos/calendario/` |

## 1. Ler a regra antes do código

1. Abra a spec do domínio em `docs/regras/0X-*.md` e as decisões do dono em
   `docs/duvidas-do-dono.md` (vale a recomendação de cada item). Paridade com o sistema atual,
   salvo o que o dono decidiu mudar.
2. Liste os cálculos (o que vira `apps/api/src/dominio`) separados do que é só leitura/gravação.

## 2. Regra pura — `apps/api/src/dominio/<dominio>.ts`

- Funções sem I/O, sem `Date.now()` escondido (recebem `hoje`/`agora`), sem banco.
- Comentário curto com a origem: `// origem: calcular_performance (sistema atual)`.
- Violação de regra de negócio: `throw new ErroDeNegocio("ENTRADA_INVALIDA", "<mensagem para o
  operador>")` (`apps/api/src/dominio/erros.ts`).

## 3. Contrato — `apps/api/src/views/contratos/<dominio>.ts`

- Um `contrato({ metodo, caminho, parametros?, entrada?, saida })` por endpoint, em
  `contratos<Dominio>`. `entrada` é query string em GET/DELETE e corpo nos demais.
- Caminho `/api/v1/<dominio>/<recurso>`; parâmetro de caminho como `:id` com `parametros`.
- Os tipos saem dos schemas (`z.infer`, `SaidaDe<typeof c.obter>`); não escreva o tipo à mão.
- Mensagens de validação em português (o `z` de `@erp/shared/zod` já vem com pt-BR).

## 4. Tabela — `apps/api/migracoes/NNNN_<nome>.sql`

- Migration escrita à mão, com o próximo número da pasta. Depois de aplicada não se edita: correção
  é migration nova.
- Tabela no schema `erp`, colunas em snake_case, `empresa_id uuid not null` com FK para
  `erp.empresas`.
- RLS na mesma migration: `enable row level security` e as políticas de select, insert, update e
  delete para `erp_app` (e `erp_worker`, se o worker-ssw usar), no padrão de `erp.feriados` em
  `0000_schema_erp.sql`: `empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid`.
  Cadastro que a Plataforma também administra soma `current_setting('app.plataforma', true) = 'on'`.
- O `erp_app` já recebe DML nas tabelas novas (default privileges de `0002_permissoes_app.sql`);
  revogue o que ele não deve fazer.
- `atualizado_em` é gravado pelo backend no UPDATE (não há gatilho).
- **Proibido** no banco: função, gatilho, view materializada, extensão, cron.
- Aplique com `bun run db:migrar` em `apps/api` (`DATABASE_URL_MIGRACAO`, papel `erp_migracao`).

## 5. API em MVC — `controllers/`, `models/`, `views/` (ADR 0014)

**Model — `apps/api/src/models/<recurso>/<recurso>.service.ts`**: as operações; é onde mora a
decisão.

- Declara a porta `Repositorio<Recurso>` (interface) que ele usa.
- Cada operação recebe `db: Executor<"<recurso>" | "auditoria">` (de `../repositorios`): tudo o
  que roda dentro de `db(async ({ <recurso>, auditoria }) => ...)` é uma transação só, já com o
  contexto da empresa (RLS).
- Escrita grava auditoria na mesma transação (`auditoria.registrar(ator, {...})`).
- Erros para o operador: `naoEncontrado`, `semPermissao`, `conflito` (`../erros`).
- Devolve dado do model (tipo declarado aqui ou entidade de `@erp/shared`), nunca a resposta do
  endpoint: não usa `SaidaDe`. A entrada já validada pode ser tipada pelo contrato (`EntradaDe`,
  import só de tipo); a saída, nunca.

**Model — `models/<recurso>/<recurso>.repository.ts`**: SQL puro com a tag `sql` de `@erp/db`
(parâmetros sempre ligados, colunas com `as "camelCase"`), consultas set-based, nenhuma regra
escondida.

- `criarRepositorio<Recurso>(tx: Transacao): Repositorio<Recurso>`.
- Registre em `apps/api/src/models/repositorios.ts` (`Repositorios` + `criarRepositorios`).
- Consulta ampla tem teto (`.limit(...)`) e o timeout do banco vira "reduza o período" sozinho
  (tratador central).

**View — `apps/api/src/views/<recurso>.view.ts`**: `apresentar<Coisa>(dado) → SaidaDe<contrato>`.
Função pura: tira campo interno, renomeia, monta envelope, rótulo ou texto de exibição. Sem
consulta e sem regra (número calculado vem do model). Se o dado do model já é a resposta, não
crie view: o controller devolve direto.

**Controller — `apps/api/src/controllers/<recurso>.controller.ts`**: HTTP fino. Schema do contrato
(a validação roda antes do handler), guardas, contexto, chama o model e entrega à view.

```ts
const ler = [exigirModulo("<modulo>"), exigirPermissao("<tela>", "ver")];
app.get(
  c.obter.caminho,
  { schema: { querystring: c.obter.entrada, response: { 200: c.obter.saida } }, preHandler: ler },
  async (request) =>
    apresentarCalendario(
      await obterCalendario(request.db, await contextoDe(request), request.query.ano, agora()),
    ),
);
```

- Guardas (`./middleware/guardas`): `exigirAutenticacao` (já implícita nas outras),
  `exigirEmpresa`, `exigirPermissao`, `exigirUmaDasTelas`, `exigirModulo`,
  `exigirAdminDaEmpresa`, `exigirAdminPlataforma`.
- Registre o plugin (`controlador<Recurso>`) em `apps/api/src/app.ts`.

## 6. Tela — `apps/web`

O padrão completo está no ADR 0016 (`docs/adr/0016-arquitetura-do-web.md`). Em resumo:

- Rota: `src/routes/_autenticado/<caminho>.tsx` só aponta para `modulos/<dominio>/Pagina<Nome>.tsx`
  (caminho e schema da busca). O caminho é o mesmo de hoje (`CAMINHO_DA_TELA` em
  `@erp/shared/acesso/telas`): a guarda e o menu saem dele sozinhos.
- Módulo: `Pagina<Nome>.tsx` (lê a busca, chama as consultas, monta o `<Pagina>`), `componentes/`
  (um componente exportado por arquivo, recebe props) e, só os que precisar, os arquivos de nome
  fixo `api.ts`, `busca.ts`, `regras.ts`, `textos.ts` e `exportacao.ts`.
- Dados: só o `api.ts` chama `chamar(contrato, { parametros, entrada })` de `@/lib/api` (token,
  renovação e erro padrão já tratados). Chaves numa fábrica `chaves` que começa pelo nome do módulo;
  consultas com `queryOptions`; escrita com `mutacao<Acao>(cliente)` (`mutationOptions` que
  invalida a chave do módulo), e o componente só faz `useMutation(mutacaoX(cliente))`. Não mude a
  política de cache do `roteador.tsx` (contorno de timeout).
- Estado: filtro, página e aba na URL (`busca.ts`); formulário com `react-hook-form` +
  `zodResolver`, reaproveitando o schema do contrato e a regra do `src/dominio` (ver
  `componentes/comum/ModalDeFeriado.tsx`); efêmero em `useState`. Sem store global.
- Permissão na tela vem do acesso (`usePermissao`, `useSuspenseQuery(consultaAcesso)`). A API
  confere de novo; a tela só esconde botão.
- Mesmo visual do sistema atual: copie classes e textos da tela de referência; `<Pagina>` e as
  peças comuns de carregando/vazio/erro; componentes em `src/componentes/ui` (shadcn).
- Dependências: um módulo só importa de outro o `api.ts`; peça usada por dois módulos sobe para
  `componentes/comum`, `hooks` ou `lib`, que não importam de `modulos/`. O ESLint barra.
- Teste de `regras`, `busca`, `textos` e `exportacao` (`*.test.ts`) e de componente com lógica
  (`*.test.tsx`, Testing Library), ao lado do arquivo testado.

## Checklist do domínio portado

- [ ] Regras e decisões do dono lidas; diferenças propositais anotadas em ADR.
- [ ] Cálculos em `apps/api/src/dominio`, com origem citada.
- [ ] Contratos zod em `apps/api/src/views/contratos/<dominio>.ts`, copiados para o web com
      `scripts/copiar-compartilhado.sh`.
- [ ] Tabelas com `empresa_id` e RLS na migration escrita à mão e revisada; nada de
      função/gatilho/matview/extensão.
- [ ] Casos de uso com transação única, auditoria nas escritas, mensagens para o operador.
- [ ] Repositório registrado em `repositorios.ts`; rotas registradas em `app.ts`.
- [ ] Toda rota com guarda de tela e módulo (e papel quando grava).
- [ ] Tela no caminho de hoje, com o visual de hoje; ações escondidas para quem não pode.
- [ ] `bunx tsc` em cada pacote, `bunx eslint .`, `bunx prettier --check .`, e no web
      `bunx vitest run` e `bunx vite build` passando.
