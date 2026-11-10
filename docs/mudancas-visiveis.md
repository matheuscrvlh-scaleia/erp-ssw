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

## Listagem detalhada e detalhe do CT-e (spec 02)

- **Q02 — CT-e pela série + número.** O link da NF na Listagem abre o CT-e certo (`/ctrc/33214?sigla=CAP`).
  Número que existe em mais de uma série, aberto sem a série, mostra a lista para escolher (antes
  abria um ao acaso). A busca "CAP033214" na Listagem procura série e número juntos.
- **Q10 — filtros sem surpresa.** Unidade responsável que não é filial da empresa devolve lista vazia
  (antes ignorava o filtro e mostrava tudo); o total da última página é o real; `%` e `_` digitados
  em Remetente/Destino/Cidade são letras, não curingas.
- **"a||b" não casa mais tudo.** Valor vazio entre barras é ignorado (mesma leitura
  `lerFiltroTexto` da tela e do servidor); antes virava "contém nada" e trazia todos os CT-e.
- **Q11 — dia de Brasília.** "Hoje", "Mês" e os demais atalhos de período, a coluna "Entrega
  Realizada", as faixas de previsão e o "em rota" usam o dia de Brasília, não o do navegador.
- **Q12 — conclusão sem "−1 dia".** O seletor Parceiros com base "Concluídos" usa a data de
  conclusão como está.
- **Q13 — a lista segue o card.** Unidade aberta a partir de um card filtra pelo cadastro da unidade;
  o filtro e o gráfico "Ocorrências" usam o código efetivo do CT-e.
- **Q21 — quarentena fora dos recortes.** Ocorrência em quarentena não conta em nenhum recorte da
  Listagem (código 13, OTIF, TDE, sem atualização...).
- **Q04 — exportação sem teto de 20 mil.** Exporta todas as páginas do filtro; acima de 100 mil
  linhas sai com as primeiras 100 mil e um aviso dizendo quantas ficaram de fora (antes cortava em
  20 mil sem avisar). O PDF da Listagem passa a ser o PDF da empresa (paisagem, todas as colunas),
  não a impressão A4 que escondia seis colunas.
- **Q07 — ordem estável.** Mesma data na ordenação: desempata pelo número do CT-e e pela série; a
  mesma página não muda de uma consulta para outra.
- **Q40 — sem `/dashboard`.** O endereço antigo do Dashboard cai na página "não encontrada", com o
  botão "Ir para o início".
- **Detalhe do CT-e.** O "Status do prazo" usa o dia de Brasília (Q11); "não encontrado" oferece
  só "Voltar" (antes, "Voltar ao romaneio").
