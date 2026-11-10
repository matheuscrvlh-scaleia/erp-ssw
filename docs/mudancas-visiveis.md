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

## Performance e relatório de período (`/performance`, spec 02)

- **Q01 — relatório com a escala certa.** No Relatório de período, SLA de Pontualidade, SLA
  Operacional e SLA Cliente aparecem em 0–100% (antes "1,0%" no lugar de "95,0%" em parte dos
  cartões); os nomes dos indicadores ficam como estão.
- **Q10 — unidade responsável que não é da empresa não mostra nada.** Filtro por filial que não é
  própria (ex.: link antigo) devolve a tela vazia em vez de ignorar o filtro.
- **Q11 — dia de Brasília.** A faixa de vencimento dos Previstos, o atraso, o "vencendo em 48 h" e o
  TDE "em rota" usam o dia de Brasília (antes o dia UTC, que virava às 21h).
- **Q13 — TDE e exportação seguem o filtro de Ocorrência.** O card "TDE aguardando programação" e o
  "Exportar" da tela respeitam o filtro de códigos, como os demais cards.
- **Q15 — frete romaneado contado uma vez.** O "Prejuízo" soma o frete de cada CT-e com saída para
  entrega (85) uma vez só, mesmo com várias 85; só CT-e com 85 entram no prejuízo.
- **Q16 — taxa de retorno pelos concluídos.** Numerador e denominador usam só CT-e concluídos
  (entregues ou baixados); antes o numerador contava também os em aberto.
- **Q18 — exportação sem cancelados e cópias.** O "Exportar" da tela deixa de fora CT-e cancelados
  no dia e cópias (duplicados), como os cards.
- **Q22 — baixa pelo cadastro da empresa.** "Finalizado em Sistema" usa os códigos de baixa do
  cadastro de códigos da empresa, não uma lista fixa.
- **Q26 — sem recorte por usuário.** A tela mostra a empresa inteira para quem tem acesso (como hoje).
