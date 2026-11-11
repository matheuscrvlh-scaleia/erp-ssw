# Inventário do layout atual das telas (apps/web)

Levantamento factual do que existe hoje, sem proposta de redesenho. Base: `apps/web/src` (rotas em `routes/_autenticado/*.tsx` apontando para `modulos/<modulo>/Pagina*.tsx`). Caminhos abaixo são relativos a `apps/web/src`. Contagens de cores e fontes são aproximadas (grep).

## 0. Casca comum (todas as telas logadas)

- `routes/_autenticado.tsx`: `SidebarProvider` + `BarraLateral` (largura 13rem, azul-marinho `--sidebar`) + faixa superior de 48 px (`h-12`, linha 81) com só o botão de abrir/fechar a lateral (e "Painel BI" no mobile). Conteúdo em `<main>` com `max-w-[1440px] px-4 py-6 md:px-6`.
- A faixa superior usa `bg-[var(--marca-primaria,#212a63)] text-white` (hex de fallback fixo, linha 81). O mesmo `#212a63` está em `styles.css` (`--sidebar`) e em `acesso/marca.ts:5` (`COR_DO_TEMA`).
- `FaixaSaudeSsw` (`modulos/ingestao-ssw/FaixaSaudeSsw.tsx`) aparece acima de toda tela quando a integração SSW está indisponível: banner âmbar (`border-amber-500/40 bg-amber-500/10 text-amber-900`).
- Menu lateral (`acesso/navegacao.ts`): grupo principal (Performance, Ranking, Romaneio, Ocorrências, Comprovantes, Coletas, Prazo parceiro, Histórico, Calendário), grupo "Admin" e grupo "Plataforma". Item com `text-[12.5px]`; nome do usuário `text-[11.5px]` e setor `text-[9.5px]` (`componentes/layout/BarraLateral.tsx:50,123,126`).
- Fonte: Manrope (400/500/600). Não existe alternador de tema claro/escuro (nenhum `classList`/ThemeProvider), apesar de `styles.css` ter bloco `.dark` e de ~10 arquivos de módulo terem `dark:` ou classes pensadas para fundo escuro.
- Tokens em `styles.css`: `--brand`, `--status-good/warn/bad` (+ `-fg`, `-bg`), `--kpi-volume/alert/positive`, `--chart-1..5`, `--muted*`, `--border`, `--radius` 0.625rem. Utilitários próprios: `.num-hero` (30 px), `.label-xs` (11 px caixa-alta), `.live-dot`.

## 1. Matriz de padrões por tela

Legenda: FA = `FiltrosAvancados`; FP = `FiltroPeriodo`; KC = `KpiCard` comum; GC = `Graficos.tsx` comum (recharts); TD = `TabelaDados` comum; "próprio" = markup ou componente do módulo.

| Tela (URL) | Filtros | KPIs | Gráficos | Tabela | Export | "Como funciona" |
|---|---|---|---|---|---|---|
| `/` (index) | redireciona à 1ª tela permitida | - | - | - | - | - |
| `/performance` | FA no topo (acima dos KPIs) | próprio (`KpiBox`, `CartaoDeProducao`, `Celula`) | GC (`GraficoSerie`) | própria (`TabelaDeUnidades`) | header + ícone em tabela e gráfico | não |
| `/performance/lista` | FA **abaixo** dos gráficos | card próprio | próprio (barras HTML) | própria (`TabelaCtrcs`) | header (`acoes`) | não |
| `/ocorrencias` | `BarraDeFiltros` do módulo (usa FA) | próprio (`CartaoDeMetrica`) | GC (1) + próprios (`LinhaDeBarra`) | TD | só na lista e nos cards de código | não |
| `/comprovantes` | FA | KC (4) | GC | TD (3) | header + tabelas | não |
| `/coletas` | FA + `<select>` solto | KC (8) | GC | TD (4) | só por tabela (não no header) | não |
| `/prazo-parceiro` | FA com `BotoesDePeriodo` próprio (sem calendário) | `CartaoMetrica` próprio | barra única própria | própria (`<table>`) | só na lista | não |
| `/prazo-parceiro/$id` | filtros **no cabeçalho** (sem FA) | `CartaoMetrica` | próprio | própria | tabela | não |
| `/romaneio` | `BaseDeData` + `BarraDeFiltros` (usa FA); aba Hoje: 2 `FiltroMultiplo` soltos | próprios (`TotCard`, `CardAba`) | próprios (barras CSS) | própria (`<table>`) | por tabela | não |
| `/ranking` | **barra própria** dentro de cada aba, copia o markup de FA, sem "Limpar filtros" | KC (4) | GC (`GraficoSerie`) | própria | na barra de filtros (à direita) | não |
| `/ranking/regras` | - | - | - | cartões | - | não |
| `/ranking/equipe/$id` | - | tela mobile própria | - | - | - | não |
| `/ranking/publico/$token` (fora do layout logado) | - | tela mobile própria | - | - | - | não |
| `/historico` | **barra própria** (`div` + botões + 3 `<select>`), abaixo dos cards | `CartaoTotal` próprio | - | linha do tempo/calendário próprios | header | não |
| `/historico/feriados` | `<select>`/`<input>` soltos | - | - | TD | - | não |
| `/calendario` | seletor de ano + abas de visão | `Indicador` próprio | grade própria | própria | - | não |
| `/ctrc/$numero` | - | - | - | cartões de detalhe | header (só PDF) | não |
| `/admin/codigos` | barra própria + `<select>` | KC (4) | - | TD | - | não |
| `/admin/bonificacao-entrega` | formulário (mês/unidade/switch) em cartão | cards próprios inline | - | `<table>` própria (3) | - | **sim** (`ComoFuncionaBonificacao`) |
| `/admin/ahgora` | abas no topo; formulário por aba | cards próprios inline | - | `<table>` própria | - | **sim** (`ComoFuncionaPonto`) |
| `/admin/usuarios` | `input` + `<select>` soltos | - | - | TD | TD | não |
| `/admin/roles`, `/admin/departamentos` | - | - | - | TD (`PaginaDeCadastro`) | - | não |
| `/admin/equipes` | formulário "Nova equipe" | - | - | cartões + `<table>` | - | não |
| `/admin/configuracoes` | - | - | - | seções com formulários | - | não |
| `/admin/logs` | abas + `<select>`/`<input type=date>` | - | - | TD + `Detalhe` | TD | não |
| `/admin/importacao-ssw`, `/admin/xml-cte` | - | - | - | TD | - | não |
| `/admin/ingestao`, `/admin/ssw-diagnostico` | - | KC (só no diagnóstico) | - | TD | - | não |
| `/plataforma/*` | - | - | - | TD | - | não |
| `/login`, `/aceitar-convite`, `/redefinir-senha`, `/sem-acesso` | - | - | - | - | - | - |

