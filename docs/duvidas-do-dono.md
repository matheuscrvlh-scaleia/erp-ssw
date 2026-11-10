# Dúvidas para o dono — sistema novo do painel FR

Consolidado em 10/11/2026 a partir das dúvidas das especificações (`docs/regras/00` a `06`) e das
pendências de `docs/dados/modelo.md`. Perguntas repetidas entre as especificações viraram uma só.

> **DECIDIDO em 10/11/2026:** o dono delegou ("faça o que achar melhor em cada uma das opções").
> **Vale a RECOMENDAÇÃO de cada item, de Q01 a Q55.** O texto "o que o sistema novo faz até a
> resposta" abaixo fica só como histórico do comportamento atual. Toda mudança de número em relação
> ao sistema atual que decorre dessas decisões vai listada em `docs/mudancas-visiveis.md` (para
> avisar os usuários na virada e para a comparação lado a lado — Q52).

Regra antiga (antes da decisão): o sistema novo fazia **igual ao de hoje**, salvo falha de segurança
(Q28 e Q29).

Os exemplos marcados "ilustrativo" mostram o tipo de efeito; os números não foram medidos.

---

## Resumo: as 10 mais importantes

| # | Pergunta | Recomendação |
| --- | --- | --- |
| [Q11](#q11--que-dia-é-hoje-depois-das-21h) | Depois das 21h de Brasília o sistema já conta o dia seguinte em várias telas. Passar tudo para o dia de Brasília? | Sim, tudo de uma vez |
| [Q19](#q19--prazos-configurados-não-valem-para-ct-e-novo) | Prazo configurado no Admin não vale para CT-e que chega depois de a regra ser salva. Aplicar sempre? | Sim, aplicar na chegada do CT-e |
| [Q13](#q13--o-card-diz-um-número-e-a-lista-aberta-por-ele-mostra-outro) | Card e lista aberta pelo card (e a exportação) mostram números diferentes. Unificar? | Sim, a lista segue o card |
| [Q01](#q01--relatório-de-período-mostra-10-no-sla) | Relatório de período mostra "1,0%" onde deveria ser "95,7%". Corrigir? | Sim |
| [Q15](#q15--prejuízo-e-frete-romaneado-contam-ct-e-que-não-saíram-e-frete-em-dobro) e [Q14](#q14--prejuízo-muda-de-período-conforme-a-aba) | Prejuízo: frete contado em dobro, CT-e que nunca saiu entra, e cada aba usa um período. Unificar? | Sim |
| [Q02](#q02--ct-e-de-séries-diferentes-com-o-mesmo-número) | CT-e de séries diferentes com o mesmo número se misturam (detalhe não abre, ocorrência cai no CT-e errado). Identificar sempre por sigla + número? | Sim |
| [Q25](#q25--bi2-alterando-ct-e-em-andamento) | A trava "BI2 nunca altera CT-e em andamento" tem uma brecha. Fechar? | Sim (é a regra que o senhor já decidiu em 09/11) |
| [Q26](#q26--quem-vê-o-quê-restrição-por-unidade-ou-equipe) | Restrição por unidade/equipe: cada tela usa uma regra (hoje ninguém está restrito). Uma regra só? | Sim, portar desligada até haver tela para configurar |
| [Q33](#q33--convite-sem-senha-e-sem-esqueci-minha-senha) | Convidado entra sem criar senha e não existe "esqueci minha senha". Criar? | Sim |
| [Q52](#q52--conferência-lado-a-lado-antes-da-virada) | Rodar o sistema novo ao lado do atual e comparar os números tela a tela antes da virada? | Sim, obrigatório |

---

## 1. Defeitos que o usuário já vê hoje

### Q01 — Relatório de período mostra "1,0%" no SLA

- **Pergunta:** corrigir a escala dos cards "SLA Operacional" e "SLA Cliente" do Relatório de período?
- **Hoje:** o card mostra **"1,0%"** quando o valor certo é **"95,7%"**; a cor verde ("bom") nunca
  acende. Sai errado também no CSV, no Excel e na impressão. As linhas por unidade estão certas.
  Os nomes dos cards também confundem: "SLA Operacional" mede entrega no prazo e "SLA de
  Pontualidade" mede ocorrência penalizante (é o mesmo nome usado na tela Performance).
- **Opções:** a) corrigir a escala e manter os nomes; b) corrigir e renomear; c) manter.
- **Recomendação:** a) — corrigir a escala; manter os nomes, que o time já conhece da tela principal.
- **Até a resposta:** igual a hoje ("1,0%").
- **Ref.:** 02 §1.5, §2.3, §12 itens 1 e 2.

### Q02 — CT-e de séries diferentes com o mesmo número

- **Pergunta:** identificar o CT-e sempre por sigla + número (ex.: CAP033214 ≠ CAS033214) em todo lugar?
- **Hoje:** o número se repete entre séries e várias partes casam só pelo número:
  - o **detalhe do CT-e** (`/ctrc/33214`) mostra "Falha ao carregar CTRC." quando existem dois;
  - no **Romaneio**, placa e setor de um CT-e podem vir do "gêmeo" da outra série, e a aba Hoje pode
    contar o mesmo CT-e duas vezes;
  - a **ocorrência que chega pelo aviso automático do SSW** (webhook) pode cair no CT-e da outra série,
    e às vezes cria CT-e sem sigla.
- **Opções:** a) manter; b) sigla + número sempre que a informação trouxer a sigla; no detalhe, se o
  endereço tiver só o número e houver dois, mostrar os dois para escolher.
- **Recomendação:** b).
- **Até a resposta:** igual a hoje (o banco novo já guarda a sigla; a troca é pequena).
- **Ref.:** 02 §5.1, §12.8; 03 §9.2.2; 06 §10 D1; modelo.md "Princípios" 3.

### Q03 — Clique no cabeçalho da lista do Romaneio não reordena

- **Pergunta:** fazer a lista do Romaneio obedecer à coluna clicada?
- **Hoje:** a lista vem sempre por data prevista de entrega; clicar no cabeçalho só vira a setinha.
- **Opções:** a) manter; b) ordenar pela coluna clicada.
- **Recomendação:** b) — é o que o botão promete.
- **Até a resposta:** igual a hoje.
- **Ref.:** 03 §9.4.1.

