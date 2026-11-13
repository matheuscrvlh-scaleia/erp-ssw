# ADR 0016 — Arquitetura do web

- Situação: aceita (12/11/2026, decisão do dono)
- Complementa: ADR 0013 (web como projeto próprio) e ADR 0014 (a api em MVC); `docs/molde.md` §6

## Contexto

O web já tem uma base boa: a rota só aponta para a página, cada módulo tem um `api.ts` com
`queryOptions` e `chamar(contrato)`, e os filtros vivem na URL com schema zod (`busca.ts`). Mas
cada módulo cresceu do seu jeito:

- arquivos auxiliares com nomes diferentes para a mesma coisa (`textos`, `rotulos`; `pecas.tsx`,
  `componentes.tsx`, `Visoes.tsx`, `Blocos.tsx`; `regras`, `lista`, `niveis`, `cores`);
- mutações (`useMutation`) declaradas dentro dos componentes, cada uma invalidando o cache do seu
  jeito;
- páginas de 700 a 1.100 linhas (`romaneio/AbasDesempenho.tsx`, `ctrc/PaginaCtrc.tsx`,
  `listagem/PaginaListagem.tsx`);
- `hooks/` mistura hook genérico com hook de um módulo só (`use-abrir-cte`);
- módulo importando peça interna de outro (`historico` → `calendario/Visoes`).

A api ficou previsível com o MVC: quem abre um recurso sabe onde está cada coisa. O web precisa da
mesma previsibilidade.

## Decisão

### 1. Pastas

```
apps/web/src/
  main.tsx · router.tsx        entrada e roteador (a política de cache do roteador não muda)
  routes/                      SÓ rota: caminho, schema da busca, página. Nenhuma tela aqui.
  modules/<dominio>/           uma pasta por domínio, com o nome do recurso na api
    <Nome>Page.tsx             a tela: lê a busca, chama as consultas, monta o <Pagina>
    components/                pedaços da tela, um componente exportado por arquivo
    api.ts                     consultas e mutações do módulo (o único que chama `chamar`)
    search.ts                  schema zod dos parâmetros da URL (filtros, página, aba)
    rules.ts                   lógica pura da tela (derivar, agrupar, ordenar)
    texts.ts                   rótulos, mensagens e formatação de exibição
    export.ts                  colunas e linhas do Excel/PDF
    *.test.ts(x)               ao lado do arquivo testado
  components/
    ui/                        shadcn (gerado; só tema)
    common/                    peça usada por 2+ módulos (Page, DataTable, Filters, KpiCard...)
    layout/                    casca: menu, cabeçalho, <Pagina>
  access/                      sessão, guarda de rota, inatividade, permissão (`usePermissao`)
  hooks/                       hook usado por 2+ módulos
  lib/                         infraestrutura sem tela: `chamar`, exportação, datas, tema
  domain/ shared/              cópias da api (ADR 0013): não se editam aqui
```

Os nomes `api`, `search`, `rules`, `texts` e `export` são fixos. Um módulo só cria o arquivo
de que precisa. Tipo que só um arquivo usa fica nele; tipo do contrato vem de `@erp/shared`.

### 2. Paralelo com a api

| api (MVC) | web | O que faz |
| --- | --- | --- |
| contrato (`views/contracts`) | o mesmo contrato (`shared/contracts`) | forma da entrada e da saída |
| controller | `api.ts` | a única porta para a rede |
| model / `domain` | `rules.ts` / `@erp/domain` | cálculo; o que vale nos dois lados mora em `domain` |
| view | `texts.ts` + componentes | como o dado aparece |

### 3. Onde fica cada estado

| Estado | Onde | Exemplo |
| --- | --- | --- |
| Dado do servidor | TanStack Query (`api.ts`) | lista de CT-e, calendário |
| Filtro, página, aba, ordenação | URL, validada por `search.ts` | `?periodo=mes&unidades=...` (link compartilhável, igual ao de hoje) |
| Formulário | react-hook-form + `zodResolver` com o schema do contrato | modal de feriado |
| Efêmero da tela | `useState` no componente | modal aberto, linha expandida |
| Sessão e empresa ativa | `acesso/` | token, permissões |