## 2. Inventário por tela

### 2.1 Performance
**`/performance`** - `modulos/performance/PaginaPerformance.tsx` (rota `performance.index.tsx`). De cima para baixo:
1. Cabeçalho (`<header>` grid, linha 304): h1 `text-[24px] font-semibold` ("Performance do dia" ou "Performance - <período>"), `SeloDosDados` logo abaixo; sem subtítulo. À direita: botão "Relatório de período" (abre `DialogoRelatorio`), `ExportMenu` (linha 322, carrega todas as linhas), "Atualizar" (ghost).
2. Filtros (`FiltrosAvancados`, linha 348): `FiltroPeriodo` (rótulo vem da base de data), alternador de base de data (div próprio com `bg-foreground text-background`), `BuscaDocumento` CTRC e Nota fiscal, `SeletorDePagador` (Parceiros), `SeletorDeFilial`, `SeletorDeTexto` Remetente e Destino, `FiltroMultiplo` Ocorrência (com `title` longo), `SeletorDeTipoDocumento`. Depois `FiltrandoPor` (etiquetas, linha 467).
3. Banners: período > 183 dias (âmbar fixo, linha 470); `BannerDeAlertas` (cartões de alerta clicáveis com `color-mix`); erro (`border-amber-200 bg-[var(--status-warn-bg)]`, linha 498); aviso de cobertura (cinza); ao final, ocorrências a classificar (âmbar, linha 662, link para `/admin/codigos`).
4. Linha de 5 KPIs (`LinhaDeKpis`, `Kpis.tsx`): SLA Operacional, Nascidos em atraso, OTIF (condicional), Taxa de retorno, caixa "Em Atraso" com 2 sub-cards. Componente **próprio** `KpiBox` (`Kpis.tsx:41`), duplicando o desenho de `KpiCard` (barra lateral 5 px, `num-hero`, selo, progresso). Clicáveis (abrem `/performance/lista`). Texto explicativo `text-[11px]` logo abaixo (OTIF, nascidos, SLA).
5. Linha de 7 cards de produção (`Producao.tsx`: CT-e Emitidos, Entregues, No Prazo, Fora do Prazo, Finalizado em Sistema, % Produção, TDE aguardando programação), próprios (`CartaoDeProducao`), clicáveis, com tooltip.
6. `SecaoPrevistos` (`Previstos.tsx`): total + por status + por faixa, com alternador "ignorar período" próprio; cada célula clica para a lista. `VerificacaoDaParticao`.
7. `TabelaDeUnidades` (própria, não TD): ordenação só alterna pior/melhor (clique no título), linha clicável, export só-ícone.
8. `GraficoSerie` (`GraficoSerie.tsx:80`): cartão com título/subtítulo, alternador de métrica (SLA Op., SLA Cli., Volume) com `bg-[var(--brand)]`, `ExportMenu` só-ícone; `GraficoLinha` (percentual, linha de meta) ou `GraficoBarras` (volume) comuns. Não é clicável.
9. `DialogoRelatorio` (`RelatorioPeriodo.tsx`, 670 linhas): diálogo com `FiltroPeriodo` x2, 3 `<table>`, botão Imprimir; HTML de impressão separado em `relatorio-impressao.ts` (25 hex fixos, legítimo para impressão).
- Sem "Como funciona".

**`/performance/lista`** - `modulos/listagem/PaginaListagem.tsx` (766 linhas), `TabelaCtrcs.tsx`, `GraficoDeBarras.tsx`.
1. Cabeçalho (linhas 387-403): botão "Voltar" (com borda, antes do título), h1 `text-lg font-semibold` (título dinâmico; versão mobile `text-base`), à direita `acoes` = "Atualizar" + `ExportMenu` (`tamanhoFonte` 5,5). `SeloDosDados` com `-mt-2` em linha separada.
2. Grade: card "Total do recorte" (`border-l-[5px] border-l-kpi-positive`, markup próprio, `text-3xl`) + 3 ou 4 `GraficoDeBarras` **próprios** (barras horizontais em HTML/CSS, não recharts): Ocorrências, Distribuição por Unidade, Cidades Destino (top 10), Dias de Atraso (condicional). Interativos: o clique filtra a lista (`aria-pressed` na barra ativa).
3. **Filtros ficam depois dos gráficos** (`FiltrosAvancados`, linha 510): `FiltroPeriodo`, alternador de base de data, `SeletorDeFilial`, `SeletorDePagador`, `SeletorDeTexto` x2, `SeletorDeOcorrencia`, `SeletorDeRecorte`, faixas de peso e de atraso; depois `FiltrandoPor` (linha 632).
4. `TabelaCtrcs` (própria: cabeçalho e 3 colunas fixas com sticky, ordenação no servidor via `aoOrdenar`); rodapé "Página X de Y" + `BotoesDePagina`.
- Sem "Como funciona". Faixas âmbar em `TabelaCtrcs` (7 classes fixas, prazo vencido).

### 2.2 Ocorrências
**`/ocorrencias`** - `modulos/ocorrencias/PaginaOcorrencias.tsx` (+ `Filtros.tsx`, `Cartoes.tsx`, `Blocos.tsx`, `Lista.tsx`).
1. Cabeçalho (linha 145): h1 `text-[26px] font-bold` (único com essa fonte), `SeloDosDados`, subtítulo `text-[13px] font-medium`. À direita só "Atualizar". Sem export no cabeçalho.
2. `BarraDeFiltros` do módulo (`Filtros.tsx:27`, usa `FiltrosAvancados`): alternador "Por emissão/Por previsão" (`classeDoSegmento`), `FiltroPeriodo`, `SeletorDePagador`, `SeletorDeFilial`, `SeletorDeTexto` x2, `FiltroMultiplo` Códigos / Responsável / Conferente (com `InfoTip`), `SeletorDeTipoDocumento`. `FiltrandoPor` (linha 178).
3. 4 cards `CartaoDeMetrica` (próprio, `Cartoes.tsx:21`): Total de ocorrências, Penalizantes, Não penalizantes, Pendentes de classificação; clicáveis (filtram por `resp`), cada um com `CodigosDoCard` (lista de códigos + export).
4. Banner âmbar de pendentes (`border-amber-300 bg-amber-50 text-amber-900`, linha 264) com botão "Classificar agora"; `MensagemErro` comum para erro do painel.
5. Blocos (`Blocos.tsx`): `ComparativoDoMes` (usa `GraficoBarras` comum, `aoClicarBarra`), `BlocosDestaque` (Ocorrências mais frequentes, CT-e finalizados e em aberto, Onde atuar), `ImpactoPorCodigo`, `BlocosApoio` (Prazo, Faixas de atraso, CT-e por pagador). Barras horizontais próprias (`LinhaDeBarra`), clicáveis. Títulos de bloco `text-[16px] font-bold`.
6. `ListaDeOcorrencias`: `TabelaDados` comum "Lista detalhada", paginação e ordenação de servidor, `configurarColunas`, exportação com `carregarTodas`; linha abre `/ctrc/<n>`.
- Sem "Como funciona".

