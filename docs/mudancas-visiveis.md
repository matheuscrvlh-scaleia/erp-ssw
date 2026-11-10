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
- **Ranking operacional:** "hoje" dos atalhos de período é o dia de Brasília (Q11), não o do
  navegador; filtros de filial e tipo de CT-e ainda não aparecem na tela (falta a consulta de
  opções da Performance).

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
