# CLAUDE.md — ERP SSW

Leia `docs/arquitetura.md` antes de qualquer coisa. Resumo do que não se negocia:

- Regra de negócio no backend (`packages/dominio` + casos de uso da API). O banco só guarda
  dados + RLS: **nunca** criar função, gatilho, view materializada, cron ou extensão no banco.
- A ingestão do SSW (FTP, BI2, webhook, XML, projeções do Romaneio) é o **worker-ssw**, outro
  repositório (pasta `worker-ssw` ao lado desta), ADR 0012. Aqui ficam só as telas (leem o banco)
  e o cliente do HTTP interno dele (`apps/api/src/infra/worker-ssw.ts`, contrato em
  `packages/shared/src/contratos/worker-ssw.ts`). Mudança de regra do núcleo do CT-e vai aos dois.
- O usuário não pode perceber diferença em relação ao sistema atual (telas, números, URLs, textos,
  exportações, login). A especificação está em `docs/regras/`; a referência é o repo `fr-transportes`
  e `C:\Users\Matheus Carvalho\Desktop\erp-ssw-referencia\`.
- Banco do ERP: Supabase `phjsyaeeklnzkxzdmrmn` (projeto `erp-ssw`), schema `erp`, já com os dados.
  As regras saíram do DEVELOP do sistema atual (`vyockehhhvomqcjqnuwb`, só referência). **Nunca** o
  projeto de produção do sistema atual (`quyrhwmfbqikkpmiivuq`). Não escrever no schema `public`.
- Português no domínio, rotas, UI e erros. TS strict, sem `any`, sem código morto.
- bun (nunca npm). Cada agente trabalha num worktree em `.worktrees/<nome>` com branch própria;
  só o coordenador faz merge na `main`.
