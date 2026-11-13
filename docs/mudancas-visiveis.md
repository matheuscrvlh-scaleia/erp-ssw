# Mudanças visíveis em relação ao sistema atual

O que o usuário pode notar de diferente, e por quê. Cada linha vem de uma decisão do dono em
`docs/duvidas-do-dono.md` (vale a recomendação de Q01–Q55). Serve para avisar os usuários na virada e
para explicar as diferenças da conferência lado a lado (Q52). Uma seção por domínio.

## Núcleo do CT-e (`apps/api/src/dominio/nucleo`, spec 01)

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

## Ingestão SSW — relatórios, FTP, XML CT-e e ciclo (hoje no worker-ssw, spec 06)

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
  tela. Cancelamento por XML marca o status "CANCELADO" e a data do cancelamento (`cancelado_em`,
  que a trava do BI2 lê, como hoje); a coluna `motivo_cancelamento` não existe mais.
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

## Ingestão SSW: BI2, webhook e SSW API (hoje no worker-ssw, spec 06)

- **Q41 — BI2 só com o 0017.** 0174, 0013/0016, 0220, cadastros, reprocessos e o backfill do 0017
  não existem mais; a tela Ingestão SSW perde os cards de backfill, a "ordem recomendada" e o
  "Rodar D-1" (fica "Rodar data específica" do 0017).
- **Q45 — tela Ingestão sem o cabeçalho explicativo.** Mostra só a última atividade do webhook (o
  mesmo dado de hoje, lido dos eventos recebidos).
- **Q02 — webhook casa o CT-e por sigla + número.** Ocorrência que chega só com o número da NF, ou
  sem sigla, vai para o CT-e mais recente com aquele número; CT-e desconhecido sem sigla não é
  criado e o evento fica "sem vínculo" (antes podia cair no CT-e da outra série e às vezes criava
  CT-e sem sigla).
- **Q11 — CT-e criado pelo webhook com a emissão no dia de Brasília.** Evento recebido depois das
  21h cria o CT-e com a emissão daquele dia (antes o dia UTC, que já era o seguinte).
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

## Ingestão SSW no worker-ssw (ADR 0012)

Só telas da Plataforma mudam; operação, números e URLs das integrações ficam iguais (a borda repassa
`/api/public/*` ao worker-ssw).

- **Worker-ssw fora do ar ou não configurado:** as telas continuam com o que está no banco; as
  ações (rodar FTP/BI2, testar a SSW API, reprocessar, retomar/descartar ciclo, importar relatório
  ou XML, aplicar, pausar o FTP, liberar a trava) respondem "O worker do SSW não respondeu..." ou
  "Integração com o worker do SSW não configurada.", e o FTP aparece sem trava nem progresso.
- **Importação SSW:** "Na fila" fica sempre 0 (a fila vive no Redis do worker-ssw, fora do
  contrato); "aplicando" vem da situação dos jobs.
- **Diagnóstico SSW:** a situação dos jobs vem do worker-ssw (estado, última e próxima execução);
  some a contagem de atrasados e "últimas falhas" mostra só a falha da última execução.
- **Credenciais da SSW API:** salvar credenciais novas pede ao worker-ssw uma verificação do token
  (antes só apagava o token guardado).
- **Auditoria:** retomar ciclo, importar relatório ou XML e aplicar/simular à mão passam a ficar no
  log de auditoria (antes só descartar, pausar, rodar o FTP e liberar a trava).

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
## Admin, Plataforma, auditoria e convites (spec 05)

- **Sem "Continuar com Google".** Decisão do dono (12/11/2026): o login é só com e-mail e senha. O
  botão some da tela de entrada; quem entrava só pelo Google usa "Esqueci a senha" para criar uma.

- **Q33 — convite cria a senha.** O e-mail de convite leva a `/aceitar-convite`, onde a pessoa cria
  a própria senha (vale 72 h). Na lista de usuários aparece "Convite pendente" e só esses têm o botão
  "Reenviar convite" (quem já tem senha usa "Definir nova senha").
- **Q36 — usuário nunca fica pela metade.** Se o e-mail do convite não sai, nada é gravado e o aviso
  pede para tentar de novo. Em Admin › Usuários, e-mail que já tem conta dá "já cadastrado" (antes
  criava outro); na Plataforma, e-mail com conta só ganha o vínculo com a empresa.
- **Q32 — mais ações em Logs.** Definir senha de outra pessoa e reenviar convite aparecem em Admin ›
  Logs (sem a senha). Definir ou remover senha/token de integração aparece nos Logs da Plataforma.
