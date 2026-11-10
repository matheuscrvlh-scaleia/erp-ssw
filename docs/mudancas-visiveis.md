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

## Romaneio e Prazo do parceiro (spec 03)

- **Q02 — CT-e por sigla + número.** Linha do tempo, lista, gaveta da aba Hoje e detalhe do Prazo do
  parceiro não misturam mais CT-e de séries diferentes com o mesmo número.
- **Q03 — a lista do Romaneio obedece à coluna clicada.** Sem coluna escolhida, continua pela
  previsão de entrega (mais antiga primeiro).
- **Q04 — limites certos.** Romaneio agrupado traz até 2.000 linhas, como o selo diz (antes cortava
  em 500); a gaveta da aba Hoje ordena antes de cortar e mostra "N de M"; a lista do Prazo do parceiro
  é paginada no banco (sem o teto de 8.000) e a exportação avisa quando passa de 20.000.
- **Q05 — datas do Prazo do parceiro sem o dia a menos.** Embarque, Prazo de entrega e Mínimo 48h
  aparecem no dia certo na tela, como já saíam na exportação.
- **Q08 — parceiro sem cadastro abre o detalhe.** O ranking tem uma linha por CNPJ, com o nome do
  cadastro mais recente; clicar num parceiro sem cadastro abre o detalhe pelo CNPJ em vez de dar erro.
- **Q10 — pequenos defeitos.** Página depois da última mantém o total; filial que não é da empresa
  devolve lista vazia (antes mostrava todas); `%` e `_` na busca da lista são texto, não curinga.
- **Q12 — base Conclusão no dia certo.** Links antigos com `ver=conclusao`, `embarque` ou `prevista`
  seguem funcionando; na Conclusão o CT-e não aparece mais um dia antes.
- **Q13 — lista e exportação seguem o card.** "Em rota", "Travado" e "Somente romaneados" da lista
  usam a regra dos cards; a lista do Prazo do parceiro usa o mesmo universo de filial dos cards.
- **Q14 — prejuízo pela janela do período em todas as abas.** A aba Prejuízo deixa de contar
  ocorrência penalizante lançada fora do período (ex.: emitido em 28/10, avaria em 03/11 só entra
  em novembro).
- **Q15 — frete uma vez por CT-e e prejuízo só de quem saiu.** "Frete romaneado" não soma em dobro
  CT-e com duas saídas; Prejuízo (%), Entregas prejudicadas e Frete perdido contam só CT-e que saíram
  para entrega. O percentual de prejuízo muda.
- **Q18 — cancelados e cópias fora da aba Hoje e da lista do Prazo do parceiro.**
- **Q38 — Romaneio atualizado na chegada do relatório.** As visões por viagem e por CT-e são
  recalculadas quando o 036/930/306/038/455 chega, em vez de nos minutos :15 e :45.
- **Q48 — valores fixos viram configuração** (peso e volume de "carga pesada"/"alto volume", prazo
  padrão do parceiro, meta e alerta de SLA). Para a FR nada muda na tela.
