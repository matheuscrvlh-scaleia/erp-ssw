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

## Ocorrências, Comprovantes, Coletas, Histórico e Admin › Códigos (spec 04)

- **Q04 — contagens reais.** A frequência de 30 dias em Admin › Códigos é a contagem real (antes,
  amostra); o Histórico avisa quando o período passa do teto da tela, em vez de cortar calado.
- **Q06 — ordem numérica.** Na lista de Ocorrências, número de CT-e e atraso ordenam como número;
  "sem atraso" fica sempre no fim.
- **Q07 — desempate fixo.** Linhas empatadas na ordenação saem sempre na mesma ordem (antes, ao
  acaso entre uma página e outra).
- **Q09 — anotação só pelo autor ou admin.** Outro usuário vê a anotação, mas não edita nem exclui
  ("Só o autor ou um administrador pode alterar esta anotação.").
- **Q10 — busca literal.** `%` e `_` digitados na busca valem como texto; o total da lista vem certo
  mesmo além da última página; feriado repetido avisa "Já existe um feriado igual nesta data."
- **Q11 — dia de Brasília.** Atalhos de período e o dia de Comprovantes (data de conclusão efetiva)
  seguem o dia de Brasília, não o do navegador.
- **Q21 — quarentena fora.** Ocorrência em quarentena não entra no painel de Ocorrências, no 88 de
  Comprovantes nem na frequência de Admin › Códigos.
- **Q24 — 050 sem duplicar.** A coleta é única por unidade + número; reimportar o mesmo 050 regrava,
  e dentro do arquivo vale a última linha.
- **Q31 — histórico do código só da empresa ativa** em Admin › Códigos.
- **Q32 — anotações auditadas.** Criar, editar e excluir anotação fica no registro de auditoria.
- **Q48 — "22 códigos" vira configuração.** O texto "recorte: N códigos de pendência" mostra quantos
  a empresa acompanha (catálogo menos `ocorrencias_codigos_fora_da_tela`), não um número fixo.
- **Conferente na Ocorrências.** O seletor lista só os conferentes do romaneio mais recente de cada
  CT-e (antes, qualquer conferente que já apareceu no 036).
- **050 importado em /coletas.** O administrador da empresa importa o relatório 050 (impresso ou
  CSV) pelo botão "Importar 050" da própria tela; antes era só por Admin · Importação SSW.
- **Histórico › Feriados com a regra do Calendário.** Municipal exige cidade e UF e a descrição tem
  ao menos 3 letras; o nacional cadastrado pela Plataforma aparece sem editar/excluir (Q28).