### Q04 — Listas cortadas sem aviso, ou com aviso errado

- **Pergunta:** trazer tudo (ou cortar com aviso correto e depois de ordenar)?
- **Hoje:**
  - Romaneio agrupado: corta em 500 linhas, mas o selo diz "até 2000";
  - gaveta da aba Hoje: com mais de 2000 CT-e, corta antes de ordenar (amostra ao acaso);
  - lista do Prazo do parceiro: lê no máximo 8.000 CT-e em ordem qualquer, e o selo diz "truncada em 20k";
  - Histórico (anotações e feriados): mostra no máximo 1.000, sem aviso;
  - Admin › Códigos: a "frequência em 30 dias" é contada sobre 1.000 ocorrências quaisquer (a ordem
    "frequência" e o bloco de pendentes dependem disso);
  - Admin › Prazos configurados: as opções de unidade e parceiro saem de só 1.000 CT-e (pode faltar opção).
- **Opções:** a) manter; b) trazer tudo onde couber, e onde precisar cortar, ordenar antes e dizer o limite certo.
- **Recomendação:** b). Em Prazos configurados podem aparecer opções novas — é o esperado.
- **Até a resposta:** igual a hoje, com os mesmos limites.
- **Ref.:** 03 §9.4.2, §9.4.7, §9.4.9; 04 §11 D6, D11; 05 §9 P10.

### Q05 — Prazo do parceiro mostra datas um dia antes

- **Pergunta:** corrigir as datas da tela Prazo do parceiro?
- **Hoje:** Embarque, Prazo de entrega e Mínimo 48h aparecem **um dia antes** no navegador
  (embarque 05/11 aparece 04/11). A exportação sai certa.
- **Opções:** a) manter; b) corrigir.
- **Recomendação:** b).
- **Até a resposta:** igual a hoje.
- **Ref.:** 03 §9.4.10.

### Q06 — Ordenação por atraso e por número na lista de Ocorrências

- **Pergunta:** ordenar atraso e número de CT-e como número?
- **Hoje:** ao ordenar por atraso, CT-e **sem atraso** podem ficar junto dos atrasados há ~999 dias
  (o banco ignora o sinal de menos ao ordenar texto); ao ordenar por CT-e, "10" vem antes de "9".
- **Opções:** a) manter; b) atraso como número (sem atraso no fim) e CT-e pelo número.
- **Recomendação:** b).
- **Até a resposta:** igual a hoje (mesma ordenação do banco atual, que é `en_US`).
- **Ref.:** 04 §11 D1; 00-ambiente (collation).

### Q07 — Paginação que repete ou pula CT-e

- **Pergunta:** desempatar sempre por um critério fixo quando duas linhas têm a mesma data?
- **Hoje:** na lista de Comprovantes, CT-e entregues na mesma hora podem aparecer em duas páginas ou
  em nenhuma; com duas ocorrências na mesma data e hora, a "situação" do CT-e pode sair de qualquer uma.
- **Opções:** a) manter; b) desempatar pela mais recente gravada (não muda nenhuma contagem).
- **Recomendação:** b).
- **Até a resposta:** desempate fixo — hoje a ordem é ao acaso, então qualquer ordem fixa é "igual a hoje".
- **Ref.:** 01 §14 D8; 04 §11 D3.

### Q08 — Prazo do parceiro: parceiro sem cadastro ou com dois cadastros

- **Pergunta:** corrigir o detalhe do parceiro sem cadastro e a linha duplicada?
- **Hoje:** clicar num parceiro identificado só pelo CNPJ (sem cadastro) dá erro; um CNPJ com dois
  cadastros aparece em duas linhas do ranking; o nome do grupo pode mudar de uma consulta para outra.
- **Opções:** a) manter; b) abrir o detalhe pelo CNPJ, uma linha por CNPJ, nome fixo (o do cadastro mais recente).
- **Recomendação:** b).
- **Até a resposta:** igual a hoje.
- **Ref.:** 03 §9.3.5, §9.4.12.

### Q09 — Anotação de outro autor: "sucesso" sem fazer nada

