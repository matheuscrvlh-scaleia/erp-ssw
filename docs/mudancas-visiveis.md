# Mudanças visíveis em relação ao sistema atual

O que o usuário pode notar de diferente, e por quê. Cada linha vem de uma decisão do dono em
`docs/duvidas-do-dono.md` (vale a recomendação de Q01–Q55). Serve para avisar os usuários na virada e
para explicar as diferenças da conferência lado a lado (Q52). Uma seção por domínio.

## Núcleo do CT-e (`packages/dominio/src/nucleo`, spec 01)

- **Q11 — "hoje" é o dia de Brasília.** Depois das 21h, o bloco "Previstos" não mostra mais o que
  vence hoje como vencido; o atraso e o "sem movimento" já eram por Brasília. "Em rota" do Romaneio
  passa a aceitar a saída para entrega (85) só a partir da meia-noite de Brasília do dia da emissão
  (antes, a partir das 21h da véspera).
- **Q19 — prazo configurado vale sempre.** A regra de prazo do Admin (unidade, transbordo, parceiro)
  é aplicada a cada gravação do CT-e e a cada chegada (84), inclusive em CT-e novo. Quando a regra
  sai (desativada/excluída), o CT-e volta à previsão do SSW em vez de ficar sem previsão. A regra de
  parceiro continua valendo para CT-e já entregue.
- **Q20 — derivados sempre atualizados.** Data de conclusão, ocorrência efetiva e prazo mínimo são
  recalculados em toda gravação; quando a 80 antecipa a emissão, o filtro "antes da emissão" usa a
  emissão nova; trocar tipo SSW ou descrição de um código em Admin › Códigos recalcula a situação
  dos CT-e com esse código.
- **Q21 — quarentena fora de todas as contas do CT-e.** Ocorrência em quarentena não conta mais na
  "pendência que trava", na data de embarque, no "status atual", no cancelado no mesmo dia nem na
  chegada (84) dos prazos configurados.
- **Q07 — empate de horário.** Duas ocorrências no mesmo instante: vale a gravada por último
  (antes, ao acaso), na ocorrência efetiva e no status atual. Duas regras de prazo do mesmo tipo
  para o mesmo CT-e: vale a criada por último.
- **Q22 — baixa pelo cadastro da empresa.** Atraso, "baixado sem entrega" e data de conclusão usam
  os códigos com tipo BAIXA do cadastro da própria empresa (antes: lista fixa num lugar e cadastro
  de qualquer empresa noutro). Para a FR o número não muda se o cadastro tiver exatamente 12, 36,
  61, 77, 92, 93, 94 e 99.
- **Q23 — dias úteis.** Só feriado nacional pula o dia; um "nacional" cadastrado por outra empresa
  não vale mais para todas.
- **Q25 — BI2 nunca altera CT-e em andamento**, inclusive CT-e que ainda não recebeu nenhum dado de
  relatório do SSW.
- **Q48 — valores fixos da FR viram configuração** (`raiz_cnpj_troca` = 00193687, `prazo_padrao_dias`
  = 2). Para a FR nada muda na tela.
- **Q54 — código de ocorrência com letra** na coluna do SSW conta como "sem código" na saída para
  entrega, em vez de derrubar a consulta.

## Ranking, equipes, bonificação e ponto (spec 05 §5–7)

- **Q47 — atribuir CT-e à equipe grava de verdade** (Admin › Equipes, "Atribuir (n)"); antes o aviso
  aparecia e nada mudava. Com regra ativa, membros e CT-e atribuídos, o valor da equipe deixa de ser
  sempre zero. Ver ADR 0006 (diverge da recomendação c) de Q47; confirmar com o dono).
- **Q47 — piso de performance na escala certa.** "85" no piso passa a significar 85%; antes 95% de
  performance (0,95) era comparado com 85 e o valor sempre zerava.
- **P12 — faltas têm tela.** Quadro "Faltas do mês" em Bonificação de entrega (registrar, listar,
  excluir); a falta zera o bônus do último dia bonificado antes dela, como a regra já previa.
- **Link público do ranking só aparece ao ser gerado.** O banco guarda só o hash: "Copiar link"
  funciona na hora; depois aparece "Gerar novo link" (troca o anterior). Links antigos param de
  valer na virada e precisam ser gerados de novo. Limite de 30 consultas por minuto por IP.
- **P11 — saída do membro no dia de Brasília** (antes, depois das 21h gravava o dia seguinte).
- **Q11 — dia de Brasília nas contas das equipes e da bonificação:** "entregue no prazo" compara o
  dia da entrega em Brasília com o prazo, e a "ocorrência do dia do romaneio" usa o dia de Brasília.
- **Q21 — quarentena fora:** ocorrência em quarentena não conta como penalizante no ranking de
  equipes nem como desfecho da NF na bonificação de entrega.
- **Bonificação de entrega lê os romaneios já processados:** romaneio cancelado no SSW não entra
  mais no bônus; meses antigos continuam apuráveis (antes dependiam das linhas cruas do 036).
- **Empate no ranking público** (mesmo valor) é desfeito pelo nome da equipe, sempre na mesma ordem
  (antes, ao acaso).
- **Q26 — equipes:** quem tem a tela vê todas as equipes da empresa (sem recorte por unidade).
- **Q02 — CT-e como sigla + número** na lista de atribuição (ex.: `CAP123456`).
- **Ranking operacional exporta só CSV por enquanto** (PDF/Excel com a marca voltam com o kit
  comum); filtros de filial e tipo de CT-e ainda não aparecem na tela.