### 2.3 Comprovantes
**`/comprovantes`** - `modulos/comprovantes/PaginaComprovantes.tsx`.
Cabeçalho (linha 139): h1 `text-[24px] font-medium`, `SeloDosDados`, subtítulo `text-[12px]`; à direita `ExportMenu` (linha 148) + "Atualizar". `FiltrosAvancados` (linha 181): `FiltroPeriodo` (rótulo "Entrega") + texto "por data de entrega" com `InfoTip`, `SeletorDeFilial`, `SeletorDePagador`, `SeletorDeTexto` x2, `SeletorDeTipoDocumento`, `BuscaDocumento` CTRC e NF. `FiltrandoPor`. 4 `KpiCard` comuns (CT-e entregue, Digitalizados, % digitalizados, Pendentes), clicáveis abrem a gaveta. `section` própria (`label-xs`) com `GraficoBarras` "Tendência por dia de entrega". 2 `TabelaDados` (por unidade, por tipo). `DrawerDetalhe` (`Detalhe` comum, largura larga) com TD da lista.

### 2.4 Coletas
**`/coletas`** - `modulos/coletas/PaginaColetas.tsx` (+ `Importador050.tsx`).
Cabeçalho (linha 307): h1 `text-[24px] font-medium`, `SeloAtualizacao` direto (não `SeloDosDados`), subtítulo com cobertura. À direita "Importar 050" (se pode) + "Atualizar". **Sem export no cabeçalho.** `FiltrosAvancados` (linha 349): `FiltroPeriodo` (atalhos próprios, padrão 30d), texto "por data de cadastro", alternador de unidade (botões), `<select>` nativo "Tipo de coleta". Grade de 8 `KpiCard` (Coletas, Coletadas no prazo, atrasadas, Em aberto, Vencidas, Vencem hoje, Com CT-e gerado, Canceladas; filtram a lista). `Quadro` + `GraficoBarras` empilhado ("Coletas por dia de cadastro", cores `--status-*`). 3 `TabelaDados` (por solicitante, por unidade, por tipo de documento), com export individual. TD "Detalhe das coletas": paginação de servidor, `configurarColunas`, `<select>` de Situação e `BuscaDocumento` na faixa de ações. Gaveta `DrawerDetalhe`; diálogo `Importador050`.

### 2.5 Prazo parceiro
**`/prazo-parceiro`** - `modulos/prazo-parceiro/PaginaPrazoParceiro.tsx` (+ `componentes.tsx`).
Cabeçalho (linha 185): h1 `text-[24px]` com ícone, `SeloDosDados mostrarXml`, subtítulo; só "Atualizar" à direita. `FiltrosAvancados` (linha 205): `BotoesDePeriodo` **próprio** (Hoje/7d/30d/Mês, sem calendário, `componentes.tsx:101`), 3 `FiltroMultiplo` (Unidades, Parceiros, Tipo documento), texto do período à direita. Banners: positivo (verde fixo, linha ~267), parceiro problema (âmbar), variação (neutro), erro (`--status-bad`). 3 `CartaoMetrica` próprios (Performance total, própria, Diferença; `text-[28px]`/`[32px]`). Dois cartões sem componente: "Origem do prazo" (barra empilhada com `bg-amber-400`) e "Nascidos em atraso" (número `text-[36px]`, botão "Ver lista"). Tabela "Parceiros com mais prazos inviáveis" (`<table>` crua, top 10). Lista de CTRCs (`<table>` crua) com `ExportMenu` (linha 542), `<select>` de tamanho de página e `BotoesDePagina`.
**`/prazo-parceiro/$id`** - `PaginaDetalheParceiro.tsx`. Link "voltar" (`text-[11px]`) acima do h1; filtros (`BotoesDePeriodo` + `FiltroMultiplo`) e "Atualizar" **dentro do cabeçalho**, sem `FiltrosAvancados`; 3 `CartaoMetrica`; "Atraso na origem"; tabela "CTRCs nascidos em atraso" com `ExportMenu`.

### 2.6 Romaneio
**`/romaneio`** - `modulos/romaneio/PaginaRomaneio.tsx` (241 linhas) + `BarraDeFiltros.tsx` (498), `AbaHoje.tsx` (594), `AbasDesempenho.tsx` (1125), `ListaTotal.tsx` (900), `Distribuicao.tsx`, `CardsDoPeriodo.tsx`, `componentes.tsx`.
1. Cabeçalho (linha 121): h1 `text-[24px] font-semibold`, `SeloDosDados`; só "Atualizar".
2. `Abas` comum (linha 138), **sticky** (`sticky top-0 z-20`): Hoje, Total, Romaneio de entrega, Performance por romaneio, Performance Motorista, Performance Ajudante, Prejuízo.
3. Abas que não são "Hoje": faixa `BaseDeData` ("Contar as cargas pela ...", alternador `bg-[var(--brand)]`) e `BarraDeFiltros` (`FiltrosAvancados`: `FiltroPeriodo`, Parceiros, Unidade responsável, Local. atual, Remetente/Destino (`FiltroTexto`), Código, Tipo documento, previsão (um dia), Placa, Motorista, Ajudante). Faixa de chips "Tabela abaixo filtrada" (pílulas próprias).
4. `CardsDoPeriodo`: grade de cards próprios `TotCard` (CTRC, Peso total, Volumes, Frete total, Em rota de entrega, Entregues, Baixado sem entrega, Travado em ocorrência, Parado sem saída, TDE romaneado, OTIF, Prejuízo + chips `FaixaChip` Vencida/Vencendo no dia/Vencimento futuro), com alternador de cards secundários.
5. Conteúdo por aba: Total = `Distribuicao` (`TabelaCarros` + `BarrasPorCodigo`, clicáveis) + `ListaTotal` (`<table>` própria agrupável, selects `SelectLista`, `ExportMenu`, `BotoesDePagina`); Romaneio de entrega = "CTRC por carro" + "Por romaneio (viagem real)" (`<table>`); Performance por romaneio; Motorista/Ajudante = `TabelaDePessoas` (`<table>` + export); Prejuízo = gráfico de colunas **CSS** `bg-destructive/70` (altura inline, `text-[9px]`), 3 rankings, export por bloco. Aba Hoje: `AbaHoje` com 2 `FiltroMultiplo` inline, `CardAba` x5, `GavetaDaFaixa` (`Sheet`), tabela e `ExportMenu`.
- Nenhum gráfico recharts; nenhum "Como funciona".

