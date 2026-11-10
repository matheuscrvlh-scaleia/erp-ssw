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

## Ingestão SSW: BI2, webhook e SSW API (`apps/worker/src/fontes`, spec 06)

- **Q41 — BI2 só com o 0017.** 0174, 0013/0016, 0220, cadastros, reprocessos e o backfill do 0017
  não existem mais; a tela Ingestão SSW perde os cards de backfill, a "ordem recomendada" e o
  "Rodar D-1" (fica "Rodar data específica" do 0017).
- **Q45 — tela Ingestão sem o cabeçalho explicativo.** Mostra só a última atividade do webhook (o
  mesmo dado de hoje, lido dos eventos recebidos).
- **Q02 — webhook casa o CT-e por sigla + número.** Ocorrência que chega só com o número da NF, ou
  sem sigla, vai para o CT-e mais recente com aquele número; CT-e desconhecido sem sigla não é
  criado e o evento fica "sem vínculo" (antes podia cair no CT-e da outra série e às vezes criava
  CT-e sem sigla).
- **Webhook responde antes de aplicar.** O SSW recebe "OCORRENCIA PROCESSADA COM SUCESSO" assim que
  o evento é autenticado e gravado; a ocorrência entra no CT-e segundos depois (fila). Se a fila
  estiver fora, a resposta é 503 e o SSW reenvia. Na tela, o evento aparece primeiro como
  processado e muda para "sem vínculo" ou "erro" quando o processamento termina.
- **Reprocessar evento** reenvia à fila em vez de responder o resultado na hora ("Evento reenviado
  para processamento").
- **Credenciais da SSW API:** "Última verificação" não diz mais se foi manual ou automática.
- **Diagnóstico SSW** passa a mostrar a situação dos jobs (fila, falhas, próxima execução), as
  sincronizações do BI2, os contadores do webhook (24 h e 7 dias) e os órfãos; saem o teste por
  CNPJ e o teste do trackingdanfe (o enriquecimento pela SSW API está desligado).
- **Guarda do conteúdo bruto do BI2 (`bi2_bruto`) por 400 dias**, como as sincronizações; eventos do
  webhook e sincronizações do SSW, 90 dias.
