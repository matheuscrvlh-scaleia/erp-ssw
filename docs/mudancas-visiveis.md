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

## Admin, Plataforma, auditoria e convites (spec 05)

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
- **Segurança (decisão técnica, ADR 0006).** Só Super Admin (ou a Plataforma) dá ou tira o nível
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
