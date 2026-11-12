# PRD — ERP SSW (painel de performance logística)

- Situação: rascunho para avaliação do dono (12/11/2026)
- Fontes: `docs/arquitetura.md`, `docs/regras/00`–`06`, `docs/duvidas-do-dono.md`,
  `docs/mudancas-visiveis.md`, ADRs 0001–0015
- Complementa: `docs/sdd.md` (como o sistema é construído)

## 1. Problema

A FR Transportes acompanha a operação (entregas, prazos, ocorrências, romaneios, coletas e
desempenho de parceiros) num painel BI que lê os dados do SSW, o sistema de gestão de transporte.
Esse painel atual (repo `fr-transportes`) concentra regra de negócio no banco: 217 funções SQL,
gatilhos, views materializadas, `pg_cron`, Vault e Auth do Supabase. Isso torna o sistema difícil
de testar, de evoluir e de levar a outras empresas, e prende a operação a um fornecedor.

## 2. Objetivo

Substituir o painel atual por um sistema novo, com código 100% novo, sem que o usuário perceba a
troca: mesmas telas, mesmos números, mesmos filtros, mesmas URLs, mesmas exportações, mesmo e-mail e
senha. Mudam a engenharia e as diferenças que o dono decidiu (seção 9).

Objetivos do negócio:

1. **Confiabilidade dos números:** toda regra em TypeScript, com a origem citada e conferida lado
   a lado com o sistema atual.
2. **Multiempresa:** atender outras transportadoras na mesma instalação, com dados isolados por
   empresa e módulos liberados por empresa.
3. **Independência de fornecedor:** o banco guarda só dados (Postgres comum); login, sessão,
   permissão e jobs ficam no backend.
4. **Operação segura:** padrão OWASP, segredos cifrados, auditoria de toda escrita.

## 3. Usuários e papéis

| Quem | O que faz |
| --- | --- |
| Operador | Acompanha os painéis da empresa (performance, ocorrências, romaneio etc.) nas telas liberadas para ele |
| Gestor | Igual ao operador, com as telas e ações que o cargo libera |
| Admin da empresa | Gerencia usuários, convites, cargos e permissões, códigos de ocorrência, configurações e logs da empresa |
| Super Admin da empresa | Admin com poder sobre os outros admins da empresa |
| Equipe da Plataforma | Acompanha todas as empresas no Dashboard da Plataforma, cadastra empresas, libera módulos, configura integrações (SSW, Ahgora, e-mail, domínio) e acompanha a ingestão; cada membro tem um cargo da Plataforma |
| Público (sem login) | Vê o ranking de equipes por um link público com token |

O acesso é por **permissão por ação**: em cada tela, Ver, Criar/Editar e Excluir (tela só de
leitura tem só Ver). O cargo reúne as permissões de um grupo de usuários, e a exceção por usuário
concede ("Sim") ou nega ("Não") uma permissão. Admin e Super Admin têm tudo. Valem ainda os
módulos liberados para a empresa. A equipe da Plataforma segue o mesmo modelo, com cargos próprios
sobre as telas da Plataforma. A migração para esse modelo preservou o acesso de hoje: ninguém ganhou
nem perdeu tela, e o departamento virou cargo. Um usuário pode estar em várias empresas e troca a
empresa ativa sem sair.

## 4. Escopo funcional

### 4.1 Módulos (liberados por empresa)