- **Pergunta:** avisar quando alguém tenta alterar anotação de outro autor?
- **Hoje:** editar ou excluir anotação de outra pessoa mostra "sucesso", mas nada muda.
- **Opções:** a) manter; b) mostrar "Só o autor ou um administrador pode alterar esta anotação."
- **Recomendação:** b).
- **Até a resposta:** igual a hoje (nada é alterado, então não há risco).
- **Ref.:** 04 §11 D8. O registro das anotações em Admin › Logs está em Q32.

### Q10 — Pequenos defeitos de tela

- **Pergunta:** corrigir de uma vez os itens abaixo?
- **Hoje:**
  - lista detalhada: numa página depois da última, o "Total" vira 0;
  - filtro de filial com sigla que não é da FR: o filtro some e a tela mostra **todas** as filiais;
  - busca livre: `%` e `_` digitados funcionam como curinga ("10%" acha "1050");
  - Histórico › Feriados: feriado repetido mostra erro técnico do banco.
- **Opções:** a) manter; b) total correto; filtro inválido mostra lista vazia; busca literal;
  "Já existe um feriado igual nesta data."
- **Recomendação:** b).
- **Até a resposta:** igual a hoje.
- **Ref.:** 02 §3.4, §12.12; 03 §9.4.13, §9.4.14; 04 §11 D9.

---

## 2. Números que mudariam se corrigidos

### Q11 — Que dia é "hoje" depois das 21h

- **Pergunta:** contar o dia sempre pelo horário de Brasília?
- **Hoje:** boa parte do sistema conta o dia pelo relógio internacional, 3 horas à frente. Entre
  21h e meia-noite de Brasília o sistema já está "amanhã". Efeitos:
  - **Previstos** (faixa de vencimento): depois das 21h, o que vence hoje aparece como vencido e o
    que vence amanhã aparece como "hoje";
  - **Comprovantes**: entrega às 22h de 05/11 entra no dia 06/11 (filtro, cobertura e gráfico);
  - coluna "Entrega Realizada" da lista detalhada, tipos de documento do período, "em rota" do TDE;
  - **Romaneio**: saída para entrega (85) entre 21h e meia-noite da véspera da emissão conta como válida;
  - data de saída de membro de equipe gravada depois das 21h vira o dia seguinte;
  - **entrega que chega só com a data** (930, sem hora) é gravada como 21h do dia anterior em Brasília.
  O SLA já foi passado para o dia de Brasília (decisão de prazo ajustado pós-entrega).
- **Opções:** a) manter; b) Brasília em tudo, de uma vez.
- **Recomendação:** b), junto com gravar a entrega "só com data" como meia-noite de Brasília —
  senão essas entregas passariam a cair no dia anterior.
- **Até a resposta:** igual a hoje (o banco atual está em relógio internacional; conferido em 10/11).
- **Ref.:** 00-ambiente; 01 §14 D1; 02 §6, §12.5; 03 §9.1.1; 04 §11 D2; 05 §9 P11; 06 §10 D7.

### Q12 — Base "Conclusão" do Romaneio desloca um dia

- **Pergunta:** corrigir o −1 dia e decidir o que fazer com as bases escondidas?
- **Hoje:** a tela oferece só "Emissão" e "Saída para entrega", mas links antigos ainda aceitam
  "Conclusão", "Embarque" e "Prevista". Na base Conclusão, o CT-e concluído em 05/11 aparece em 04/11.
- **Opções:** a) manter; b) manter as 5 (links antigos seguem funcionando) e corrigir o −1 dia;
  c) retirar as 3 não oferecidas.
- **Recomendação:** b).
- **Até a resposta:** igual a hoje (5 bases, com o −1 dia).
- **Ref.:** 03 §2.2, §9.4.6.

### Q13 — O card diz um número e a lista aberta por ele mostra outro

- **Pergunta:** fazer lista e exportação seguirem sempre a mesma regra do card?
- **Hoje (ilustrativo: card 120, lista 117):**
  - **Romaneio** "Em rota", "Travado", "Somente romaneados": card e lista usam regras diferentes
    quando a saída para entrega tem data inconsistente ou quando a situação vem do SSW e não da ocorrência;
  - **Performance**: a lista descarta filtro de unidade escolhido por cadastro e compara códigos de
    outro jeito;
  - **Prazo do parceiro**: lista e cards decidem a filial de jeitos diferentes (e o Romaneio usa um terceiro);
  - **Exportação da Performance**: filtra a filial por outra coluna e pega CT-e com **qualquer**
    ocorrência do código, não pela situação — sai com mais linhas que os cards.
- **Opções:** a) manter; b) lista e exportação seguem o card. No Romaneio é preciso escolher qual
  das duas regras de "Em rota" vale (a do card ou a da lista).
- **Recomendação:** b), com a regra do card (é a que o time acompanha).
- **Até a resposta:** igual a hoje.
- **Ref.:** 02 §1.13, §7, §12 itens 9 e 10; 03 §3.2, §3.3.2, §9.4.3, §9.4.8.

### Q14 — Prejuízo muda de período conforme a aba

- **Pergunta:** usar o mesmo período para o prejuízo em todas as abas?
- **Hoje:** cards, Hoje, Por viagem e Performance contam só a ocorrência penalizante **dentro do
  período**; a aba Prejuízo conta **em qualquer data**. Ex.: CT-e emitido em 28/10 com avaria lançada
  em 03/11 entra no prejuízo de outubro só na aba Prejuízo.
