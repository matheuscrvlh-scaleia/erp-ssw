# CLAUDE.md — ERP SSW

Leia `docs/arquitetura.md` antes de qualquer coisa. Resumo do que não se negocia:

- Regra de negócio no backend (`packages/dominio` + casos de uso da API/worker). O banco só guarda
  dados + RLS: **nunca** criar função, gatilho, view materializada, cron ou extensão no banco.
- O usuário não pode perceber diferença em relação ao sistema atual (telas, números, URLs, textos,
  exportações, login). A especificação está em `docs/regras/`; a referência é o repo `fr-transportes`
  e `C:\Users\Matheus Carvalho\Desktop\erp-ssw-referencia\`.
- Banco de desenvolvimento: Supabase DEVELOP (`vyockehhhvomqcjqnuwb`), schema `erp`. **Nunca** o
  projeto de produção (`quyrhwmfbqikkpmiivuq`). Não escrever no schema `public` (é o sistema atual).
- Português no domínio, rotas, UI e erros. TS strict, sem `any`, sem código morto.
- bun (nunca npm). Cada agente trabalha num worktree em `.worktrees/<nome>` com branch própria;
  só o coordenador faz merge na `main`.