| Módulo | Telas | O que entrega |
| --- | --- | --- |
| Essencial | Admin › Usuários, Cargos, Configurações, Logs | Gestão de acesso da empresa (cargos e permissões por ação) e trilha de auditoria |
| Performance | `/performance`, `/performance/lista`, `/ctrc/$numero`, início | Performance de entrega e SLA por período (emissão, data prevista ou conclusão), relatório de período, listagem detalhada com filtros e exportação, detalhe do CT-e |
| Romaneio | `/romaneio` | Romaneios do dia e por período, viagens, placas e motoristas |
| Ocorrências | `/ocorrencias`, Admin › Códigos | Painel de ocorrências por responsável, prazo e faixa de atraso; cadastro e classificação dos códigos |
| Comprovantes | `/comprovantes` | Acompanhamento dos comprovantes de entrega |
| Coletas | `/coletas` | Coletas do relatório 050 do SSW |
| Prazo do parceiro | `/prazo-parceiro`, `/prazo-parceiro/$id` | Prazo acordado com cada parceiro e o cumprimento dele |
| Histórico e calendário | `/historico`, `/historico/feriados`, `/calendario` | Histórico do CT-e, calendário operacional e feriados (entram no cálculo de prazo) |
| Ranking | `/ranking`, `/ranking/regras`, `/ranking/equipe/$id`, Admin › Equipes, link público | Ranking operacional (SLA por parceiro e cidade) e ranking de equipes por regras configuráveis |
| Ponto e bonificação de entrega | Admin › Ahgora, Admin › Bonificação de entrega | Integração com o ponto (Ahgora) e cálculo da bonificação de entrega |
| XML CT-e | Admin › XML CT-e | Acompanhamento dos XML de CT-e recebidos pelo SFTP |
| Integração SSW | Admin › Importação SSW, Ingestão, Diagnóstico SSW | Acompanhamento e operações manuais da ingestão (relatórios por SFTP, BI2, API) |

A regra de cada tela está especificada em `docs/regras/` e é a fonte da verdade para a paridade.

### 4.2 Plataforma

Dashboard multitenant (visão de todas as empresas), empresas (cadastro, módulos, logo), equipe e
cargos da Plataforma, integrações (domínio, e-mail, worker-ssw), logs da Plataforma.

### 4.3 Requisitos transversais

- **Login** só com e-mail e senha. As senhas atuais continuam valendo, sem troca: o sistema migra
  o hash no primeiro login. Recuperação por "Esqueci a senha" (e-mail com link de uso único).
  Entrada de usuário novo só por convite do admin. **Sem login com Google** (decisão de
  12/11/2026).
- **Sessão:** dura no máximo 8 horas e cai depois de 30 minutos sem uso. Sair encerra a sessão em
  todos os tokens dela. Revogar o acesso de alguém vale em até 30 segundos.
- **Exportações** (Excel/PDF) iguais às de hoje, com os mesmos números da tela.
- **Auditoria:** toda escrita registra quem, quando e o quê; consulta em Admin › Logs e
  Plataforma › Logs.
- **URLs públicas de integração** (webhook do SSW e outras) mantêm os mesmos caminhos.
- **Português** em toda tela, mensagem e erro; erros falam com o operador ("reduza o período...").

## 5. Fora do escopo deste repositório

- **Ingestão do SSW** (SFTP, BI2, webhook, XML, aplicação dos ciclos, projeções do Romaneio): é o
  worker-ssw, outro sistema (ADR 0012). O ERP só mostra o estado e pede as operações manuais.
- Login social (Google ou outro).
- Funções, gatilhos, views materializadas, cron, Vault e Auth no banco.
- Cargas históricas únicas do sistema atual (spec 06 §8).
- Código morto do sistema atual (cada spec tem a seção "não portar", com a prova).

## 6. Requisitos não funcionais

| Tema | Requisito |
| --- | --- |
| Segurança | OWASP ASVS / API Top 10: validação de toda entrada, sem SQL concatenado, limite de tentativas no login e nas rotas sensíveis, cabeçalhos de segurança, CORS restrito, segredos de integração cifrados (AES-256-GCM), segredo nunca em log |
| Isolamento | Dado de uma empresa nunca aparece para outra: checagem no backend e RLS no banco como segunda barreira |
| Desempenho | Telas de agregação (ex.: performance sobre centenas de milhares de CT-e) respondem por consulta set-based, sem processar linha a linha na API. Meta de tempo de resposta: **a definir** |
| Disponibilidade | Health check (`/healthz`, `/readyz`), reinício automático dos contêineres. Meta de disponibilidade: **a definir** |
| Observabilidade | Log estruturado (JSON) com id da requisição, métricas Prometheus |
| Manutenção | TypeScript estrito, sem código morto, uma forma só de fazer cada coisa (MVC, SQL puro, contrato compartilhado; ver `docs/sdd.md` §15), CI com tipos, lint, testes do web, build, imagem e varredura de vulnerabilidades |

## 7. Critérios de aceite

1. **Conferência lado a lado (Q52):** para cada tela, mesmos números do sistema atual com os
   mesmos filtros e período, salvo as diferenças listadas em `docs/mudancas-visiveis.md`.