- **Opções:** a) manter; b) todas pela janela do período; c) todas em qualquer data.
- **Recomendação:** b).
- **Até a resposta:** igual a hoje.
- **Ref.:** 03 §9.4.4.

### Q15 — Prejuízo e frete romaneado contam CT-e que não saíram, e frete em dobro

- **Pergunta:** contar o frete uma vez por CT-e e o prejuízo só de CT-e que saíram para entrega?
- **Hoje:** CT-e de R$ 100 com duas saídas para entrega conta **R$ 200** de "frete romaneado";
  CT-e que nunca saiu, mas tem devolução, entra no prejuízo — embora o card diga "% de romaneados"
  (pode dar prejuízo com 0 romaneado). Romaneio "Prejuízo (%)" e "Entregas prejudicadas" também
  contam CT-e que não saíram; "Performance por carro" exige que tenha saído.
- **Opções:** a) manter; b) frete uma vez por CT-e e prejuízo só de quem saiu, em todas as telas.
- **Recomendação:** b). O percentual de prejuízo vai mudar.
- **Até a resposta:** igual a hoje.
- **Ref.:** 02 §1.5, T5, §12.6; 03 §9.4.5.

### Q16 — Taxa de retorno pode passar de 100%

- **Pergunta:** contar a taxa de retorno sobre a mesma base em cima e embaixo?
- **Hoje:** conta devoluções (13) de **todos** os CT-e, inclusive em aberto, e divide só pelos
  concluídos. Ex.: 100 concluídos, 8 devolvidos entre eles e mais 4 em aberto com 13 → mostra 12% (o certo seria 8%).
- **Opções:** a) manter; b) só concluídos nos dois; c) todos nos dois.
- **Recomendação:** b).
- **Até a resposta:** igual a hoje.
- **Ref.:** 02 §1.3, §12.7.

### Q17 — "Penalizado" no Prazo do parceiro usa outra regra

- **Pergunta:** usar no Prazo do parceiro a mesma regra de penalizado do Romaneio?
- **Hoje:** Prazo do parceiro considera penalizada qualquer ocorrência marcada "penaliza", de
  qualquer código, data ou responsável; o Romaneio exige código penalizante do cadastro, responsável
  FR ou devolução (13). O mesmo CT-e pode ser penalizado numa tela e não na outra.
- **Opções:** a) manter (foi intencional); b) igualar ao Romaneio.
- **Recomendação:** confirmar se foi intencional; se não, b).
- **Até a resposta:** igual a hoje.
- **Ref.:** 03 §9.4.11.

### Q18 — CT-e cancelados e cópias aparecem em algumas telas

- **Pergunta:** tirar CT-e cancelados e cópias (que as telas já escondem) também destas?
- **Hoje:** aparecem na aba **Hoje** do Romaneio, na **exportação da Performance**, na **lista** do
  Prazo do parceiro e no Dashboard antigo. Ex.: CT-e cancelado que estava no romaneio do dia aparece em Hoje.
- **Opções:** a) manter; b) esconder em todas.
- **Recomendação:** b).
- **Até a resposta:** igual a hoje.
- **Ref.:** 02 §6, §7; 03 §9.3.1, §9.4.8.

### Q19 — Prazos configurados não valem para CT-e novo

- **Pergunta:** aplicar a regra de prazo do Admin automaticamente a cada CT-e (ou chegada na unidade) novo?
- **Hoje:** a regra só é aplicada no momento em que se salva, ativa, desativa ou exclui uma regra.
  Ex.: regra "parceiro X: 5 dias" salva em 01/11; CT-e do parceiro X emitido em 03/11 fica com a
  previsão do SSW até alguém mexer de novo nas regras. Além disso: a regra de parceiro sobrescreve
  até CT-e já entregue; e excluir uma regra **apaga** a previsão dos CT-e (ficam sem previsão).
- **Opções:** a) replicar; b) aplicar na chegada do CT-e e da ocorrência de chegada (84), guardar a
  previsão do SSW à parte e voltar a ela quando a regra sair; c) b) e não mexer em CT-e já entregue.
- **Recomendação:** b). Sobre CT-e entregue, decidir se a regra deve valer (c).
- **Até a resposta:** igual a hoje.
- **Ref.:** 01 §6.4, §14 D7.

### Q20 — Datas calculadas que ficam velhas

- **Pergunta:** recalcular sempre que algo que influencia a conta mudar?
- **Hoje:** a data de conclusão não é refeita quando a situação muda por relatório do SSW (só quando
  muda por ocorrência); quando o SSW antecipa a emissão (código 80), o filtro "antes da emissão" usa
  a data velha; trocar o tipo ou a descrição de um código em Admin › Códigos não muda a situação dos
  CT-e que já têm esse código.
- **Opções:** a) manter; b) recalcular sempre.
- **Recomendação:** b), com a conferência de Q52 mostrando os CT-e que mudam.
- **Até a resposta:** igual a hoje.
- **Ref.:** 01 §11.3, §14 D2 e D3.

### Q21 — Ocorrências "em quarentena"

- **Pergunta:** a ocorrência posta de lado por ter data incoerente deve ficar fora de todas as contas?
- **Hoje:** ocorrência com data anterior à emissão do CT-e fica "em quarentena": não define a
  situação do CT-e e some do detalhe, mas **conta** na tela Ocorrências, no "digitalizado" (88) dos
  Comprovantes, na "pendência que trava" e na data de embarque.
