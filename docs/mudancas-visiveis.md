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

## Ingestão SSW — relatórios, FTP, XML CT-e e ciclo (`packages/ingestao`, spec 06)

- **Q02 — CT-e por sigla + número.** A ingestão casa todo relatório pelo par (sigla, número): acabam
  a "série vigente" e o CT-e "estacionado" (`35123/CAS`); o CT-e antigo de outra série segue com
  o número dele e não perde dado nem ocorrência. Na aplicação manual some o ignorado
  `sigla_divergente`.
- **Q11/D7 — entrega só com a data do 930** (sem ocorrência 1/18/67) vira 00:00 de Brasília do dia,
  não mais 21:00 do dia anterior.
- **Q19 — previsão do SSW em CT-e com regra configurada** vai para a previsão guardada do SSW
  (`previsao_ssw_*`) em vez de ser descartada; volta a valer se a regra sair.
- **Q37 — horário do FTP** é o de produção para todas as empresas (todo minuto, exceto :00 e :30) e
  a tela XML CT-e mostra esse horário; o editor de intervalo saiu.
- **Q38 — romaneio do CT-e pelo 036** é calculado direto da staging na aplicação, sem esperar a
  atualização das projeções (até 30 min mais atual).
- **Q39 — 050 aparece no painel de arquivos** do pipeline (registrado como relatório 050).
- **Q43 — XML de CT-e grava a chave da NF-e** quando o CT-e ainda não tem; o upload manual segue na
  tela. Cancelamento por XML marca o status "CANCELADO" (as colunas `cancelado_em` e
  `motivo_cancelamento` não existem mais).
- **Q44 — 455 de largura fixa saiu**: o importador manual e o leitor não existem mais; arquivo
  "455" é lido como 455 CSV.
- **Q46 — rotas que respondiam 410** (`ftp-xml-import`, `ssw-ingest`, `enriquecer-85`,
  `enriquecer-periodo`) não existem: respondem 404. `xml-recuperar-orfaos` também saiu (§9).
- **Q49 — retenção da ingestão**: linhas aplicadas 60 dias, erros de leitura 30, arquivos/ciclos/
  aplicações 180, XML 180, órfãos resolvidos 30 e execuções do FTP 90 (antes, sem limpeza).
- **Q51 — descartar um ciclo apaga também o 455 CSV** do ciclo (antes ficava na staging).
- **`ssw-ciclo-aplicar`** passa a pedir a rodada ao worker e responde `status: "enfileirado"` na
  hora, em vez de esperar a aplicação; `xml-orfaos-retry` exige `x-ftp-ingest-secret` ou
  `x-cron-token` (antes aceitava a chave publicável).
- **Aplicação manual** não roda junto com o ciclo automático: se ele estiver aplicando, a tela
  pede para tentar de novo em instantes.
