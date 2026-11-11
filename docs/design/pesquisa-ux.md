# Pesquisa de UX: dashboards e telas operacionais de logística

Pesquisa feita em novembro de 2026 com fontes de 2024–2026, completadas por normas e design systems
estáveis (WCAG 2.2, Carbon, Radix, NN/g). Público: operadores e gestores de transportadora, uso diário
no desktop e às vezes no celular.

**Como usar:** cada regra diz o que fazer, por que e de onde vem. Onde a regra conflitar com a paridade
com o sistema atual (CLAUDE.md: "o usuário não pode perceber diferença"), a paridade vence e a regra
vai para `docs/mudancas-visiveis.md` como proposta.

**Peso das fontes:** W3C, NN/g, Baymard e design systems (Carbon, Radix, GOV.UK, Material) são
referência. Blogs de agência e de fornecedor (saasui, lollypop, cieden, aufait) são só convenção de
mercado. Números como "200 ms" ou "5 KPIs" são regra prática, não norma.

---

## 1. Arquitetura da página de dashboard

**Ordem de leitura**

- Ponha os KPIs no topo e o detalhe embaixo, no padrão F (do mais importante para o menos). O olho
  começa no canto superior esquerdo, e quem abre o painel quer o quadro geral primeiro.
  [Carbon – Dashboards](https://carbondesignsystem.com/data-visualization/dashboards/)
- Dê ao dado mais importante o maior contraste e a maior área, e corte o que distrai. O dashboard
  existe para ser lido de relance, sem esforço de exploração.
  [NN/g – Dashboards: preattentive](https://www.nngroup.com/articles/dashboards-preattentive/)
- Limite a ~5 elementos de destaque por tela e jogue o resto para seções recolhíveis ou telas de
  detalhe. Painel operacional é ferramenta de decisão sob pressão de tempo.
  [Smashing 2025 – Real-time dashboards](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)

**Cabeçalho**

- O cabeçalho leva título + contexto: unidade/filial, período aplicado e "Dados de 10:42" com botão
  de atualizar. Sem carimbo de hora o operador não sabe se o número está velho.
  [Smashing 2025](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)
- Mostre o estado da carga ("Ao vivo", "Desatualizado", "Pausado") quando houver atualização
  automática. Assim número parado não se confunde com número estável. [Smashing 2025](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)

**Filtros**

- Ponha os filtros acima do conteúdo, numa barra horizontal sempre no mesmo lugar em todas as
  telas. Barra lateral só quando houver mais de ~6 filtros. Filtro acima do resultado e sem
  deslocar o layout deixa claro o que ele afeta.
  [Smart Interface Design Patterns – Filtering](https://smart-interface-design-patterns.com/articles/filtering-ux/)
- Deixe a barra de filtros fixa (sticky) no topo quando a página rolar. Quem rola até a tabela
  continua vendo o recorte aplicado. É convenção de mercado, não estudo.
  [aufait – Dashboard filter guide](https://www.aufaitux.com/blog/dashboard-filter-design-guide/)
- Mostre os filtros ativos como chips removíveis ("Filial: SP ×") logo abaixo da barra. 28% dos
  sites não mostram resumo de filtros aplicados, e o usuário precisa caçar o que está ligado.
  [Baymard – Applied filters](https://baymard.com/research-articles/how-to-design-applied-filters),
  [SAP Fiori – Filter feedback bar](https://www.sap.com/design-system/fiori-design-android/v26-4/components/filter-feedback-bar/usage)
- Deixe um "Limpar filtros" sempre visível quando houver filtro fora do padrão, com contagem
  ("3 filtros · limpar"). Tela filtrada que parece igual à não filtrada gera desconfiança.
  [saasui – Filtering](https://www.saasui.design/blog/saas-filtering-sorting-ux-patterns),
  [aufait](https://www.aufaitux.com/blog/dashboard-filter-design-guide/)
- Guarde filtros e período na URL (query string). O link compartilhado abre o mesmo recorte e o
  "voltar" do navegador funciona. [saasui – Filtering](https://www.saasui.design/blog/saas-filtering-sorting-ux-patterns)
- Aplicar na hora ou com botão "Aplicar": use o botão quando a consulta demorar (regra prática:
  mais de alguns segundos) ou quando o usuário costuma combinar vários critérios. A escolha
  depende da intenção e da velocidade.
  [NN/g – Applying filters](https://www.nngroup.com/articles/applying-filters/)

**Período e datas**

- Ofereça atalhos de período ("Hoje", "7 dias", "Mês atual", "Mês anterior") e o intervalo
  personalizado à parte. O período sempre aparece por extenso no cabeçalho.
  [saasui – KPI cards](https://www.saasui.design/blog/saas-metric-kpi-card-ux-patterns)

**Ações**

- Ponha ações de página (Exportar, Imprimir) no canto direito do cabeçalho, uma primária e as
  outras num menu "⋯". Ações por gráfico ficam no canto do card do gráfico. Cada ação tem que ter
  escopo óbvio. [Carbon – Chart anatomy](https://carbondesignsystem.com/data-visualization/chart-anatomy/)
- Quando um filtro mexe em um gráfico, os outros gráficos ligados ao mesmo dado têm que acompanhar
  (filtro cruzado). Visões diferentes do mesmo recorte não podem discordar.
  [Carbon – Dashboards](https://carbondesignsystem.com/data-visualization/dashboards/)
- Use views por papel (gestor vê KPIs, operador vê pendências) em vez de um painel único para
  todos. [Smashing 2025](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)

## 2. Cards de KPI

- Monte o card nesta ordem: rótulo (pequeno, neutro), valor (grande, peso forte), variação
  (▲/▼ + %) e comparação escrita ("vs mês anterior", "meta 95%"). O card tem que responder
  três coisas: quanto é, quanto mudou, se isso é bom.
  [saasui – KPI cards](https://www.saasui.design/blog/saas-metric-kpi-card-ux-patterns)
- Use uma comparação por card. Três períodos no mesmo card viram ruído.
  [mljar – KPI card design](https://mljar.com/ai-prompts/data-visualization-specialist/dashboard-architecture/prompt-kpi-card-design/)
- Separe direção de juízo. A seta diz para onde o número foi e a cor diz se isso é bom. Em
  "ocorrências" ou "atraso", subir é ruim. Configure o "bom sentido" por métrica.
  [saasui – KPI cards](https://www.saasui.design/blog/saas-metric-kpi-card-ux-patterns)
- Para métrica com meta (% no prazo), prefira bullet graph ou barra com linha de meta a um
  velocímetro. Ocupa menos espaço e compara valor, meta e faixas de uma vez.
  [Bullet graph (Stephen Few)](https://en.wikipedia.org/wiki/Bullet_graph),
  [Perceptual Edge](https://www.perceptualedge.com/blog/?p=217)
- Adicione um sparkline sem eixo, no mesmo período do card e com o último ponto destacado, quando a
  tendência importar. Ele mostra o caminho por trás do delta.
  [Smashing 2025](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)
- Use 3 a 5 cards por linha no desktop, 2 no tablet e 1 (ou carrossel de 2) no celular, todos com a
  mesma estrutura. Dê mais peso visual só aos 1–3 KPIs principais.
  [saasui](https://www.saasui.design/blog/saas-metric-kpi-card-ux-patterns),
  [Smashing 2025](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)
- Card clicável aplica o filtro correspondente ou leva ao detalhe exato daquele número e período
  ("Ocorrências: 12" abre a lista das 12). Indique que é clicável (cursor, hover, chevron) e use
  `button`/`a` de verdade. Card só informativo não finge ser link.
  [saasui](https://www.saasui.design/blog/saas-metric-kpi-card-ux-patterns)
- Cores semânticas: vermelho = crítico, âmbar = alerta, verde/azul = ok, cinza = histórico. Pinte o
  delta ou um ícone, nunca o fundo inteiro do card.
  [Smashing 2025](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/),
  [mljar](https://mljar.com/ai-prompts/data-visualization-specialist/dashboard-architecture/prompt-kpi-card-design/)
- Não dependa só de cor: a cor sempre vem com seta, sinal (+/−), ícone ou texto ("acima da meta").
  Cerca de 8% dos homens têm deficiência de cor, e WCAG 1.4.1 proíbe a cor como único meio.
  [WCAG 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
- Abrevie de forma consistente (1,2 mi; R$ 45,3 mil), sempre no padrão pt-BR, e use
  `font-variant-numeric: tabular-nums` para os números não "pularem" ao atualizar.
  [saasui](https://www.saasui.design/blog/saas-metric-kpi-card-ux-patterns)
- Separe três estados: zero de verdade ("0"), sem dados ("—" + "Sem dados no período") e erro
  ("Não foi possível carregar · Tentar de novo"). Mostrar zero quando houve erro é mentir.
  [saasui](https://www.saasui.design/blog/saas-metric-kpi-card-ux-patterns)

## 3. Gráficos interativos

**Qual gráfico usar**

- Linha para evolução no tempo (entregas por dia). Barra para comparar categorias (filiais,
  motoristas, tipos de ocorrência). Barra horizontal quando os rótulos forem longos. Barra empilhada
  para composição dentro de cada categoria.
  [Carbon – Chart types](https://www.carbondesignsystem.com/data-visualization/chart-types/)
- Donut só para parte-do-todo com 2 a 5 fatias e com o total no centro. Acima disso, barra: o olho
  compara comprimento e posição muito melhor que ângulo e área.
  [NN/g – Preattentive](https://www.nngroup.com/articles/dashboards-preattentive/),
  [Wikimedia Codex – Data viz](https://doc.wikimedia.org/codex/latest/style-guide/data-visualization.html)
- Agrupe fatias pequenas em "Outros" em vez de inventar mais cores.
  [Datawrapper – Fewer colors](https://www.datawrapper.de/blog/10-ways-to-use-fewer-colors-in-your-data-visualizations)
- Barra e área sempre começam no zero. Linha pode não começar, desde que o eixo deixe isso claro.
  Área sem zero distorce a proporção.
  [Datawrapper – Area charts](https://www.datawrapper.de/blog/area-charts),
  [Wikimedia Codex](https://doc.wikimedia.org/codex/latest/style-guide/data-visualization.html)
- Área com gradiente (cor da série com ~30% de opacidade no topo indo a 0% embaixo) é estética.
  Use só com uma série, ou empilhada quando o total importar. Com várias séries sobrepostas, use
  linha. [Datawrapper – Area charts](https://www.datawrapper.de/blog/area-charts)

**Interação**

- O tooltip repete o valor dos dois eixos e o contexto: data, série, valor formatado e, se houver,
  a variação. Em gráfico com várias séries, um tooltip único lista todas no ponto do eixo X.
  [Carbon – Chart anatomy](https://carbondesignsystem.com/data-visualization/chart-anatomy/),
  [DevExpress – Chart a11y](https://docs.devexpress.com/Blazor/405844/components/charts/accessibility)
- Crosshair (linha vertical que segue o cursor) só em gráfico X/Y de tempo. Em barras e donut, basta
  o tooltip. [ZingChart – Tooltips & crosshairs](https://blog.zingsoft.com/tooltips-and-crosshairs-for-interactive-graphs/)
- A legenda é clicável: clicar isola ou oculta a série, com estado visível (check/opacidade), e hover
  na legenda esmaece as outras séries para ~30%. Rotule a série direto na linha quando couber, e sem
  legenda se só houver uma série.
  [Carbon – Legends](https://carbondesignsystem.com/data-visualization/legends/)
- A legenda tem que funcionar pelo teclado: Tab chega nela, Enter/Espaço alterna, `role="checkbox"` ou
  `aria-pressed` anuncia o estado.
  [Syncfusion – Chart a11y](https://ej2.syncfusion.com/react/documentation/chart/accessibility)
- Drill-down no clique: clicar numa barra (filial X) aplica o filtro ou abre o detalhe, e um "voltar"
  ou chip de filtro mostra onde você está. O caminho tem que ser reversível.
  [Carbon – Dashboards](https://carbondesignsystem.com/data-visualization/dashboards/)
- Ofereça "Ver como tabela" em cada gráfico. Isso dá alternativa acessível e valor exato para quem
  vai conferir número.
  [Carbon – Chart anatomy](https://carbondesignsystem.com/data-visualization/chart-anatomy/)

**Cores**

- Use paleta categórica fixa, aplicada sempre na mesma ordem e com a mesma cor para a mesma
  entidade em todo o sistema (filial SP é sempre azul). A ordem curada maximiza o contraste entre
  vizinhas. [Carbon – Color palettes](https://carbondesignsystem.com/data-visualization/color-palettes/)
- Paleta segura para daltônicos: Okabe-Ito (8 cores) ou a da Carbon. Marcas e linhas precisam de 3:1
  contra o fundo (WCAG 1.4.11), e linhas diferentes também se distinguem por tracejado.
  [Carbon – Paletas e a11y](https://medium.com/carbondesign/color-palettes-and-accessibility-features-for-data-visualization-7869f4874fca),
  [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast)
- Reserve vermelho/âmbar/verde para status (alerta) e não use esses tons como cor categórica. Senão
  "filial vermelha" vira "filial com problema".
  [Carbon – Color palettes](https://carbondesignsystem.com/data-visualization/color-palettes/)
- Use paleta sequencial (um matiz, claro→escuro) para intensidade (mapa de calor). No tema escuro,
  inverta: o mais claro é o maior valor. [Carbon – Color palettes](https://carbondesignsystem.com/data-visualization/color-palettes/)

**Estados**

- Carregando: skeleton com o formato do gráfico ou da tabela, e não spinner genérico. Assim o
  layout não pula. [Q2 Tecton – States](https://tecton.q2developer.com/patterns/designing-for-states/),
  [Smashing 2025](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)
- Vazio: diga por quê ("Nenhuma entrega no período") e o que fazer ("Ampliar período",
  "Limpar filtros"). Diferencie "ainda não há dados" de "o filtro não achou nada".
  [UI/UX Atlas – System states](https://uiux-atlas.pages.dev/lessons/interaction-design/system-states-loading-skeleton-empty-error-and-success)
- Erro: mensagem + "Tentar de novo", isolado no card que falhou, para o resto do painel continuar
  funcionando. Use `role="alert"`. Erro com cara de "vazio" faz o usuário achar que não houve
  movimento. [UI/UX Atlas](https://uiux-atlas.pages.dev/lessons/interaction-design/system-states-loading-skeleton-empty-error-and-success)

## 4. Tabelas densas

- Alinhe número, moeda e peso à direita, com `tabular-nums`, e o cabeçalho com o mesmo alinhamento
  da coluna. Texto fica à esquerda. Data, CEP, placa e CT-e são identificadores e ficam à esquerda.
  Os dígitos alinham e a magnitude se compara de relance.
  [Elastic EUI – Table layout](https://eui.elastic.co/docs/components/tables/layout-guidelines/),
  [Primer – Data table](https://primer-docs-preview.github.com/product/components/data-table/guidelines)
- Cabeçalho fixo (sticky) em toda tabela maior que a tela, com divisória ou sombra separando do
  corpo. [Visa – Table](https://design.visa.com/components/table/usage/),
  [saasui – Tables](https://saasui.design/blog/saas-data-table-ux-patterns)
- Fixe a coluna identificadora (CT-e, motorista, placa) em tabela larga, para não perder a linha ao
  rolar para o lado. [NN/g – Mobile tables](https://www.nngroup.com/articles/mobile-tables/),
  [saasui](https://saasui.design/blog/saas-data-table-ux-patterns)
- Prefira separadores horizontais finos e hover na linha. Zebra (fundo sutil, passo 2 da escala) só
  em tabela muito larga com poucas linhas de grade. Grade pesada + zebra piora a leitura.
  [Matthew Ström – Tables](https://matthewstrom.com/writing/tables),
  [Radix – Scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)
- Ofereça densidade "confortável" e "compacta" (linhas ~40 px e ~32 px) e lembre a escolha do
  usuário. Operador experiente quer mais linhas na tela.
  [saasui](https://saasui.design/blog/saas-data-table-ux-patterns)
- Cabeçalho clicável ordena, com ícone ▲/▼ visível só na coluna ativa e `aria-sort`. A ordenação
  padrão faz sentido para a tarefa (ex.: atraso maior primeiro).
  [Pencil & Paper – Enterprise tables](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables)
- Paginação com total ("1–50 de 1.284") em listas operacionais, porque dá posição estável para
  voltar. Scroll infinito só para exploração, e sempre com filtro forte. Acima de algumas centenas
  de linhas, virtualize. [saasui](https://saasui.design/blog/saas-data-table-ux-patterns)
- Ações por linha: 1–2 visíveis (ícone com tooltip) e o resto num menu "⋯" no fim da linha. Ação
  destrutiva tem cor própria e pede confirmação ou oferece desfazer.
  [saasui](https://saasui.design/blog/saas-data-table-ux-patterns)
- Seleção em massa: checkbox por linha + "selecionar todos" no cabeçalho abre uma barra de ações em
  massa. [saasui](https://saasui.design/blog/saas-data-table-ux-patterns)
- Celular: se o usuário compara linhas (ranking), use rolagem horizontal com primeira coluna fixa e
  indicação visível de que há mais colunas. Se cada linha é um registro independente (romaneio,
  ocorrência), vire card com rótulo + valor. Escolha mostrar menos colunas antes de espremer todas.
  [NN/g – Mobile tables](https://www.nngroup.com/articles/mobile-tables/),
  [Ramotion – Mobile tables](https://www.ramotion.com/blog/mobile-tables-design/)
- Ao virar card, não troque a `<table>` por `display:block` sem repor a semântica. Isso tira a
  tabela do leitor de tela. Renderize uma lista de verdade para o celular.
  [Digital Thrive – Responsive tables a11y](https://www.digitalthriveai.com/en-us/resources/frontend-development/accessible-front-end-patterns-responsive-tables-part2/)

## 5. Navegação

- Sidebar com grupos rotulados (ex.: "Operação", "Cadastros", "Administração") e conta/usuário no
  rodapé. Agrupar destinos relacionados reduz a busca visual.
  [Singapore GDS – Sidebar](https://designsystem.tech.gov.sg/components/sidebar),
  [shadcn – Sidebar](https://ui.shadcn.com/docs/components/sidebar)
- Estrutura em três faixas: cabeçalho fixo (logo/empresa), meio rolável (menus) e rodapé fixo
  (tema claro/escuro, notificações, usuário). Nenhum link importante pode ficar preso atrás do bloco
  da conta. [shadcn](https://ui.shadcn.com/docs/components/sidebar),
  [saasui – Sidebar](https://www.saasui.design/blog/saas-sidebar-navigation-ux-patterns)
- Item ativo: um só na sidebar inteira, derivado da rota, visualmente diferente do hover (fundo +
  barra lateral + peso), com `aria-current="page"`. O grupo que contém o ativo fica aberto, mas sem o
  preenchimento de ativo. [Perforce – Sidebar spec](https://the-force-design-spec-site.public.dev.shared.perforce.com/patterns/layouts/sidebar-navigation/)
- Recolhível para trilho de ícones, com tooltip em cada ícone, o ativo ainda visível, estado lembrado
  entre sessões e atalho Ctrl+B. No celular, vira gaveta (sheet) sobre o conteúdo.
  [shadcn](https://ui.shadcn.com/docs/components/sidebar),
  [saasui – Sidebar](https://www.saasui.design/blog/saas-sidebar-navigation-ux-patterns)
- Sidebar escura com conteúdo claro funciona, mas o texto do menu precisa de 4,5:1 sobre o fundo
  escuro e o ativo de 3:1 contra o vizinho. [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
  [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast)
- Busca/command palette com Ctrl+K: o mesmo atalho abre e fecha, Esc fecha, setas navegam, Enter
  executa. Itens recentes primeiro, resposta em menos de ~200 ms e atalho ao lado de cada comando para
  ensinar. Não sequestre Ctrl+F, que é a busca do navegador e o usuário espera ela.
  [Superhuman – Command palette](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/),
  [Chameleon – Cmd+K](https://chameleon.io/patterns/cmd-k-search)
- Mostre a palette também como campo "Buscar… Ctrl K" visível na sidebar ou no topo. O padrão ainda
  não é universal, e quem não conhece atalho precisa de uma porta.
  [UX Patterns – Command palette](https://outdraw-academy.gitbook.io/ux-patterns/command-palette)
- Notificações: sino com contador no rodapé ou no topo, e painel não modal. Alertas críticos da
  operação ficam na borda do painel com alto contraste e "Por que este alerta?".
  [Smashing 2025](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)

## 6. Tema claro/escuro com cor de marca por cliente

**Derivar a paleta de UMA cor**

- Converta a cor da empresa para OKLCH e gere a escala de 12 passos variando só a luminosidade (L),
  com o matiz (H) fixo e o croma (C) reduzido nas pontas. Em OKLCH, o mesmo L parece igualmente claro
  em qualquer matiz. Em HSL não.
  [Evil Martians – OKLCH](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl),
  [Atmos – Color system](https://atmos.style/blog/how-to-build-a-color-system-for-ui-design)
- Atribua papel fixo a cada passo (modelo Radix): 1–2 fundo do app/card, 3–5 fundo de componente
  (normal/hover/selecionado), 6–8 bordas e anel de foco, 9 cor sólida da marca, 10 hover da sólida,
  11 texto de baixo contraste, 12 texto de alto contraste. O mesmo papel vale nos dois temas, com
  valores diferentes.
  [Radix – Understanding the scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)
- Gere também um cinza "tingido" (o mesmo H com C ≈ 0,01–0,02) para fundos e bordas. A interface fica
  com a cara da marca sem colorir tudo. [Atmos](https://atmos.style/blog/how-to-build-a-color-system-for-ui-design)
- Se a cor da marca for quase cinza (croma baixo), use um croma mínimo para a escala de destaque, como
  o Material faz com a cor-semente.
  [Material Color Utilities](https://github.com/material-foundation/material-color-utilities)

**Contraste e texto**

- Calcule o texto sobre a cor da marca automaticamente: branco ou quase-preto, o que der mais
  contraste. Em CSS moderno, `contrast-color(var(--marca))`. Antes disso, calcule no backend ou no
  build e salve como token. Amarelo/âmbar/lima pedem texto escuro.
  [MDN – contrast-color()](https://developer.mozilla.org/docs/Web/CSS/color_value/contrast-color),
  [Chrome – contrast-color](https://developer.chrome.com/docs/modern-web-guidance/guides/visual-design/contrast-color),
  [Radix](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)
- Valide toda combinação em WCAG 2.x, porque L do OKLCH não é a luminância do WCAG: 4,5:1 para texto
  normal, 3:1 para texto grande, ícones, bordas de input e foco. Se a cor da marca não passar como
  fundo de botão, escureça ou clareie só o L até passar. O matiz se mantém.
  [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
  [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast),
  [Colorbox (Lyft) – Accessible palette](https://colorbox.io/accessible-color-palette)
- Regra prática de tom (Material): diferença de 40 de tom garante ≥3:1 e diferença de 50 garante
  ≥4,5:1. A primária fica em ~40 no claro e ~80 no escuro, com o texto sobre ela em 100/20.
  [Material – Tone-based surfaces](https://material.io/blog/tone-based-surface-color-m3)

**Tokens e tema escuro**

- Componentes só usam tokens semânticos (`--fundo`, `--fundo-card`, `--borda`, `--texto`,
  `--texto-suave`, `--marca`, `--marca-texto`, `--perigo`…), nunca hex. Trocar tema ou cliente vira
  trocar variáveis num lugar só.
  [Evil Martians](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl),
  [Radix – Aliasing](https://www.radix-ui.com/colors/docs/overview/aliasing)
- Hover e variações saem de relative color syntax:
  `oklch(from var(--marca) calc(l - 0.05) c h)`. Uma regra serve a todas as marcas.
  [Evil Martians](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl)
- Tema escuro: fundo cinza-escuro (ex.: ~#121212 ou o passo 1 do cinza tingido), não preto puro.
  Elevação por superfície mais clara, não por sombra. Texto em branco suavizado. Cores saturadas
  levemente dessaturadas para não "vibrar".
  [Material – Dark theme](https://m2.material.io/design/color/dark-theme),
  [Atmos – Dark mode](https://atmos.style/blog/dark-mode-ui-best-practices)
- Cores de status (perigo/alerta/ok) são fixas do sistema, nunca derivadas da marca. Assim não colidem
  quando o cliente tiver marca vermelha ou verde.
  [Carbon – Color palettes](https://carbondesignsystem.com/data-visualization/color-palettes/)
- O tema segue `prefers-color-scheme` por padrão, com alternância manual no rodapé da sidebar e a
  escolha lembrada. Defina `color-scheme: light dark` para os controles nativos acompanharem.
  [MDN – prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)

## 7. Formulários, modais e telas de cadastro/admin

- Formulário em uma coluna, agrupado em seções com título ("Dados do motorista", "Documentos",
  "Acesso"). Campos curtos e relacionados (UF + Cidade) podem dividir a linha. O eixo vertical diz
  como preencher. [Theorem – Button alignment](https://journal.theoremone.co/articles/button-ambiguity-alignment-order)
- Rótulo sempre visível acima do campo. Placeholder não é rótulo, porque some ao digitar.
  [Cieden – Login](https://cieden.com/book/pages-and-flows/login/login-page-design)
- Valide no blur (ao sair do campo), não a cada tecla. Campo obrigatório vazio só acusa no envio. Ao
  enviar com erro, foque o primeiro erro. Erro durante a digitação gera falso alarme.
  [Smashing – Live validation](https://www.smashingmagazine.com/2022/09/inline-validation-web-forms-ux/),
  [UXPin – Error feedback](https://www.uxpin.com/studio/blog/error-feedback-best-practices-mobile-forms/)
- A mensagem de erro fica logo abaixo do campo, diz o que fazer ("Informe a placa no formato
  ABC1D23") e é a mesma que o backend devolve. Em formulário longo, um resumo de erros no topo leva a
  cada campo.
  [GOV.UK – Error message](https://design-system.service.gov.uk/components/error-message),
  [GOV.UK – Error summary](https://design-system.service.gov.uk/components/error-summary)
- Associe o erro ao campo (`aria-describedby`, `aria-invalid`) e marque com ícone + texto, não só
  borda vermelha. [WCAG 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
- Uma ação primária por tela ou modal. Em página, os botões ficam alinhados com o formulário e a
  primária vem primeiro na leitura. Em modal, primária à direita. Destrutiva com cor de perigo e
  verbo explícito ("Excluir motorista", não "OK").
  [Theorem](https://journal.theoremone.co/articles/button-ambiguity-alignment-order),
  [PatternFly – Modal](https://patternfly.org/components/modal/design-guidelines)
- Em cadastro longo, a barra de ações fica fixa no rodapé (Salvar/Cancelar), e sair com alteração não
  salva pede confirmação. [NN/g – Modal dialogs](https://www.nngroup.com/articles/modal-nonmodal-dialog/)
- Modal só para tarefa curta e focada (confirmar exclusão, editar 2–5 campos) ou para evitar perda
  irreversível. Cadastro completo é página própria ou painel lateral. Modal bloqueia o contexto e
  cobra interação. [NN/g – Modal dialogs](https://www.nngroup.com/articles/modal-nonmodal-dialog/)
- Lista de cadastro = tabela (seção 4) + busca + filtro + botão "Novo" no canto superior direito.
  Feedback de salvar via toast curto, com "Desfazer" quando possível.
  [saasui – Tables](https://saasui.design/blog/saas-data-table-ux-patterns)

## 8. Tela de login B2B

- Split screen só no desktop (≥1024 px): de um lado o formulário, com mais peso visual, do outro a
  ilustração ou foto da operação com a marca do cliente. No celular, só o formulário com o logo. A
  identidade não pode competir com a tarefa.
  [Lollypop – SaaS login 2025](https://lollypop.design/blog/2025/october/saas-login-page-design/),
  [Cieden](https://cieden.com/book/pages-and-flows/login/login-page-design)
- Formulário curto: e-mail/usuário, senha com "Mostrar", "Esqueci a senha" junto do campo de senha e
  botão "Entrar" largo. Use `autocomplete="username"` e `"current-password"` para o gerenciador de
  senhas funcionar.
  [UXPin – Login page](https://www.uxpin.com/studio/blog/login-page-design),
  [Smashing – 2-page login](https://www.smashingmagazine.com/2024/06/2-page-login-pattern-how-fix-it)
- Se houver SSO ou passkey, use primeiro o identificador e depois o método. Mas não esconda o campo de
  senha numa segunda página sem necessidade, porque isso quebra o gerenciador de senhas.
  [Smashing – 2-page login](https://www.smashingmagazine.com/2024/06/2-page-login-pattern-how-fix-it),
  [Cieden](https://cieden.com/book/pages-and-flows/login/login-page-design)
- O erro de login é genérico ("E-mail ou senha incorretos"), para não revelar se a conta existe, e é
  anunciado ao leitor de tela. [Cieden](https://cieden.com/book/pages-and-flows/login/login-page-design)
- Tema da marca por tokens (logo, cor), sem quebrar contraste do botão nem visibilidade do erro.
  [Cieden](https://cieden.com/book/pages-and-flows/login/login-page-design)

## 9. Microinterações e acessibilidade

- Foco visível em todo elemento interativo, com anel de 2 px a ≥3:1 contra o fundo (passo 8 da
  escala) e `:focus-visible` para não aparecer no clique do mouse. O elemento focado não pode ficar
  coberto por header ou barra sticky (WCAG 2.4.11). Use `scroll-padding-top` igual à altura da barra.
  [W3C – New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/),
  [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast)
- Alvo de clique de no mínimo 24×24 px (WCAG 2.5.8 AA). Mire em 44×44 px no celular e nos ícones de
  ação da tabela. [W3C – New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/),
  [WebAIM – WCAG 2.2](https://webaim.org/standards/wcag/wcag22)
- Durações: 100–150 ms para resposta a clique/hover, ~200 ms para a maioria das transições, 300–600 ms
  para animar gráfico. Nada acima de ~400 ms em interação frequente.
  [Smashing 2025](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)
- Respeite `prefers-reduced-motion`: troque deslocamento, zoom e contagem animada por fade ou corte
  seco. Mantenha spinner e skeleton, que são feedback e não enfeite. Não zere tudo com seletor `*`.
  [WCAG 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html),
  [MDN – prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- Atualizações automáticas relevantes (novo alerta, contagem mudou) são anunciadas por `aria-live`
  educado, sem roubar o foco, e com frequência controlada para não piscar tudo junto.
  [Smashing 2025](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)
- Tudo funciona pelo teclado: filtros, chips (remover com Enter/Backspace), legenda, ordenação,
  menu "⋯" e modal (foco preso dentro, Esc fecha, foco volta ao gatilho).
  [Syncfusion – Chart a11y](https://ej2.syncfusion.com/react/documentation/chart/accessibility),
  [NN/g – Modal dialogs](https://www.nngroup.com/articles/modal-nonmodal-dialog/)

---

## Checklist para revisar cada tela

1. O título e o contexto (filial, período, "dados de hh:mm") estão no cabeçalho?
2. Os filtros estão no mesmo lugar das outras telas e continuam visíveis ao rolar?
3. Cada filtro ativo aparece como chip removível, e há "Limpar filtros" com contagem?
4. O recorte (filtros + período) está na URL e sobrevive a F5 e ao link compartilhado?
5. Os KPIs principais estão no topo, com rótulo, valor, delta e "vs período/meta" escritos?
6. O delta tem seta/sinal além da cor, e o "bom sentido" de cada métrica está certo?
7. O card clicável é `button`/`a`, parece clicável e leva ao detalhe exato do número?
8. O tipo de gráfico combina com a pergunta (linha = tempo, barra = comparação, donut ≤5 fatias)?
9. Barra e área começam no zero?
10. A mesma entidade tem a mesma cor em todos os gráficos, e as cores de status não são usadas como
    categoria?
11. O tooltip mostra data, série e valor formatado em pt-BR, e a legenda alterna séries pelo mouse e
    pelo teclado?
12. Há "Ver como tabela" ou outra forma de ler o valor exato?
13. Os estados de carregando (skeleton), vazio (com motivo e ação) e erro (com "Tentar de novo",
    isolado) existem?
14. Na tabela, número fica à direita com `tabular-nums`, o cabeçalho é sticky e a coluna-chave fica
    fixa quando é larga?
15. A tabela mostra "X–Y de Z", e a ordenação padrão serve à tarefa?
16. As ações por linha são no máximo 2 visíveis + "⋯", e a destrutiva pede confirmação?
17. No celular (375 px) não há rolagem horizontal da página, e a tabela vira card ou rola com a
    primeira coluna fixa?
18. A sidebar tem um único item ativo com `aria-current`, os grupos têm rótulo e o recolhido mostra
    tooltip?
19. Ctrl+K abre a busca, e Ctrl+F continua sendo do navegador?
20. Nenhum componente usa hex: só tokens semânticos, e a tela funciona nos temas claro e escuro?
21. O texto passa 4,5:1, e ícones, bordas de input e foco passam 3:1 com a cor do cliente aplicada?
22. O formulário está em seções, com rótulo visível, validação no blur, erro abaixo do campo com
    instrução e uma única ação primária?
23. O modal é usado só para tarefa curta, com foco preso dentro, Esc fechando e o foco voltando ao
    gatilho?
24. Todo alvo tem ≥24 px (44 px no celular), e o foco está visível e nunca coberto pela barra sticky?
25. A animação fica abaixo de ~400 ms e há `prefers-reduced-motion` sem matar spinner e skeleton?