- **Opções:** a) manter (foi intencional); b) fora de todas as contas.
- **Recomendação:** confirmar a intenção; se não houver, b).
- **Até a resposta:** igual a hoje.
- **Ref.:** 01 §1 (glossário), §14 D9; 04 §11 D14.

### Q22 — Quais códigos contam como baixa

- **Pergunta:** confirmar que a baixa (finaliza sem entrega) da FR é exatamente 12, 36, 61, 77, 92, 93, 94 e 99?
- **Hoje:** uma parte do sistema lê o cadastro de códigos (de **qualquer** empresa) e outra usa essa
  lista fixa. Se forem iguais, o número não muda.
- **Opções:** a) lista fixa; b) cadastro da própria empresa em todo lugar.
- **Recomendação:** b), depois de confirmar que o cadastro da FR tem exatamente esses 8.
- **Até a resposta:** a lista fixa acima (é o que o usuário vê).
- **Ref.:** 01 §14 D4.

### Q23 — Quais feriados contam nos dias úteis

- **Pergunta:** manter só feriado nacional na conta de prazo em dias úteis?
- **Hoje:** só "nacional" conta; feriado estadual, municipal ou da empresa não pula o dia. Ex.:
  CT-e para cidade com feriado municipal tem o prazo contado como se fosse dia útil.
- **Opções:** a) só nacional; b) nacional + da empresa; c) incluir estadual/municipal do destino.
- **Recomendação:** a) por ora. Quem pode cadastrar nacional está em Q28.
- **Até a resposta:** igual a hoje.
- **Ref.:** 01 §14 D5.

### Q24 — Coletas contadas duas vezes

- **Pergunta:** contar a coleta uma vez só?
- **Hoje:** se o CT-e da coleta tem uma cópia, a coleta conta duas vezes; se a mesma coleta vem
  repetida no arquivo do SSW, fica uma qualquer.
- **Opções:** a) manter; b) ligar ao CT-e que não é cópia, e no arquivo ficar a última linha.
- **Recomendação:** b).
- **Até a resposta:** igual a hoje.
- **Ref.:** 04 §11 D4 e D5.

### Q25 — BI2 alterando CT-e em andamento

- **Pergunta:** fechar a brecha da trava "BI2 nunca altera CT-e em andamento"?
- **Hoje:** a trava (decidida em 09/11) só funciona se o CT-e já recebeu algum dado de relatório do
  SSW. CT-e criado só pelo aviso automático do SSW, ou antigo, ainda pode ter previsão alterada pelo BI2 0017.
- **Opções:** a) manter; b) valer para todos.
- **Recomendação:** b) — é o que o senhor decidiu.
- **Até a resposta:** igual a hoje.
- **Ref.:** 01 §14 D10; 06 §10 D3.

---

## 3. Segurança e acesso

### Q26 — Quem vê o quê (restrição por unidade ou equipe)

- **Pergunta:** usar uma única regra de restrição por unidade/equipe em todas as telas?
- **Hoje:** existem três regras diferentes (umas telas olham um cadastro, outras outro, outras
  nenhum: OTIF, Produção, Previstos, aba Hoje, Motivos de não entrega, Comprovantes). Na prática
  **ninguém está restrito**: nenhuma tela grava unidade ou equipe do usuário, então todos veem tudo.
- **Opções:** a) portar as três como estão; b) uma regra só, desligada até existir tela para configurar; c) não portar.
- **Recomendação:** b).
- **Até a resposta:** todos veem tudo da própria empresa (igual ao que acontece hoje).
- **Ref.:** 02 §0.4, §12.3; 03 §9.3.1, §9.3.2; 04 §11 D13; 05 §9 P6.

### Q27 — Permissão "ver placa" só vale em duas abas

- **Pergunta:** a permissão de ver placa deve valer em todo o Romaneio?
- **Hoje:** a permissão esconde a placa só em Performance Motorista e Ajudante; a mesma placa aparece
  na lista, Hoje, Por viagem, CTRC por carro, Por carro e Prejuízo.
- **Opções:** a) manter (a permissão foi feita para essas duas abas); b) valer em tudo.
- **Recomendação:** perguntar ao time se a placa é sigilosa; se for, b).
- **Até a resposta:** igual a hoje.
- **Ref.:** 03 §3.10, §9.3.3.

### Q28 — Feriados nacionais gerados por qualquer administrador de empresa

- **Pergunta:** quem pode criar feriado nacional (que vale para todas as empresas)?
- **Hoje:** "Gerar nacionais em lote" em Histórico › Feriados grava feriado para **todas** as
  empresas a partir de qualquer administrador de empresa.
- **Opções:** a) manter; b) só a Plataforma cria nacional; c) gravar na própria empresa.
- **Recomendação:** b).
- **Até a resposta:** **b)** — uma empresa mexendo no dado de outra é falha de segurança.
- **Ref.:** 04 §11 D10; modelo.md "Segurança".

### Q29 — Plataforma › Empresa › Usuários mostra cargos e departamentos da empresa errada