### 2.7 Ranking e equipes
**`/ranking`** - `modulos/ranking/PaginaRanking.tsx` + `RankingTabela.tsx` (673 linhas). Cabeçalho `<header>` simples (h1 `text-2xl font-semibold`, `SeloDosDados`, subtítulo `text-sm`), **sem ações à direita**. `Abas` (Parceiro | Cidade) abaixo do cabeçalho e **acima dos filtros**; cada aba monta um `RankingTabela`. Dentro: barra de filtros **própria** (`RankingTabela.tsx:334`, div com as mesmas classes de `FiltrosAvancados`, sem botão "Limpar filtros"): `FiltroPeriodo` (4 atalhos, padrão 30d), alternador Emissão/Previsão (`classeDoAlternador`), `SeletorDeFilial`, `SeletorDePagador`, `SeletorDePagadorAgrupado`, `SeletorDeTexto` x2, `SeletorDeTipoDocumento`, e à direita "meta X% · período" + `ExportMenu` (linha 404). Estado dos filtros em `useState` (não na URL). `FiltrandoPor` (linha 416). 4 `KpiCard` comuns (Parceiros/Cidades, CT-e no período, SLA médio com progresso, Abaixo da meta), clicáveis (linhas 419-453). `GraficoSerie` comum (SLA mês a mês, `<select>` de ano nativo em `filtrosExtra`). Tabela **própria** `<table>` com `text-[14px] font-medium` e cabeçalho `text-[13px] font-semibold` (maior que as demais, que usam 12 px), ordenação por clique, ícone de olho para frete, linha clicável abre os casos.
**`/ranking/regras`** - `PaginaRegras.tsx`: h1 `text-2xl`, botão voltar (ghost), lista de cartões de regra (`rounded-xl border-border bg-card p-4`) com bloco "Simulação (mês anterior)" em `emerald-500/5` e texto `emerald-300` (pensado para fundo escuro). Editor é um **modal próprio** (`fixed inset-0 bg-black/60`, linha 264), não o `Dialog` de `ui/`; `<select>` e `<input type=date>` nativos.
**`/admin/equipes`** - `PaginaEquipes.tsx`: h1 `text-2xl`, cartão "Nova equipe" (input + select nativos), cartões por equipe (`rounded-xl`), botões gerar/copiar/revogar link, `NovoMembro`, `AtribuirCtes`, `<table className="text-xs">`.
**`/ranking/equipe/$id`** e **`/ranking/publico/$token`** - `PaginaEquipeDetalhe.tsx`, `PaginaRankingPublico.tsx` + `EquipeMobileView.tsx`: layout mobile (cartão hero `emerald-500/15` com `text-5xl text-emerald-300`, top 3, grade de 3). A rota pública fica fora do `_autenticado` (sem sidebar).

### 2.8 Histórico e calendário
**`/historico`** - `PaginaHistorico.tsx` (574 linhas). Cabeçalho (linha 340): h1 `text-[20px] font-semibold` com ícone `Bookmark` + subtítulo `text-[13px]`; à direita link "Feriados" (se `admin_historico`), `ExportMenu` (linha 358), botão primário "Nova anotação". 3 `CartaoTotal` próprios (Anotações, Feriados, Dias com contexto). Banner âmbar quando truncado. **Barra de filtros própria abaixo dos cards** (linha 395, `bg-card/40`, não é FA): botões de período (`bg-primary`), alternador de visão Linha do tempo/Calendário (`bg-foreground`), chips de tipo (cores `COR_DO_TIPO`: amber/zinc/slate/sky), 3 `<select>` nativos (Dias, Autor, Unidade), campo de busca; depois `FiltrandoPor` (linha 507). Conteúdo: linha do tempo por dia (`Linha`, `ItemDeAnotacao`) ou `Calendario` mensal próprio; skeletons e `MensagemErro`. Modal `ModalDeAnotacao` (Dialog, `<select>`, `<input type=date>`). Atalho de teclado para nova anotação.
**`/historico/feriados`** - `PaginaFeriados.tsx`: h1 `text-[20px]` com ícone + link "Voltar ao histórico"; botões "Importar nacionais" e "Novo feriado"; barra de filtros própria (`bg-card/40`, linha 160: ano `input`, 2 `<select>`); `TabelaDados`; `ModalDeFeriado`.
**`/calendario`** - `PaginaCalendario.tsx`: h1 `text-[20px]` com ícone `CalendarDays`; à direita seletor de ano (setas + input), "Gerar nacionais", "Novo feriado". 3 `Indicador` próprios. Abas de visão (Mês/Ano/Lista) em barra própria (`bg-primary`), `Visoes.tsx` (grade própria, `text-[9px]` nas miniaturas), cores por tipo de feriado em `calendario.ts` (sky/rose/amber). Mesmo assunto (feriados) que `/historico/feriados`, com cabeçalho e controles diferentes.

### 2.9 CTRC
**`/ctrc/$numero`** - `modulos/ctrc/PaginaCtrc.tsx` (774 linhas). Cabeçalho: botão "Voltar" (`router.history.back`), `Titulo` (h1 `text-[22px]`: rótulo NF/CTRC + número em `font-mono text-brand`, `SeloDosDados`, subtítulo), à direita `ExportMenu` só PDF (retrato) + "Atualizar". Estados: `Esqueleto`, erro (`border-destructive/40`), não encontrado, `EscolhaDeSerie` (mesmo número em várias séries). Detalhe: faixa de selos (status, prazo, pontualidade; cores `emerald/amber` com `dark:`), grade de 2 colunas de `Cartao` próprio: Identificação, Situação atual (com `JanelaDeOcorrencias`, Dialog), Remetente/Destinatário, Carga & Frete, Prazos & Entrega, Parceiro & Unidade, Performance, Enriquecimento. Banner âmbar (linha 516). `font-mono text-[10.5px]` na chave de acesso (linha 570).

