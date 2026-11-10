# ADR 0003 — Empresa ativa por sessão e setor legado por vínculo

**Status:** aceita (10/11/2026)

## Contexto
No sistema atual a empresa ativa é uma coluna do perfil (`usuarios_perfil.empresa_ativa_id`):
duas abas do admin da Plataforma em empresas diferentes viam a última escolhida nas duas.
O setor legado (`usuarios_perfil.setor`) é global, enquanto papel e departamento já são por
empresa.

## Decisão
- A empresa ativa vai no access token (claim `emp`) e na sessão (`sessoes.empresa_ativa_id`),
  então o refresh mantém a escolha. `usuarios.empresa_preferida_id` guarda a última escolhida
  só para o próximo login. Trocar de empresa reemite o access token e grava a sessão.
- A regra de escolha é a de `empresa_atual()` (preferida se o vínculo vale; senão o vínculo
  ativo mais antigo em empresa ativa/implantação), em `packages/dominio/src/acesso.ts`.
- `setor` passa para `empresa_usuarios` (junto com papel e departamento). A migração de dados
  copia o setor do perfil para cada vínculo.

## Consequências
- Abas diferentes continuam vendo a mesma empresa (o cookie de refresh é um só por navegador),
  mas a troca deixa de depender de uma coluna global do usuário.