- **Pergunta:** listar os cargos e departamentos da empresa que está sendo editada?
- **Hoje:** a tela lista os da empresa de quem opera. Convidar com departamento falha
  ("Departamento inexistente") ou o usuário fica ligado a departamento de **outra empresa**.
- **Opções:** a) manter; b) corrigir.
- **Recomendação:** b).
- **Até a resposta:** **b)** — mistura dados entre empresas.
- **Ref.:** 05 §9 P13.

### Q30 — Cargos e departamentos por empresa

- **Pergunta:** cada empresa terá seus próprios cargos e departamentos, editados por quem?
- **Hoje:** só a Plataforma edita (provisório desde 09/11) e o nome interno de departamento não pode
  se repetir entre empresas.
- **Opções:** a) manter só Plataforma; b) cada empresa edita os seus.
- **Recomendação:** b) — precisa ser decidido antes de montar o banco novo.
- **Até a resposta:** igual a hoje (só a Plataforma).
- **Ref.:** 05 §9 P7.

### Q31 — Logs de integração e histórico de códigos na Plataforma

- **Pergunta:** quem vê os logs de integração do SSW e o histórico de um código?
- **Hoje:** os logs de integração são liberados por um cargo geral antigo; o histórico de um código,
  visto pela Plataforma, mistura alterações de todas as empresas que têm aquele número.
- **Opções:** a) manter; b) logs pelo cargo na empresa ativa; histórico só da empresa ativa.
- **Recomendação:** b).
- **Até a resposta:** logs pelo cargo na empresa ativa (o cargo geral antigo não existe no sistema
  novo; a Plataforma passa a ver); histórico igual a hoje.
- **Ref.:** 05 §9 P9; 04 §11 D12.

### Q32 — Registrar mais ações em Admin › Logs

- **Pergunta:** registrar quando alguém define senha de outro, reenvia convite ou altera/exclui anotação?
- **Hoje:** nenhuma dessas ações fica registrada.
- **Opções:** a) manter; b) registrar (sem guardar a senha).
- **Recomendação:** b). Aparecem linhas novas em Admin › Logs.
- **Até a resposta:** igual a hoje (sem registro).
- **Ref.:** 05 §9 P5; 04 §11 D8.

---

## 4. Login e usuários

### Q33 — Convite sem senha e sem "esqueci minha senha"

- **Pergunta:** o link do convite passa a pedir uma senha, e entra "esqueci minha senha" por e-mail?
- **Hoje:** o convidado entra pelo link sem criar senha; depois só consegue entrar pelo Google ou se
  um administrador definir a senha. Não existe "esqueci minha senha".
- **Opções:** a) manter; b) convite cria a senha + recuperação por e-mail.
- **Recomendação:** b).
- **Até a resposta:** igual a hoje.
- **Ref.:** 05 §9 P1; arquitetura.md (recuperação por e-mail).

### Q34 — Mensagens do login em inglês

- **Pergunta:** traduzir as mensagens do login?
- **Hoje:** aparece "Invalid login credentials" e outras mensagens em inglês.
- **Opções:** a) manter; b) "E-mail ou senha incorretos." e equivalentes.
- **Recomendação:** b).
- **Até a resposta:** igual a hoje.
- **Ref.:** 05 §9 P2.

### Q35 — Entrar com Google usando e-mail não cadastrado

- **Pergunta:** recusar no login quem não foi convidado?
- **Hoje:** o sistema cria uma conta para qualquer conta Google, e a pessoa cai na tela "Sem acesso".
- **Opções:** a) manter; b) recusar no login ("Este e-mail não tem acesso. Peça um convite ao administrador.").
- **Recomendação:** b).
- **Até a resposta:** a pessoa vê "Sem acesso", como hoje.
- **Ref.:** 05 §9 P3.

### Q36 — Usuário criado pela metade

- **Pergunta:** criar usuário "tudo ou nada"?
- **Hoje:** se algo falha no meio do convite, o usuário fica criado com o aviso "Convite enviado,
  mas falhou ao …".
- **Opções:** a) manter; b) tudo ou nada (se o registro em Logs falhar, o convite também não sai).
- **Recomendação:** b).
- **Até a resposta:** b) — o usuário só deixa de ver o aviso de criação parcial.
- **Ref.:** 05 §9 P4.

---

## 5. Ingestão (chegada dos dados do SSW)

### Q37 — Intervalo de leitura do FTP

- **Pergunta:** o intervalo do FTP é um só para todas as empresas, e qual horário vale?
- **Hoje:** a tela deixa escolher o intervalo por empresa, mas vale um só para todas. Produção roda
  a cada minuto, menos nos minutos :00 e :30 — horário que a tela não consegue gerar.
- **Opções:** a) global, horário da produção; b) por empresa, como a tela sugere.
- **Recomendação:** a), e a tela mostra o horário real.
- **Até a resposta:** igual à produção (todo minuto, menos :00 e :30).
- **Ref.:** 06 §4, §10 D6.

### Q38 — Dados do romaneio atualizados na hora, em vez de até 30 minutos depois

- **Pergunta:** atualizar romaneio e telas derivadas assim que o relatório chega?
- **Hoje:** o romaneio do CT-e e as visões do Romaneio são refeitos nos minutos :15 e :45; ficam até
  30 minutos atrás do relatório. Depois disso os números são os mesmos.