### 2.10 Admin
- **`/admin/usuarios`** - `PaginaUsuarios.tsx`: `CabecalhoDaPagina` (`admin/comum.tsx`, h1 `text-[24px] font-medium`, descrição `text-[12px]`, ação `ModalNovoUsuario` à direita), linha de filtros solta (input busca + `<select>` Nível/Situação, `h-8`, `border-input`, sem cartão), `TabelaDados` (colunas com `Selo`, ações editar/resetar/reenviar convite). `ModalEditarUsuario`/`ModalNovoUsuario` (Dialog; Abas no novo; `<select>`).
- **`/admin/roles`, `/admin/departamentos`** - `PaginaDeCadastro.tsx`: `CabecalhoDaPagina` + `TabelaDados` + Dialog (inputs nativos).
- **`/admin/configuracoes`** - `PaginaConfiguracoes.tsx`: `CabecalhoDaPagina` e seções em `rounded-xl border bg-card shadow-sm` com `h2 text-[15px]`; `SecaoPrazos.tsx` com 3 blocos (Por unidade, Por parceiro, Transbordo), `Switch`, Dialog de regra, `<select>`.
- **`/admin/logs`** - rota `admin.logs.tsx` + `Logs.tsx`: `CabecalhoDaPagina`, `Abas` (Alterações | Integrações) abaixo, cada uma com linha de filtros solta (`<select>`, `<input type=date>`), `TabelaDados`, `Detalhe` (antes/depois).
- **`/admin/codigos`** - `PaginaCodigos.tsx`: h1 `text-[20px] font-semibold` com ícone (20 px, ao contrário dos outros admins em 24 px), botão "Novo código"; 4 `KpiCard`; bloco âmbar "Códigos pendentes" (`border-amber-300 bg-amber-50/60`, linha 330) com `LinhaPendente`; barra de filtros própria (linha 351, `bg-card/40`: input, botões de letra, 3 `<select>`) com estado em `useState` e ações em lote; `TabelaDados` com seleção; `ModalDoCodigo` (Abas, `<select>`).
- **`/admin/bonificacao-entrega`** - `PaginaBonificacaoEntrega.tsx` (505 linhas): h1 `text-[22px]` + botão `ComoFunciona` (diálogo com 8 seções numeradas, `ComoFuncionaBonificacao.tsx`), subtítulo. Cartão de formulário (Mês `type=month`, Unidade `Select` do `ui/`, `Switch` "Usar ponto", botão "Apurar"; depois Função e Hora extra); aviso de filtro ativo (`text-amber-600`); skeletons; 4 cards inline (Colaboradores, NFs entregues, Custo total, Dias sem ponto, valor `text-[20px]`); banner âmbar de pendências; `Abas` (Por colaborador | Por dia) com `<table>` cruas; `QuadroDeFaltas` (inputs `type=date`, tabela). Níveis Turbo/Acelerado etc. com ~20 classes de cor fixas (purple/blue/emerald/red/amber).
- **`/admin/ahgora`** - `PaginaAhgora.tsx`: `Abas` no **topo da tela** (antes de qualquer título); cada aba repete seu próprio h1 `text-[22px]` + `ComoFuncionaPonto`. Apuração: formulário (mês, departamento `Select`, switch, "Apurar"), 4 cards inline, `<table>` por colaborador (`text-[11px]`/`[12px]`); Batidas: `Select` de colaborador + `input type=date`, `<table>`.
- **`/admin/importacao-ssw`** - `PaginaImportacaoSsw.tsx`: h1 `text-[24px] font-semibold`; `Cartao` (de `ingestao/pecas.tsx`) "Importação automática" com `TabelaDados` "Últimos ciclos"/"Últimos arquivos"; `Cartao` "Importação manual" com `Secao` (`<details>`), `ImportadorManual`, `AplicarStaging` (Abas Inserir/Atualizar/Ocorrências/Ignorados + TD).
- **`/admin/xml-cte`** - `PaginaXmlCte.tsx`: h1 `text-[24px] font-semibold`; `CartaoFtp` ("Sincronização automática FTP", `BarraDeProgresso`, botões), `Cartao` de upload, TD "Histórico (últimas 50)". `SeloStatus` com ~30 classes de cor fixas em `ingestao/pecas.tsx`.
- **`/admin/ingestao`** - `PaginaIngestao.tsx` (módulo `ingestao-ssw`): h1 `text-[24px] font-medium`; `CartaoBi2`, `CartaoCredenciaisSsw`, `CartaoEventosWebhook` (com `Cartao` de `ingestao-ssw/Cartao.tsx`, **outro** `Cartao`, diferente do de `ingestao/pecas.tsx`), TDs.
- **`/admin/ssw-diagnostico`** - `PaginaDiagnostico.tsx`: h1 `text-[24px] font-medium`; `CartaoJobs`, `CartaoWebhook`, `CartaoOrfaos`, `CartaoSincronizacoes`, `CartaoCredenciaisSsw`, `CartaoReprocessarToken`; 8 `KpiCard` (Recebidos, Processados, Sem vínculo, Rejeitados, Erros, Webhook sem CT-e, XML aguardando, ...); `MensagemErro`.

### 2.11 Plataforma
- **`/plataforma/empresas`** - `PaginaEmpresas.tsx`: `CabecalhoDaPagina`, `TabelaDados` (com `Selo` de status), Dialog "Nova empresa" (inputs nativos).
- **`/plataforma/empresas/$id`** - `PaginaEmpresa` (`PaginasDaPlataforma.tsx:31`): link de volta "Empresas", h1 `text-[24px]` + `Selo`, slug/CNPJ; **cabeçalho próprio** (não `CabecalhoDaPagina`); `Abas` (Dados, Módulos, Usuários, Integrações, Logs, Implantação) com estado local (não na URL); abas em `AbaDados`, `AbasDaEmpresa` (`Switch`, `<select>`, TD, cartões `rounded-xl shadow-sm`), `LogsComAbas` reaproveitado.
- **`/plataforma/administradores`** - `PaginaAdministradores`: `CabecalhoDaPagina`, formulário em linha (input + botão), TD.
- **`/plataforma/integracoes`** - `IntegracoesDaPlataforma.tsx`: `CabecalhoDaPagina` + `CartaoDaPlataforma` por integração (`rounded-xl border bg-card p-5 shadow-sm`, `h3 text-[14px]`, inputs nativos).
- **`/plataforma/logs`** - `PaginaLogsDaPlataforma`: `CabecalhoDaPagina` + `LogsComAbas`.

### 2.12 Telas de acesso
- **`/login`** (`routes/login.tsx`, 285 linhas), **`/aceitar-convite`**, **`/redefinir-senha`**: `CartaoDeEntrada` (`acesso/componentes/CartaoDeEntrada.tsx`: logo "Painel BI" `bg-[var(--brand)]`, título `text-[20px]`, subtítulo `text-[12px]`), `Label`/`Input`/`Button` de `ui/`. Login tem aviso âmbar fixo (`border-amber-300 bg-amber-50 text-amber-900`).
- **`/sem-acesso`** (`routes/_autenticado/sem-acesso.tsx`): fora da casca (sem sidebar), cartão `rounded-[12px]`, h1 `text-[18px]`, botão "Sair".
- 404 (`PaginaNaoEncontrada`: `text-7xl`), `ErroDeRota`, `ModuloDesligado` (h1 `text-[16px]`).

