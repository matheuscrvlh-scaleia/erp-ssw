# Molde — como portar um domínio

Passo a passo para trazer um domínio do sistema atual (ex.: Ocorrências) para o ERP. O módulo
**Calendário** está pronto nos três lados e serve de exemplo para copiar: siga os arquivos dele
lado a lado com este guia.

| Camada | Calendário (exemplo) |
| --- | --- |
| Regra pura | `apps/api/src/dominio/calendario.ts` (+ `.test.ts`) |
| Contrato | `apps/api/src/shared/contratos/calendario.ts` |
| Tabela + RLS | `apps/api/src/db/schema/dominio/feriados.ts` |
| API | `apps/api/src/modulos/calendario/{rotas,casos-de-uso,repositorio}.ts` (+ testes) |
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
- Teste com os casos-limite da spec (`<dominio>.test.ts`).

## 3. Contrato — `apps/api/src/shared/contratos/<dominio>.ts`

- Um `contrato({ metodo, caminho, parametros?, entrada?, saida })` por endpoint, em
  `contratos<Dominio>`. `entrada` é query string em GET/DELETE e corpo nos demais.
- Caminho `/api/v1/<dominio>/<recurso>`; parâmetro de caminho como `:id` com `parametros`.
- Os tipos saem dos schemas (`z.infer`, `SaidaDe<typeof c.obter>`); não escreva o tipo à mão.
- Mensagens de validação em português (o `z` de `@erp/shared/zod` já vem com pt-BR).

## 4. Tabela — `apps/api/src/db/schema/dominio/<agregado>.ts`

- `empresaId: empresaId()` (de `./_comum`) e `...politicasDeEmpresa("<tabela>", t.empresaId)`.
  Cadastro que a Plataforma também administra: `politicasDeEmpresaComPlataforma`. Regra
  especial: `politicas("<tabela>", { select, insert, update, delete })` com `daEmpresa`,
  `ehPlataforma` (ver `feriados.ts`).
- `atualizadoEm()` é gravado pelo backend no UPDATE (não há gatilho).
- **Proibido** no banco: função, gatilho, view materializada, extensão, cron.
- Exporte em `dominio/index.ts`, rode `bun run db:gerar` em `apps/api` (só gera o SQL; não conecta) e confira o
  arquivo novo em `apps/api/drizzle/`. Índice ou parâmetro que o Drizzle não expressa:
  `bunx drizzle-kit generate --custom --name <nome>` e escreva o SQL à mão (só índice/parâmetro).
- O teste `apps/api/src/db/schema/rls.test.ts` falha se a tabela com `empresa_id` vier sem RLS.

## 5. API — `apps/api/src/modulos/<dominio>/`

**`casos-de-uso.ts`** — orquestra; é onde mora a decisão.

- Declara a porta `Repositorio<Dominio>` (interface) que ele usa.
- Cada caso de uso recebe `db: Executor<"<dominio>" | "auditoria">` (de `../../repositorios`):
  tudo o que roda dentro de `db(async ({ <dominio>, auditoria }) => ...)` é uma transação só, já
  com o contexto da empresa (RLS).
- Escrita grava auditoria na mesma transação (`auditoria.registrar(ator, {...})`).
- Erros para o operador: `naoEncontrado`, `semPermissao`, `conflito` (`../../http/erros`).

**`repositorio.ts`** — Drizzle, consultas set-based, nenhuma regra escondida.

- `criarRepositorio<Dominio>(tx: Transacao): Repositorio<Dominio>`.
- Registre em `apps/api/src/repositorios.ts` (`Repositorios` + `criarRepositorios`).
- Consulta ampla tem teto (`.limit(...)`) e o timeout do banco vira "reduza o período" sozinho
  (tratador central).

**`rotas.ts`** — HTTP fino: schema do contrato, guardas, chama o caso de uso.

```ts
const ler = [exigirModulo("<modulo>"), exigirTela("<tela>")];
app.get(
  c.obter.caminho,
  { schema: { querystring: c.obter.entrada, response: { 200: c.obter.saida } }, preHandler: ler },
  async (request) =>
    obterCalendario(request.db, await contextoDe(request), request.query.ano, agora()),
);
```

- Guardas (`../../http/guardas`): `exigirAutenticacao` (já implícita nas outras),
  `exigirEmpresa`, `exigirTela`, `exigirModulo`, `exigirPapel`, `exigirAdminPlataforma`.
- Registre o plugin em `apps/api/src/app.ts`.

**Testes**

- `casos-de-uso.test.ts`: regra com repositório falso.
- `rotas.test.ts`: contrato por `app.inject` com `construirAppDeTeste` e `BancoEmMemoria`
  (`apps/api/src/testes/`): 401 sem sessão, 403 sem tela/módulo/papel, 422 entrada inválida,
  caminho feliz e auditoria. Nada contra banco ou Redis reais.

## 6. Tela — `apps/web`

- Rota: `src/routes/_autenticado/<caminho>.tsx` só aponta para a página em
  `src/modulos/<dominio>/`. O caminho é o mesmo de hoje (`CAMINHO_DA_TELA` em
  `@erp/shared/acesso/telas`): a guarda e o menu saem dele sozinhos.
- Dados: `queryOptions` com `chamar(contrato, { parametros, entrada })` de `@/lib/api` (token,
  renovação e erro padrão já tratados). Depois de gravar, `invalidateQueries` da chave do
  domínio. Não mude a política de cache do `roteador.tsx` (contorno de timeout).
- Permissão na tela vem do acesso (`useSuspenseQuery(consultaAcesso)`): `ehAdminDaEmpresa(papel)`,
  `adminPlataforma`, `telas`. A API confere de novo; a tela só esconde botão.
- Formulário com `react-hook-form` + `zodResolver`, reaproveitando o schema do contrato e a regra
  do `src/dominio` (cópia do web; ver `ModalDeFeriado.tsx`).
- Mesmo visual do sistema atual: copie classes e textos da tela de referência; componentes em
  `src/componentes/ui` (shadcn).
- Teste de lógica pura (`*.test.ts`) e de componente com lógica (`*.test.tsx`, Testing Library).

## Checklist do domínio portado

- [ ] Regras e decisões do dono lidas; diferenças propositais anotadas em ADR.
- [ ] Cálculos em `apps/api/src/dominio`, com origem citada e testes dos casos-limite.
- [ ] Contratos zod em `apps/api/src/shared/contratos/<dominio>.ts`, copiados para `apps/web/src/shared`.
- [ ] Tabelas com `empresa_id`, RLS por helper, exportadas; migration gerada e revisada; nada de
      função/gatilho/matview/extensão.
- [ ] Casos de uso com transação única, auditoria nas escritas, mensagens para o operador.
- [ ] Repositório registrado em `repositorios.ts`; rotas registradas em `app.ts`.
- [ ] Toda rota com guarda de tela e módulo (e papel quando grava).
- [ ] Testes de contrato: 401, 403, 422, caminho feliz.
- [ ] Tela no caminho de hoje, com o visual de hoje; ações escondidas para quem não pode.
- [ ] `bunx tsc` em cada pacote, `bunx eslint .`, `bunx prettier --check .`, `bunx vitest run` e
      `bunx vite build` (web) passando.