- **Q19 — prazos configurados.** Salvar, ligar, desligar ou apagar regra não espera mais o recálculo:
  o aviso diz que os CT-e afetados são recalculados em seguida (antes, a tela travava até terminar e
  mostrava quantos CT-e mudaram). Sem regra, o CT-e volta à previsão do SSW.
- **P10 — opções de unidade e parceiro** da regra de prazo vêm de todos os CT-e da empresa (antes,
  só dos 1.000 mais recentes).
- **Q29 — Plataforma › Empresa › Usuários** mostra os papéis e departamentos da empresa editada
  (antes, os da empresa de quem estava operando).
- **Q30 — Roles e Departamentos por empresa.** Cada empresa tem os seus; a mesma chave em duas
  empresas são cadastros diferentes. Empresa nova nasce com Super Admin, Admin, Gestor, Operador e
  Equipe.
- **Q31 — Logs › Integrações** segue o papel na empresa ativa (admin da empresa vê as execuções
  dela; a Plataforma vê de qualquer empresa pela tela da empresa).
- **Segurança (decisão técnica, ADR 0007).** Só Super Admin (ou a Plataforma) dá ou tira o nível
  Super Admin; e-mail e senha de quem é da Plataforma só mudam pela Plataforma; e-mail de Super Admin
  só muda por Super Admin. Definir senha de alguém encerra as sessões abertas dessa pessoa.
  Exceções de tela e telas de role/departamento só aceitam telas da empresa (nunca as da Plataforma
  nem Logs, que vem do nível).
- **Senhas e tokens das integrações** ficam cifrados no banco (AES-256-GCM) e nunca voltam para a
  tela; o cartão mostra só quando foram gravados.
- **Logs › Alterações:** clicar na linha abre o antes e o depois numa janela (antes, abria embaixo
  da linha); as colunas Tipo e Identificador podem ser ligadas em "Colunas" e entram na exportação.
- **Implantação** passa a apontar integração ligada sem senha/token e deixa de listar itens "fase
  seguinte" da migração antiga.
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

## Segurança (revisão da onda 1)

Mudanças que a segurança exige; quem nota é, em geral, quem integra (SSW, FTP) ou administra.

- **Webhook SSW: recusa antes do corpo e só metadados.** Chamada sem token válido é recusada antes
  de o corpo ser lido (JSON inválido sem token passa a receber 401, não 400) e grava só IP,
  user-agent, motivo e o SHA-256 do token. A exceção é a quarentena de "token incorreto" (ADR 0009).
  Mais de 30 falhas por minuto do mesmo IP recebem 429 sem gravar nada.
- **Webhook SSW: "Reprocessar webhooks rejeitados por token" só reenvia o que confere.** Vale para o
  evento cujo token é o segredo atual ou o anterior (o SSW trocou o token antes de nós, ou nós
  antes dele). O cartão mostra "Total" (todos os recusados com conteúdo) e "Reenviados" (os que
  conferem); os outros nunca viram dado. Eventos migrados do sistema atual não guardam o resumo do
  token: não são reprocessáveis.
- **Conta desativada não entra.** Com a senha certa, o login responde "Sua conta foi desativada por
  um administrador." (antes entrava e via a tela "Sem acesso"); a sessão aberta deixa de renovar e
  a conta desativada não usa as telas da Plataforma.
- **Admin comum não desativa quem está acima.** Desativar ou reativar um Super Admin é só do Super
  Admin ou da Plataforma; quem é da equipe da Plataforma, só a Plataforma (ADR 0007).
- **Rotas públicas da ingestão com segredo por empresa** (ADR 0010). `x-ftp-ingest-secret` (e
  `x-cron-token`) passam a ser o segredo da integração "Rotas públicas da ingestão" da empresa; o
  `FTP_INGEST_SECRET` global e o `backfill_cron_token` saem. Cadastrando o valor de hoje para a FR,
  quem chama não percebe; pedir outra empresa com esse segredo dá 404.
- **SFTP confere a chave do servidor.** A integração SFTP ganha o campo "Impressão digital do
  servidor" (SHA256:…), obrigatório: sem ele, ou com a chave do servidor diferente, a sincronização
  do FTP falha com a mensagem do que cadastrar (antes conectava em qualquer servidor que
  respondesse no endereço). Na transição com `usar_env`, vale `SFTP_IMPRESSAO_DIGITAL`.
- **CSV sem fórmula.** Texto que começa com `=`, `+`, `-`, `@`, tab ou CR sai com `'` na frente no
  CSV exportado (a planilha mostra o texto em vez de executar uma fórmula). Números não mudam.