## 3. Cores fixas fora dos tokens (aprox.)

Contagem = ocorrências de classes `bg|text|border|ring|from|to|fill|stroke-<cor>-NNN` (inclui `white`/`black`) + hex literais. Tokens de status existem (`--status-*`, `--kpi-*`), mas as telas usam as paletas do Tailwind em paralelo.

| Arquivo | Qtd | O que é |
|---|---|---|
| `ingestao/pecas.tsx` | ~30 | `white` x15, `emerald-600`, `slate-*`, `sky-600`, `amber-500` (selos de status) |
| `bonificacao-entrega/PaginaBonificacaoEntrega.tsx` | ~23 | `amber-600`, níveis red/emerald/purple/blue (300/500/700) |
| `ctrc/PaginaCtrc.tsx` | ~22 | `emerald-*`, `amber-*` (selos e banner, com `dark:`) |
| `historico/PaginaHistorico.tsx` | ~21 | `COR_DO_TIPO`/`PONTO_DO_TIPO` (amber, zinc, slate, sky), banner âmbar |
| `bonificacao-entrega/ComoFuncionaBonificacao.tsx` | ~15 | legenda de níveis (red/emerald/purple/blue/amber) |
| `prazo-parceiro/PaginaPrazoParceiro.tsx` | ~14 | banners emerald/amber, `bg-amber-400` na barra de origem |
| `performance/RelatorioPeriodo.tsx` | ~13 | red-50/200/600/800, emerald-600 |
| `romaneio/ListaTotal.tsx` | ~13 | emerald/sky/amber nos selos de prazo/status |
| `ranking/EquipeMobileView.tsx` | ~11 | emerald-300/500, amber-400, rose-400, orange-400, slate-300 (tema escuro) |
| `ingestao-ssw/CartaoCredenciaisSsw.tsx` | ~10 | emerald, amber |
| `ingestao-ssw/FaixaSaudeSsw.tsx` | ~10 | amber-100/300/500/600/900 (banner global) |
| `calendario/calendario.ts` | ~9 | sky/rose/amber por tipo de feriado |
| `ranking/PaginaRegras.tsx` | ~8 | emerald-300/500 (simulação), rose-400, `bg-black/60` |
| `performance/PaginaPerformance.tsx` | ~7 | amber-50/100/200/600/900 (banners) |
| `listagem/TabelaCtrcs.tsx` | ~7 | amber-100..900 (prazo vencido) |
| `codigos/PaginaCodigos.tsx` | ~6 | amber-50/200/300/700/900, emerald-700 |
| `ocorrencias/Blocos.tsx` | ~6 | emerald-50/600/700, red-600, amber-500 |
| `componentes/comum/SeloAtualizacao.tsx` | ~6 | chip "XML aguardando" amber |
| `ocorrencias/PaginaOcorrencias.tsx` | ~5 | amber-50/100/300/400/900 (banner) |
| `ahgora/ApuracaoPonto.tsx` | ~5 | amber-500/600 |
| `romaneio/componentes.tsx`, `performance/Producao.tsx` | ~4 cada | amber-400/500/700 (chips de faixa) |
| `performance/relatorio-impressao.ts` | 25 hex | HTML de impressão (justificado) |
| `lib/exportacao/marca.ts` (8 hex), `impressao.ts` (3), `excel.ts` (6 rgb) | ~17 | PDF/Excel (justificado) |
| `routes/_autenticado.tsx` | 1 hex + 3 | `#212a63` fallback + `text-white` |
| `acesso/marca.ts` | 1 hex | `#212a63` |
| Demais (~15 arquivos) | 1-3 cada | `FiltroMultiplo`, `FiltroPeriodo`, `FiltroTexto`, `ErroDeRota`, `Distribuicao`, `compartilhado/segmento.ts`, etc. (quase sempre `text-white` ou `border-amber-*`) |

Também fora dos tokens: `rounded-[10px]` (85 ocorrências, igual a `--radius` mas escrito como valor) e `bg-[var(--brand)] text-white` repetido em alternadores (o token existe, não há classe utilitária). `var(--brand)` aparece ~45 vezes e `var(--status-bad)` ~29: o uso de token é majoritário em gráficos e erros; o âmbar de alerta é o que mais foge.

## 4. Tamanhos de fonte arbitrários

734 usos de `text-[Npx]` em `modulos`/`componentes` (contra ~64 de `text-xs/sm/base/lg/xl/2xl/3xl`). Distribuição: `12px` 311, `11px` 249, `10px` 117, `13px` 56, `14px` 19, `24px` 13, `9px` 7, `20px` 7, `15px` 7, `22px` 6, `18px` 5, `16px` 5, `28px` 2, `12.5px` 2, `36px`/`32px`/`26px` 1 cada; fracionários: `11.5px`, `10.5px`, `9.5px`, `12.5px`.

Títulos de página (h1) divergem:

| Tamanho/peso | Telas |
|---|---|
| `text-[26px] font-bold` | Ocorrências |
| `text-[24px] font-medium tracking-tight` | Coletas, Comprovantes, Prazo parceiro (+detalhe), Admin (`CabecalhoDaPagina`), Plataforma, Ingestão SSW, Diagnóstico |
| `text-[24px] font-semibold` | Performance, Romaneio, Importação SSW, XML CT-e |
| `text-2xl font-semibold` | Ranking, Equipes, Regras |
| `text-[22px] font-medium` | CTRC, Bonificação, Ahgora (2) |
| `text-[20px] font-semibold` (com ícone) | Histórico, Feriados, Calendário, Códigos |
| `text-lg` / `text-base` | Performance/lista |
| `text-[18px]`, `text-[16px]` | Sem acesso, Módulo desligado |

Outras: `text-[9px]` em eixos e rótulos (Romaneio `AbasDesempenho.tsx:252,1086`, `Kpis.tsx:446`, Calendário `Visoes.tsx:193,205`, `SeletorDeOcorrencia.tsx:228`, `RelatorioPeriodo.tsx:442`); `text-[11.5px]`/`text-[9.5px]` só na barra lateral; `text-[12.5px]` no `Detalhe` comum e na barra lateral; número-herói em 28/30/32/36 px conforme a tela (`Cartoes.tsx:72`, `prazo-parceiro/componentes.tsx:88`, `PaginaPrazoParceiro.tsx:403`, `.num-hero`). Tabelas: 12 px (maioria), 11 px (Ahgora), 14 px (Ranking), `text-xs` (Equipes).

## 5. Padrões repetidos e divergências