- **Opções:** a) manter :15 e :45; b) na hora.
- **Recomendação:** b) — muda o "quando", não o "quanto".
- **Até a resposta:** b) (o número final é o mesmo de hoje).
- **Ref.:** 03 §9.5; 06 §10 D8.

### Q39 — Relatório 050 (coletas) no painel de arquivos

- **Pergunta:** mostrar o 050 no painel de arquivos importados, como os outros?
- **Hoje:** o 050 é importado mas não aparece no painel de arquivos.
- **Opções:** a) manter; b) mostrar.
- **Recomendação:** b).
- **Até a resposta:** igual a hoje.
- **Ref.:** 06 §10 D14.

---

## 6. O que portar ou não

### Q40 — Dashboard antigo (`/dashboard`)

- **Pergunta:** portar o Dashboard?
- **Hoje:** fora do menu (só se chega pelo "Voltar ao dashboard" da página de erro), com números
  inflados, código 90 tratado como retorno, meta que nunca é encontrada e dia pelo relógio internacional.
- **Opções:** a) portar igual; b) portar corrigido; c) não portar (o "Voltar" leva à página inicial).
- **Recomendação:** c). Os botões "Gerar dados demo" e "Testar conexão SSW" não serão portados em nenhum caso.
- **Até a resposta:** não portado (sem link no menu, ninguém usa); a página de erro leva à página inicial.
- **Ref.:** 02 §6, §12.4.

### Q41 — Relatórios BI2 pausados e tela de backfill

- **Pergunta:** portar os relatórios BI2 que estão parados?
- **Hoje:** 0174, 0013/0016, 0220, cadastros e reprocessos estão desligados; o backfill do 0017 roda
  a cada 5 minutos só para responder "pausado". Só o 0017 trabalha.
- **Opções:** a) portar desligados; b) não portar (BI2 só com o 0017); manter o diagnóstico se alguém usa.
- **Recomendação:** b), e retirar o backfill.
- **Até a resposta:** só o 0017.
- **Ref.:** 06 §10 D2 e D4.

### Q42 — Faixa "Integração SSW indisponível"

- **Pergunta:** manter a verificação de hora em hora do acesso ao SSW e a faixa de aviso?
- **Hoje:** com o enriquecimento pelo SSW desligado, o acesso só serve para acender essa faixa.
- **Opções:** a) manter; b) retirar.
- **Recomendação:** b), se ninguém acompanha a faixa.
- **Até a resposta:** igual a hoje.
- **Ref.:** 06 §3.18, §10 D13.

### Q43 — Upload manual de XML de CT-e

- **Pergunta:** portar a tela de upload manual de XML e a fila de "órfãos"?
- **Hoje:** o FTP de XML está desligado, mas a tela segue no ar. Ela não grava a chave da nota
  fiscal (o código diz que deveria).
- **Opções:** a) portar igual; b) portar e gravar a chave da nota; c) não portar.
- **Recomendação:** c) se ninguém usa; senão b).
- **Até a resposta:** igual a hoje.
- **Ref.:** 06 §10 D5.

### Q44 — Importador do 455 antigo (largura fixa)

- **Pergunta:** retirar a leitura e a importação manual do 455 no formato antigo?
- **Hoje:** esse formato não chega desde 25/09 (o 455 vem em CSV).
- **Opções:** a) portar; b) retirar.
- **Recomendação:** b).
- **Até a resposta:** não portado.
- **Ref.:** 06 §10 D9.

### Q45 — Cabeçalho da tela Ingestão

- **Pergunta:** retirar o cabeçalho de "última sincronização" da tela Ingestão?
- **Hoje:** o log de sincronização está vazio desde a Fase 1; só o aviso automático do SSW atualiza
  a "última atividade".
- **Opções:** a) manter; b) retirar, mostrando a última atividade do aviso automático.
- **Recomendação:** b).
- **Até a resposta:** b) (o que aparece é o mesmo dado de hoje).
- **Ref.:** 06 §10 D11; modelo.md "Descartado" (`sync_state`).

### Q46 — Endereços antigos desligados

- **Pergunta:** alguém de fora ainda chama os endereços desligados (`ftp-xml-import`, `ssw-ingest`,
  `enriquecer-85`, `enriquecer-periodo`)?
- **Hoje:** respondem "desativado".
- **Opções:** a) recriar respondendo "desativado"; b) não recriar.
- **Recomendação:** b), depois de conferir nos registros de acesso que ninguém chama.
- **Até a resposta:** não recriados.
- **Ref.:** 06 §10 D12.

### Q47 — Ranking de equipes por regras e bonificação

- **Pergunta:** portar as telas de equipes, bonificação e o link público do ranking?
- **Hoje:** o resultado é **sempre zero**: atribuir CT-e à equipe não grava; nada preenche a equipe
  do CT-e; o piso de performance compara 0,95 com 85 e zera; não há tela para lançar faltas (a regra
  "falta zera o último dia bonificado" nunca age); o ambiente de teste tem 0 regras e 0 membros.
- **Opções:** a) portar igual (sempre zero); b) corrigir e portar; c) não portar agora.
- **Recomendação:** c), e refazer quando houver uso definido.
- **Até a resposta:** igual a hoje (telas portadas, resultado zero).
- **Ref.:** 05 §9 P8 e P12; modelo.md "Descartado" (`bonificacao_calculo`).