2. Todos os usuários atuais entram com o e-mail e a senha de hoje.
3. Cada caso-limite das specs (`docs/regras/*`, seções de casos de teste) conferido: os cálculos
   da tela por teste automatizado no web, e os da api na conferência lado a lado contra o banco (a
   api não tem testes, por decisão do dono).
4. Nenhum dado de uma empresa visível em outra (teste de RLS e de autorização).
5. Exportações com as mesmas colunas e valores do sistema atual.

## 8. Entrega por ondas

| Onda | Entrega | Situação |
| --- | --- | --- |
| 0 | Especificação das regras; fundação (api, web, auth, contexto de empresa, RLS); schema | feita |
| 1 | Domínios: performance/CT-e, romaneio/prazo, ocorrências/comprovantes/coletas/histórico/calendário, ranking/bonificação/Ahgora, admin/plataforma/auditoria/exportação | telas e rotas no repositório; conferência lado a lado **a validar** |
| 2 | Ingestão no worker-ssw; migração dos dados `public` → `erp`; infraestrutura (Docker, Caddy, CI) | em andamento (worker-ssw é outro repositório) |
| 3 | Revisão de segurança e de código; consolidação (API em MVC, SQL puro sem ORM, permissões por ação, Plataforma multitenant) | em andamento |

## 9. Diferenças decididas em relação ao sistema atual

O dono delegou as 55 dúvidas das specs (Q01–Q55, "vale a recomendação"). O que o usuário nota de
diferente está em `docs/mudancas-visiveis.md`, por domínio. As principais:

- "Hoje" é o dia de Brasília em todas as telas.
- Conta desativada não entra (antes entrava e via "Sem acesso").
- Ranking de equipes e bonificação corrigidos e portados (ADR 0006).
- Sem "Continuar com Google": quem só entrava pelo Google cria a senha por "Esqueci a senha".
- Admin › Cargos com permissão por ação (Ver, Criar/Editar, Excluir) e exceção por usuário;
  Admin › Departamentos sai (o departamento virou cargo, sem mudar o acesso de ninguém).

## 10. Como o produto evolui

- **Paridade primeiro:** a referência é o sistema atual e `docs/regras/`. Toda diferença que o
  usuário perceba é decisão do dono e entra em `docs/mudancas-visiveis.md` antes de ir ao ar.
- **Decisão registrada:** toda decisão de produto ou de arquitetura vira um ADR em `docs/adr/`.
- **Só entra o que é usado:** cada tela, rota pública ou job precisa de alguém que o use hoje;
  código e dado sem uso saem (cada spec tem a seção "não portar").
- **Mudança de acesso sem surpresa:** quando o modelo de permissões muda, a migração preserva o
  acesso de cada usuário, conferido usuário por usuário antes de aplicar.

## 11. Riscos e dependências

| Risco | Efeito | Mitigação |
| --- | --- | --- |
| Diferença de número na virada | Perda de confiança no painel | Conferência lado a lado por tela; lista de mudanças visíveis para avisar os usuários |
| Usuários que só entravam pelo Google | Não conseguem entrar no primeiro dia | Avisar antes da virada e orientar o "Esqueci a senha" |
| Dependência do worker-ssw | Sem ingestão, os painéis param de atualizar | Faixa de saúde da ingestão nas telas; Diagnóstico SSW |
| Cópias de `shared`/`dominio` (api, web, worker-ssw) divergirem | Tela e API calculam diferente | Mesma origem (api), `scripts/copiar-compartilhado.sh --conferir` no CI (ADR 0013) |
| API sem testes automatizados | Regressão de número só aparece na conferência | Regra pura isolada em `dominio/`, conferência lado a lado por tela, repositório novo rodado contra o banco antes do merge |

## 12. Pontos a validar com o dono

1. Nome do produto na tela: "Copiloto SSW" (marca do login) ou "Painel BI Logístico" (título da aba)?
2. Metas de tempo de resposta e de disponibilidade (seção 6).
3. Data da virada e como avisar os usuários das mudanças visíveis (inclusive o fim do Google).
4. Quais empresas, além da FR, entram na primeira leva do multiempresa.
5. Critério de aceite 3: sem testes na api, a conferência lado a lado basta para os casos-limite
   das regras da api?