### 5.1 Componentes comuns (`componentes/comum`)

| Componente | O que faz |
|---|---|
| `Abas` | Tabs do shadcn com lista tipada, teclado e conteúdo da aba fechada desmontado (`ConteudoDaAba`). |
| `BotoesDePagina` | "Anterior"/"Próxima" das listas paginadas; quem usa escreve o "Página X de Y". |
| `ComoFunciona` / `ComoFuncionaSecao` | Botão "i" que pulsa até a 1ª abertura + diálogo com a regra da tela (guarda "visto" no localStorage). |
| `Detalhe` | Gaveta (`Sheet`) ou modal (`Dialog`) de detalhe com título, descrição e ações à direita. |
| `ErroDeRota`, `PaginaNaoEncontrada` | Telas de erro e 404. |
| `EstadoVazio` | Mensagem + detalhe + ícone + ação para lista/gráfico sem dados. |
| `ExportMenu` | Menu CSV/Excel/PDF/Imprimir com `carregarLinhas` (todas as páginas); opção `soIcone`. |
| `FiltroMultiplo` | Seletor multi-escolha com busca e contagem por opção (popover). |
| `FiltroPeriodo` | Atalhos (Hoje/7d/30d/Mês) + calendário de intervalo, com rótulo da data filtrada. |
| `FiltroTexto` | Filtro de texto multi-valor `a|b` com sugestões do servidor. |
| `FiltrosAvancados` (+ `FiltrandoPor`, `etiquetasQueLimpam`, `resumirNomes`) | Cartão de filtros com "Limpar filtros" e a faixa de etiquetas "Filtrando por". |
| `GatilhoFiltro` | Botão de filtro com "x" para limpar; base dos seletores. |
| `Graficos` (`GraficoLinha`, `GraficoBarras`) | Recharts com tooltip, linha de meta, barras empilhadas e `aoClicarBarra`. |
| `InfoTip` | Ícone "i" com tooltip. |
| `KpiCard` | Card de indicador com barra lateral, selo, progresso, clicável/ativo. |
| `LinhasCarregando`, `MensagemErro` | Esqueleto de linhas; erro amigável com "Tentar novamente". |
| `SeloAtualizacao` | "Dados atualizados em ..." + chip de XML aguardando. |
| `TabelaDados` (+ `tabela-dados.ts`) | Tabela com ordenação (cliente/servidor), paginação (cliente/servidor), seletor de colunas, exportação, estados vazio/erro/carregando. |
| `periodo.ts`, `ordenar-por-placa.ts`, `use-empresa-da-exportacao.ts` | Utilitários (intervalo do período, ordem de placas, empresa do arquivo exportado). |

Compartilhados fora de `comum`: `modulos/filtros/componentes.tsx` (`BuscaDocumento`, `SeletorDeFilial`, `SeletorDePagador(Agrupado)`, `SeletorDeTexto`, `SeletorDeTipoDocumento`, `ItemMarcavel`, `AvisoDaLista`), `modulos/compartilhado/segmento.ts` (`classeDoSegmento`), `modulos/ingestao-ssw/SeloDosDados.tsx` (envolve `SeloAtualizacao`), `modulos/admin/comum.tsx` (`CabecalhoDaPagina`, `Selo`, `Campo`).

### 5.2 Onde cada tela foge dos componentes comuns

- **Cabeçalho de página**: não existe componente comum. Há `<header>` `flex flex-wrap items-end justify-between` copiado em ~15 telas; `CabecalhoDaPagina` (só Admin e Plataforma); `<header>` sem ações (Ranking, Equipes, Regras); e blocos soltos (Empresa, Importação SSW, XML CT-e, Ahgora).
- **KPIs**: `KpiCard` só em Coletas, Comprovantes, Ranking, Códigos, Diagnóstico. Fogem com markup próprio: Performance (`KpiBox`, `CartaoDeProducao`, `Celula`), Listagem (card inline), Ocorrências (`CartaoDeMetrica`), Prazo parceiro (`CartaoMetrica`), Romaneio (`TotCard`, `CardAba`), Histórico (`CartaoTotal`), Calendário (`Indicador`), Bonificação e Ahgora (cards inline `text-[20px]`).
- **Gráficos recharts (`Graficos.tsx`)**: Performance (`GraficoSerie`), Ranking (`GraficoSerie`), Coletas, Comprovantes, Ocorrências (`ComparativoDoMes`). Fogem (barras em HTML/CSS): Listagem (`GraficoDeBarras`, clicável), Romaneio (prejuízo por dia, `BarrasPorCodigo`), Ocorrências (`LinhaDeBarra`), Prazo parceiro (barra de origem), Performance (`DistribuicaoPontualidade`, linhas de unidade). `Graficos.tsx` é o único arquivo que importa recharts.
- **Tabelas**: `TabelaDados` em Coletas, Comprovantes, Ocorrências, Códigos, Feriados, Admin, Ingestão, Plataforma. `<table>` própria em 18 arquivos: Performance (relatório), Listagem, Prazo parceiro, Ranking, Romaneio (todas as abas), Bonificação, Ahgora, Equipes, Calendário (lista), Importador050, AbasDaEmpresa. Essas não têm seletor de colunas, paginação e exportação padronizados.
- **Filtros**: `FiltrosAvancados` em Performance, Listagem, Ocorrências, Comprovantes, Coletas, Prazo parceiro, Romaneio. Fogem: Ranking (cópia do markup, sem "Limpar"), Histórico/Feriados/Códigos (`div bg-card/40` com botões e `<select>` nativos), Prazo parceiro detalhe (filtros no cabeçalho), Admin Usuários/Logs (linha solta sem cartão), Bonificação/Ahgora (formulário de apuração), Romaneio Hoje (2 `FiltroMultiplo` soltos). 22 arquivos usam `<select>` nativo, com 3 estilos (`h-7 ... bg-background`, `rounded border px-2 py-1`, `h-8 border-input shadow-sm`), ao lado do `Select` de `ui/` (Bonificação, Ahgora).
- **Alternadores segmentados** (Hoje/7d, Emissão/Previsão): 6 implementações com o mesmo desenho e cores ativas diferentes: `FiltroPeriodo` e `classeDoSegmento` (`bg-[var(--brand)] text-white`, 12 px vs 13 px com `font-semibold`), `alternador` de Performance (`bg-foreground text-background`), `BotoesDePeriodo` (Prazo), `classeDoAlternador` (Ranking), `BaseDeData` (Romaneio), botões do Histórico/Calendário (`bg-primary`).
- **Exportar**: `ExportMenu` comum em todas, mas em posições diferentes (ver seção 6).
- **"Como funciona"**: só Bonificação e Ahgora usam `ComoFunciona`. Performance/Romaneio/Prazo explicam regras em parágrafos `text-[11px]` e `title` longos.
- **Modais**: `Dialog` de `ui/` na maioria; `PaginaRegras` usa modal `fixed inset-0` próprio. Gavetas: `Detalhe` (Coletas, Comprovantes), `Sheet` direto no Romaneio Hoje.
- **Banners/alertas**: não há componente. O banner âmbar `rounded-[10px] border border-amber-300 bg-amber-50 text-amber-900` é reescrito em ~11 lugares (`PaginaCodigos:330`, `PaginaCtrc:516`, `PaginaHistorico:47,389`, `ImportadorManual:133`, `TabelaCtrcs:209`, `PaginaOcorrencias:264`, `PaginaPerformance:470,498,662`, `PaginaPrazoParceiro:267`), com uma variante em `--status-warn-bg`. Erro aparece de 4 formas (`MensagemErro`, parágrafo `--status-bad`, `border-destructive/40 bg-destructive/5`, `text-destructive`).
- **Selos de status**: `Selo` (`admin/comum`, tokens), `SeloStatus` (`ingestao/pecas.tsx`, cores Tailwind), `SeloDoStatus` (ingestao-ssw), `Selo` e `SeloDeStatus` no CTRC, `SeloDeStatus` na lista do Romaneio: cinco implementações.
- **Cartão de seção**: `Cartao` duplicado (`ingestao/pecas.tsx` e `ingestao-ssw/Cartao.tsx`), mais `Quadro` (Coletas), `Cartao` do CTRC, seções `rounded-xl shadow-sm` do Admin/Plataforma.