### Q48 — Valores fixos da FR viram configuração da empresa

- **Pergunta:** transformar em configuração da empresa o que hoje está fixo para a FR?
- **Hoje:** fixos no sistema: o cliente da TROCA (`00193687`) e as 48 h; a lista de baixa (Q22); as
  opções de "Local. atual" (siglas da FR); o texto "22 códigos" da tela Ocorrências.
- **Opções:** a) manter fixo; b) configuração por empresa, com os valores da FR.
- **Recomendação:** b). Para a FR nada muda na tela.
- **Até a resposta:** valores da FR.
- **Ref.:** 01 §14 D6; 03 §9.3.4; 04 §11 D7.

---

## 7. Retenção de dados

### Q49 — Por quanto tempo guardar os registros técnicos de importação

- **Pergunta:** aceitar estes prazos?
- **Hoje (proposta do sistema novo):** linhas brutas dos relatórios 60 dias; erros de leitura 30
  dias; arquivos, ciclos e aplicações 180 dias; XML 180 dias; execuções de FTP, SSW e avisos
  automáticos 90 dias; execuções do BI2 400 dias. CT-e, ocorrências e cadastros **não expiram**. Da
  base atual só vêm as linhas brutas dos últimos 60 dias. Depois de 60 dias, refazer um dia antigo
  exige baixar o arquivo de novo do FTP.
- **Opções:** a) aceitar; b) prazos maiores (custa espaço).
- **Recomendação:** a) — a base atual fica guardada como arquivo.
- **Até a resposta:** a), já que a base atual continua disponível.
- **Ref.:** modelo.md "Retenção"; de-para.md (staging).

### Q50 — Dados que nenhuma tela usa não vão para o sistema novo

- **Pergunta:** alguém precisa destes dados no futuro?
- **Hoje:** são gravados mas nenhuma tela, exportação ou regra usa: nome e documento do recebedor,
  latitude e longitude da ocorrência, valor da nota, endereço/telefone/e-mail do remetente, motivo e
  data de cancelamento, tomador, data de entrega negociada, ajudantes 2 e 3, fechamentos de
  bonificação já gravados, entre outros.
- **Opções:** a) não levar (ficam na base atual); b) levar os que tiverem uso previsto.
- **Recomendação:** a), e b) para nome do recebedor se houver plano de mostrar no comprovante.
- **Até a resposta:** a) — nada se perde, a base atual fica guardada.
- **Ref.:** modelo.md "Descartado"; de-para.md.

### Q51 — Descartar um ciclo de importação

- **Pergunta:** descartar um ciclo deve apagar todas as linhas importadas nele?
- **Hoje:** apaga quase tudo, mas as linhas do 455 em CSV ficam.
- **Opções:** a) manter; b) apagar tudo do ciclo.
- **Recomendação:** b).
- **Até a resposta:** igual a hoje.
- **Ref.:** 06 §10 D10.

---

## 8. Técnicas de conferência

### Q52 — Conferência lado a lado antes da virada

- **Pergunta:** rodar o sistema novo ao lado do atual e comparar os números tela a tela antes da virada?
- **Hoje:** não existe conferência formal.
- **Opções:** a) virar direto; b) período lado a lado, com relatório dos CT-e que diferem e o motivo
  (cada correção aprovada neste documento explica parte das diferenças).
- **Recomendação:** b).
- **Até a resposta:** b) faz parte do plano.
- **Ref.:** 01 §14 D2; 02 §12.11.

### Q53 — Qual banco é a referência das regras

- **Pergunta:** confirmar que as regras do banco de teste (DEVELOP) são as mesmas da produção?
- **Hoje:** as especificações foram tiradas do DEVELOP, e a produção tem ajustes mais novos (ex.:
  melhorias de desempenho de 03/11 aplicadas só na produção).
- **Opções:** a) comparar as definições dos dois bancos antes de portar cada tela; b) assumir DEVELOP.
- **Recomendação:** a).
- **Até a resposta:** a).
- **Ref.:** 02 §12.11.

### Q54 — Conferências de dados antes de portar

- **Pergunta:** nenhuma decisão de negócio; são verificações que a equipe faz no banco.
- **Hoje / o que conferir:**
  - código de ocorrência com letra (não numérico) faz a consulta atual **falhar**; no sistema novo vira
    "sem código" — conferir se existe algum;
  - hora do relatório 036 sempre no formato `HH:MM` com zero à esquerda (a ordem depende disso);
  - fuso e ordenação do banco: **já conferidos** em 10/11 (relógio internacional e `en_US`).
- **Até a resposta:** o sistema novo trata código não numérico como "sem código".
- **Ref.:** 00-ambiente; 03 §9.1, §9.2.1.

### Q55 — Ajustes internos que não mudam nada na tela

- **Pergunta:** de acordo com estes ajustes invisíveis ao usuário?
- **Itens:** gravar a data de "última alteração" do CT-e (hoje nunca é atualizada); unificar os
  nomes internos `ranking`/`ranking_novo` numa chave só.
- **Recomendação:** sim.
- **Até a resposta:** já feitos (não mudam o que o usuário vê).
- **Ref.:** 01 §14 D11; 05 §9 P13.
