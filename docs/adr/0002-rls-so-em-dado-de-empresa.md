# ADR 0002 — RLS nas tabelas com `empresa_id`; identidade sem RLS

**Status:** aceita (10/11/2026)

## Contexto
A arquitetura pede RLS em toda tabela de dado de cliente, lendo `current_setting('app.*')`.
As tabelas de identidade (`usuarios`, `sessoes`, `tokens_senha`, `identidades_externas`,
`plataforma_admins`) e os catálogos globais (`cargos`, `cargo_telas`, `telas`, `modulos`,
`modulo_telas`) são lidos **antes** de existir contexto: login, refresh, redefinição de senha.

## Decisão
- RLS (`ENABLE` + políticas por operação para `erp_app`) em toda tabela com `empresa_id`. O
  teste `packages/db/src/schema/rls.test.ts` falha se uma tabela nova com `empresa_id` vier sem
  política de leitura.
- Duas famílias de regra (`packages/db/src/schema/base.ts`):
  - `politicasDeEmpresa`: só a empresa da sessão (dado operacional — a Plataforma, mesmo com
    `app.plataforma = on`, não mistura empresas).
  - `politicasDeEmpresaComPlataforma`: empresa da sessão **ou** Plataforma (cadastros que a
    equipe da Plataforma administra: departamentos, vínculos, exceções).
- Casos especiais declarados na própria tabela: `empresas` (o usuário vê as empresas em que tem
  vínculo, para o seletor), `empresa_usuarios` (o usuário lê os próprios vínculos),
  `empresa_modulos`/`empresa_integracoes` (empresa lê, só a Plataforma escreve), `auditoria`
  (sem UPDATE/DELETE), `feriados` (nacional com `empresa_id` nulo, legível por todos).
- Identidade e catálogos globais **sem RLS**; quem protege é a API (e o catálogo só é escrito
  pelo papel de migração — `REVOKE` na migration `0001_permissoes_app.sql`).
- Os papéis `erp_app` e `erp_migracao` são criados uma vez pelo DBA
  (`packages/db/bootstrap/papeis.sql`), não por migration, porque precisam de LOGIN e senha.

## Consequências
- Sem contexto (`comContexto` não chamado) nenhuma linha de empresa aparece: o erro é "vazio",
  nunca vazamento.
- Consultas da Plataforma com `app.plataforma = on` em tabelas "com Plataforma" precisam filtrar
  `empresa_id` explicitamente (a política não filtra por ela).