## 6. Inconsistências de UX percebidas

1. **Posição dos filtros**: acima dos KPIs (Performance, Coletas, Comprovantes, Ocorrências, Prazo); **abaixo dos gráficos** (Performance/lista); **abaixo das abas e dentro delas** (Ranking); **abaixo dos cards de total** (Histórico); dentro do cabeçalho (Prazo/detalhe); em formulário de "Apurar" (Bonificação, Ahgora); linha solta (Admin Usuários e Logs).
2. **"Limpar filtros"** existe só onde há `FiltrosAvancados`. Ranking tem o mesmo visual sem o botão; Histórico e Códigos têm filtros sem botão de limpar (Histórico tem só as etiquetas `FiltrandoPor`).
3. **Filtros na URL x em estado local**: Performance, Ocorrências, Comprovantes, Coletas, Romaneio, Histórico guardam na URL; Ranking, Feriados e Códigos usam `useState`; a aba da Empresa (Plataforma) também.
4. **Botão Exportar**: no cabeçalho (Performance, Comprovantes, Histórico, Listagem, CTRC), dentro da barra de filtros à direita (Ranking), só nas tabelas/cards (Coletas, Ocorrências, Prazo, Romaneio), só-ícone no cabeçalho de cartão (gráficos, tabela de unidades).
5. **"Atualizar"**: presente em Performance, Ocorrências, Coletas, Comprovantes, Prazo, Romaneio, CTRC, Listagem; ausente em Histórico, Calendário, Ranking, Códigos. A ordem dos botões do cabeçalho varia ("Importar 050", "Relatório de período", "Nova anotação" em posições diferentes).
6. **Navegação de volta**: botão com borda antes do título (Listagem), botão ghost no cabeçalho (CTRC), link `text-[11px]` acima do título (Prazo detalhe, Empresa), link sob o título (Feriados), ghost com seta (Regras, Equipe detalhe).
7. **Abas**: sticky abaixo do cabeçalho (Romaneio), abaixo do cabeçalho e antes dos filtros (Ranking), no topo da tela antes do h1 (Ahgora), dentro de sub-componente (Logs, Bonificação, Empresa). Estado na URL só no Romaneio (`b.tab`); Ranking, Ahgora e Empresa usam estado local.
8. **Título e subtítulo**: 8 combinações de tamanho/peso (seção 4); ícone ao lado do título só em Histórico, Feriados, Calendário, Códigos e Prazo; subtítulo ausente em Performance e Romaneio, `text-[13px] font-medium` em Ocorrências, `text-[12px]` na maioria, `text-sm` em Ranking.
9. **Selo "Dados atualizados"**: `SeloDosDados` (maioria) x `SeloAtualizacao` direto (Coletas) x ausente (Histórico, Calendário, Admin); posição varia (sob o h1, ou separado com `-mt-2` na Listagem).
10. **Tabelas**: tamanho de fonte (11/12/14 px), cabeçalho (`bg-muted/40` x `bg-muted/60`, `font-normal` x `font-semibold`), ordenação (ícone de seta, clique no título, só alternância pior/melhor), paginação (`rotuloTotal` e botões na `TabelaDados`; "Página X de Y" manual nas próprias; `<select>` de tamanho só em Prazo e Ocorrências).
11. **Raio e borda dos cartões**: `rounded-[10px] border-border/70` (padrão, 85 usos), `rounded-xl border-border` (Ranking regras/equipes, Admin config, Plataforma), `rounded-lg border-border/70` (Listagem), `rounded border-border/60 bg-card/40` (Histórico/Calendário/Códigos). Opacidade da borda: `/70` 162 usos, `border-border` puro 61, `/60` 46, `/40` 19.
12. **Padding de cartão**: `p-3` (19 usos do padrão), `p-4`, `p-5`, `p-6` sem regra aparente (KPIs de Performance `p-5`, cards de Ahgora `p-3`).
13. **Tipografia do número-herói**: 28/30/32/36 px conforme a tela (`.num-hero` só em `KpiBox`/`KpiCard`).
14. **Cor do alerta**: banner de aviso em âmbar fixo em ~11 lugares + `FaixaSaudeSsw` global; os tokens `--status-warn-*` quase só aparecem em selos. Regras e Equipe mobile usam `emerald-300` (tema escuro) sobre fundo claro, com pouco contraste.
15. **Tema**: tokens `.dark` e `dark:` existem, mas não há alternador; parte do código foi escrita para fundo escuro e outra para claro.
16. **Duplicidade funcional**: `/calendario` e `/historico/feriados` gerenciam feriados com cabeçalho e controles diferentes; dois `Cartao` de ingestão; cinco selos de status.
17. **Estados vazio/erro/carregando**: `EstadoVazio` e `LinhasCarregando` comuns pouco usados; há texto "carregando…" (Romaneio, Ranking, Calendário), skeletons (Histórico, Bonificação, `EsqueletoDeCards` em Performance) e texto solto.
18. **Legibilidade**: 124 usos de `text-[9px]`/`[10px]` e 249 de `[11px]` em rótulos, eixos e subtítulos, abaixo do usual para leitura.
