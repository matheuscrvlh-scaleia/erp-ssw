# ADR 0015 — SQL puro, sem ORM

- Situação: aceita (12/11/2026, decisão do dono)
- Substitui: o Drizzle ORM de `docs/arquitetura.md` e as menções a Drizzle nos ADRs 0008, 0012,
  0013 e 0014 (no ERP; o worker-ssw é outro repositório)

## Contexto

O dono decidiu tirar o ORM da API: o acesso a dados passa a ser SQL escrito à mão. O Drizzle
entrava em três lugares: o schema como código (`src/db/schema`), as consultas dos repositórios e a
geração e aplicação das migrations (`drizzle-kit`).

## Decisão

- **Consultas:** `pg` direto, com a tag `sql` de `@erp/db` (`src/db/sql.ts`). Todo valor
  interpolado vira parâmetro `$n`. Um `Sql` interpolado entra como trecho. Um array vira um único
  parâmetro, com cast explícito (`= any(${ids}::uuid[])`). jsonb passa por `sql.json(...)`.
  Identificador dinâmico só por `sql.identificador`.
- **Transação e contexto:** `Banco.transacao` e `Transacao.consultar` / `executar`. `comContexto`
  faz o `set_config(..., true)` de `app.empresa_id`, `app.usuario_id` e `app.plataforma`, igual a
  antes.
- **Tipos:** date, timestamp, timestamptz e interval chegam em texto, como o Drizzle entregava em
  SQL cru. O repositório converte instantes com `comInstantes` / `instanteDoBanco`. bigint chega em
  texto e numeric fica em texto. Colunas saem em camelCase por `as "campo"`. Nas tabelas largas,
  `camposDaLinha`, `valoresDeInsercao` e `atribuicoes` (`src/db/rows.ts`).
- **Migrations:** arquivos `.sql` escritos à mão em `apps/api/migrations/` (as 17 do drizzle-kit
  vieram sem mudança). `bun run db:migrar` (`src/db/migrate.ts`) aplica, em ordem de nome, as que
  faltam, cada uma na sua transação e sob advisory lock, e anota em `migracoes.aplicadas`. Na
  primeira execução, ele adota como aplicadas as N primeiras, sendo N o número de linhas de
  `drizzle.migracoes_erp`.
- O schema TypeScript some. A fonte da verdade do DDL são as migrations.

## Consequências

- Menos dependências (`drizzle-orm`, `drizzle-kit` e o `esbuild` antigo do ADR 0011 saem).
- O SQL que roda é o que está escrito, sem tradução, e é mais fácil de conferir com `explain`.
- Perde-se a checagem de tipo das colunas: nome de coluna errado só aparece ao executar. Cada
  repositório novo precisa rodar contra o banco antes do merge.
- Tabela nova exige escrever DDL e políticas RLS à mão (`docs/molde.md` §4).
- O worker-ssw mantém a sua cópia Drizzle das tabelas que usa (ADR 0012), o que não muda o
  contrato: a conferência de `information_schema` no boot continua valendo.
