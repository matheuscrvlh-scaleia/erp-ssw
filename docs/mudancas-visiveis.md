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


## Performance e relatório de período (`/performance`, spec 02)

- **Q01 — relatório com a escala certa.** No Relatório de período, SLA de Pontualidade, SLA
  Operacional e SLA Cliente aparecem em 0–100% (antes "1,0%" no lugar de "95,0%" em parte dos
  cartões); os nomes dos indicadores ficam como estão.
- **Q10 — unidade responsável que não é da empresa não mostra nada.** Filtro por filial que não é
  própria (ex.: link antigo) devolve a tela vazia em vez de ignorar o filtro. Em Remetente/Destino,
  `%` e `_` digitados são letras e "a||b" ignora o vazio (mesma regra da Listagem, para o card e a
  lista baterem).
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