Não há store global (Zustand, Redux, Context de dado). Se parece precisar de um, o estado é da
URL ou do servidor.

### 4. `api.ts`: consultas, mutações e chaves

```ts
export const chaves = {
  tudo: ["calendario"] as const,
  ano: (ano: number) => [...chaves.tudo, ano] as const,
};

export const consultaCalendario = (ano: number) =>
  queryOptions({ queryKey: chaves.ano(ano), queryFn: () => chamar(c.obter, { entrada: { ano } }) });

export const mutacaoCriarFeriado = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (entrada: EntradaDe<typeof c.criar>) => chamar(c.criar, { entrada }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.tudo }),
  });
```

- Chaves numa fábrica `chaves`, começando pelo nome do módulo. Escrita invalida a chave do módulo
  (ou a mais estreita que cubra tudo o que mudou).
- Mutação declarada no `api.ts` com `mutationOptions`; o componente só faz
  `useMutation(mutacaoX(cliente))` e mostra o resultado (toast de sucesso; o erro já vem traduzido
  por `chamar`).
- Ninguém fora do `api.ts` chama `chamar` nem `fetch`.

### 5. Página e componentes

- Toda tela usa `<Pagina titulo descricao acoes filtros abas>` (`components/layout/Page.tsx`):
  cabeçalho, ações à direita e filtros grudados no topo saem iguais em todas.
- A página orquestra: lê a busca, chama as consultas, passa dado pronto aos componentes. Componente
  de `components/` recebe props e não lê a URL nem a rede (exceção: o que carrega sob demanda,
  como a linha do tempo expandida, que usa a consulta do `api.ts`).
- Carregando, vazio e erro sempre com as peças comuns (`LinhasCarregando`, `EstadoVazio`,
  `MensagemErro`, `ErroDeRota`, nos arquivos `LoadingRows`, `EmptyState`, `ErrorMessage` e
  `RouteError`).
- Arquivo passou de ~300 linhas ou faz duas coisas: quebre em `components/`.
- Permissão: `usePermissao(tela, acao)` só esconde o botão; a api confere de novo.
- Visual de hoje: classes e textos copiados da tela de referência; cores e espaços pelos tokens do
  Tailwind, sem hex solto.

### 6. Dependências entre pastas

```
routes → modules/<x>/<Nome>Page → modules/<x>/{components, api, search, rules, texts}
                                 → components/{common, layout, ui}, access, hooks, lib, @erp/*
```

- Um módulo não importa arquivo interno de outro. Peça usada por dois módulos sobe para
  `components/common` (ou `hooks/`, `lib/`). Consulta de outro módulo pode ser usada, pelo `api.ts`
  dele.
- `components/common`, `hooks` e `lib` não importam de `modules/`.
- Essas regras entram no ESLint (`no-restricted-imports`), para não depender de revisão.

### 7. Nomes

- Componente: `PascalCase.tsx`, um exportado por arquivo, nome que diz o que é: `<Nome>Page`,
  `<Nome>Modal`, `<Nome>Tab`, `<Nome>Table`, `<Nome>Filters`, `<Nome>Chart`.
- Lógica: minúsculo (`rules.ts`, `texts.ts`); hook: `use-<nome>.ts` exportando `use<Nome>`.
- Arquivos e pastas em inglês (ADR 0017); o código dentro deles (identificadores, textos) segue
  em português, como na api.

### 8. Testes

- `rules.ts`, `search.ts`, `texts.ts` e `export.ts` têm teste (`*.test.ts`).
- Componente com lógica (filtro, formulário, permissão) tem teste com Testing Library
  (`*.test.tsx`). Componente só visual não.

## Consequências

- Quem abre qualquer módulo acha o mesmo mapa; o `molde.md` §6 passa a apontar para este ADR.
- Migração aos poucos, um módulo por vez, sem mudar tela, URL nem texto: renomear auxiliares
  (`rotulos` → `textos`, `pecas`/`componentes.tsx`/`Visoes`/`Blocos` → `componentes/`), levar as
  mutações para o `api.ts`, quebrar as páginas grandes. Começar pelos maiores: romaneio, ctrc,
  listagem.
- O ESLint passa a barrar import entre módulos e `chamar` fora do `api.ts`; as exceções de hoje
  saem na migração de cada módulo.
