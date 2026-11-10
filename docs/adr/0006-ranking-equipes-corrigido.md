# ADR 0006 — Ranking de equipes e bonificação: corrigir e portar (Q47 b)

**Status:** aceita (10/11/2026) — **diverge da recomendação de Q47; confirmar com o dono**

## Contexto
Q47 (`docs/duvidas-do-dono.md`) recomenda **c) não portar agora** as equipes, regras de
bonificação e o link público, porque hoje o resultado é sempre zero: atribuir CT-e à equipe não
grava, o piso de performance compara 0,95 com 85 e zera, e não há tela de faltas. A tarefa da
onda 1 pede o contrário de forma explícita: portar as telas com a atribuição de CT-e "que agora
grava de verdade" e com faltas na bonificação de entrega.

## Decisão
Seguir a tarefa, que corresponde à opção **b) corrigir e portar**:

- **Atribuição em lote grava** `ctes.equipe_id` (`POST /api/v1/ranking/atribuicao`, devolve a
  quantidade) e registra auditoria.
- **Piso de performance** compara na mesma escala: `performance × 100 < performance_minima`
  (`packages/dominio/src/ranking-equipes.ts`).
- **Faltas** ganham tela (quadro "Faltas do mês" em Bonificação de entrega) e API
  (`GET/POST/DELETE /api/v1/bonificacao-entrega/faltas`); a regra "falta zera o último dia
  bonificado antes dela" passa a agir (P12).
- **Link público** guarda só o hash SHA-256 do token (`equipes.token_publico_hash`); o token
  aparece uma vez, ao ser gerado. Rota sem login com limite de 30 consultas/min por IP; o RLS lê
  `app.token_publico_hash` e a equipe só é servida se o módulo `ranking` estiver ativo na empresa.
- Membro removido sai com o **dia de Brasília** (P11).

## Consequências
- Se o dono mantiver a recomendação c), basta não registrar as rotas `rotasRanking` (parte de
  equipes/regras/link) e tirar as telas `admin_equipes`, `admin_bonificacao` e `/ranking/publico`
  do menu; o ranking operacional (`/ranking`) não depende disso.
- Os números deixam de ser zero assim que houver regra ativa, membros e CT-e atribuídos: avisar
  os gestores na virada (ver `docs/mudancas-visiveis.md`, seção Ranking).
- Links públicos antigos não migram (o sistema atual guarda o token em claro): cada equipe precisa
  gerar um link novo.
