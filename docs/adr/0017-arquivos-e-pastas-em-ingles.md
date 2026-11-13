# ADR 0017 — Arquivos e pastas em inglês

- Situação: aceita (13/11/2026, decisão do dono)
- Altera: AGENTS.md ("Português no domínio"), ADR 0014 e ADR 0016 §1 e §7 (nomes de arquivo)

## Decisão

Nomes de arquivo e de pasta de `apps/api` e `apps/web` ficam em inglês: `modules/pickups/PickupsPage.tsx`,
`models/users/users.service.ts`, `domain/core/deadline.ts`. O que vai dentro do arquivo não muda:
identificadores, rotas da api, textos da tela, mensagens de erro e documentação seguem em português.

Ficam como estão:

- `apps/web/src/routes/*`: o nome do arquivo é a URL da tela (TanStack Router), e a URL não muda.
  Só a pasta sem caminho `_autenticado` virou `_authenticated` (não aparece na URL).
- Os arquivos de `apps/api/migrations/`: o nome fica gravado em `migracoes.aplicadas` no banco.
- O schema `migracoes` do banco e os nomes de tabela e coluna.

Os apelidos acompanham as pastas: `@erp/dominio/*` → `@erp/domain/*` (`@erp/domain/core`,
`@erp/domain/ingestion/reports`); `@erp/shared/contratos/*` → `@erp/shared/contracts/*`.

## Consequências

- Componente e arquivo podem ter nomes diferentes (`PickupsPage.tsx` exporta `PaginaColetas`).
- O worker-ssw tem cópias de arquivos daqui: elas passaram aos mesmos nomes em inglês, com os
  apelidos `@erp/domain/*` e `@erp/db/secrets` (worker-ssw 4976df4, README com as origens novas).
