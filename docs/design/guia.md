# Guia de design do painel

Fonte da verdade do visual das telas do `apps/web`. Referências: `mockups/` (login, dashboard e
rodapé da barra lateral), `pesquisa-ux.md` (boas práticas com fontes) e `inventario-telas.md`
(como as telas estavam antes da mudança).

**O que não muda:** funcionalidade, números, textos, URLs e parâmetros de busca, exportações,
permissões. Nada é removido; tudo é reorganizado para ficar mais fácil de usar.

## 1. Cor e tema

- A cor da empresa (`empresas.cor_primaria`, cadastrada em Plataforma › Empresas › Dados) gera a
  paleta inteira em `src/access/brand.ts` (`paletaDaMarca`), com contraste WCAG AA garantido
  para qualquer cor. Variáveis cruas: `--marca`, `--marca-fg`, `--marca-texto`, `--marca-clara`,
  `--lateral`, `--lateral-destaque`. **As telas não usam essas cruas**, usam os tokens abaixo.
- Tema claro/escuro: chave no rodapé da barra lateral e na busca rápida (`src/lib/theme.ts`,
  classe `.dark` no `<html>`; sempre começa no claro, a troca vale enquanto a aba estiver aberta).
- **Proibido nas telas:** hex solto (`#212a63`, `text-[#...]`), cores da paleta do Tailwind
  (`amber-*`, `emerald-*`, `red-*`, `slate-*`, `gray-*`, `blue-*`, `white`/`black` para fundo ou
  texto). Exceção: exportação/impressão (`lib/export`, `relatorio-impressao.ts`), que gera
  arquivo e não segue o tema.

| Para | Use |
| --- | --- |
| Fundo da página | `bg-background` |
| Moldura de cartão (cinza-claro) | `bg-superficie` |
| Cartão / tabela / campo | `bg-card` |
| Área neutra, cabeçalho de tabela, trilho | `bg-muted` |
| Campo "cheio" sem borda (login, busca) | `bg-campo` |
| Texto principal / secundário | `text-foreground` / `text-muted-foreground` |
| Borda | `border-border` (sem `/70`, `/60`: o token já é suave) |
| Cor da marca como texto/ícone/borda | `text-brand`, `border-brand`, `bg-brand-suave` (fundo leve) |
| Botão/realce sólido da marca | `bg-primary text-primary-foreground` |
| Item selecionado/ativo em lista | `bg-accent text-accent-foreground` |
| Situação bom / alerta / ruim / info | `status-good*`, `status-warn*`, `status-bad*`, `status-info*` (`-fg` texto, `-bg` fundo, sem sufixo para traço/ponto/barra) |
| Séries de gráfico | 1ª `var(--brand)`; depois `var(--serie-2)`, `var(--serie-3)`, `var(--serie-4)`, `var(--serie-7)`, `var(--serie-5)` nessa ordem (validada para daltonismo). Comparação/período anterior: `var(--grafico-comparacao)` |
| Sombra | `shadow-cartao` (cartões), `shadow-flutuante` (popover, menu, dica) |

Situação **nunca só por cor**: sempre ícone + texto (`SeloStatus`, `KpiCard`, `Aviso`). Cores de
status são reservadas para status — nunca para "série 4" de gráfico.

## 2. Tipografia (Manrope)

Use só esta escala. Nada de `text-[9px]`, `[9.5px]`, `[10px]`, `[10.5px]`, `[11.5px]` soltos.

| Papel | Classe |
| --- | --- |
| Título da página | (o `Pagina` cuida: 22–24 px, 700) |
| Título de seção | `Secao` (16 px, 700) ou `text-[16px] font-bold` |
| Título de cartão/painel | `text-[15px] font-bold` (ou o `titulo` do `Painel`) |
| Rótulo de cartão, coluna, grupo (CAIXA ALTA) | `label-xs` (11 px, 600, espaçado) |
| Corpo, tabela, filtros, botões | `text-[13px]` |
| Texto de apoio, meta, rodapé de cartão | `text-[12.5px]` ou `text-xs` (12 px) `text-muted-foreground` |
| Número de KPI | `num-hero` (28 px, 700, `tabular-nums`) |
| Número em tabela | `tabular-nums`, alinhado à direita |

Pesos: 400 corpo, 500 rótulos de controle, 600 ênfase, 700 títulos e números.

## 3. Página (`components/layout/Page.tsx`)

**Toda tela logada começa com `<Pagina>`** (o layout não põe mais padding; quem não usa fica
colada na borda). Ordem fixa, de cima para baixo:

```tsx
<Pagina
  titulo="Performance"
  descricao="Entregas e SLA por unidade no período"   // 1 linha de contexto
  meta={<SeloDosDados />}                             // "Dados atualizados em…"
  acoes={<>                                           // sempre à direita do título
    <ComoFunciona …/> <Button variant="ghost">Atualizar</Button>
    <ExportMenu …/> <Button>Novo …</Button>           // primária por último
  </>}
  abas={<Abas …/>}                                    // se a tela tem abas de conteúdo
  filtros={<>                                         // SEMPRE aqui; gruda no topo ao rolar
    <FiltrosAvancados ativos={…} aoLimpar={…}>
      <FiltroPeriodo …/> <FiltroMultiplo …/> <Alternador …/> <BuscaDocumento …/>
    </FiltrosAvancados>
    <FiltrandoPor etiquetas={…} />
  </>}
>
  {/* 1. Avisos da tela (Aviso)  2. KPIs  3. Gráficos  4. Tabela/lista  5. Seções secundárias */}
</Pagina>
```

- Cadastros e formulários simples: `largura="estreita"`.
- Filtros **nunca** no meio do conteúdo, depois de gráfico ou dentro do cabeçalho. Filtro que só
  afeta um bloco (ex.: alternador de visão de um gráfico) fica na `barra` do `Painel` daquele bloco.
- `<select>` nativo não: use `ui/select` (uma escolha) ou `FiltroMultiplo` (várias).
- Busca por documento/texto: dentro dos `filtros`, por último.
- `Secao` agrupa blocos com título dentro da página.

## 4. Componentes

| Componente | Quando |
| --- | --- |
| `Painel` (`comum/Painel`) | Todo bloco de conteúdo: gráfico, tabela própria, lista, formulário. Moldura cinza + cartão branco (mockup). Props: `rotulo`, `titulo`, `descricao`, `icone`, `acoes`, `barra` (controles + `ItemDeLegenda`), `rodape`, `classeDoCorpo`. |
| `KpiCard` | Todo indicador numérico. Grade `grid gap-4 sm:grid-cols-2 xl:grid-cols-4` (até 5 por linha; mais que isso, quebre em dois grupos com `Secao`). `icone` dá identidade; `aoClicar` filtra a lista (aparece a seta →); `detalhe` vai no rodapé ("meta 95%", "vs. mês anterior"). Não crie card de KPI próprio: se faltar algo, use o `KpiCard` e anote o que faltou. |
| `GraficoLinha` / `GraficoBarras` | Gráficos recharts. Já têm degradê, crosshair, dica, legenda clicável, carregando/vazio/erro. Envolva num `Painel`. |
| `TabelaDados` | Toda tabela de dados com ordenação/paginação/exportação. Tabela própria só se a interação for especial; nesse caso copie o visual (cabeçalho `bg-muted/70`, `label` 11,5 px caixa alta, células `px-4 py-2.5 text-[13px]`, `tabular-nums`, linha `hover:bg-muted/60`, selecionada `bg-accent`) e envolva num `Painel`. |
| `FiltroUnico` | Filtro de uma escolha só na barra de filtros ("Autor  todos"), no mesmo desenho do `FiltroMultiplo`. |
| `Alternador` | Escolha exclusiva de 2–5 opções (base de data, visão, agrupamento). Substitui todos os segmentados feitos à mão. |
| `Abas` | Trocar de conteúdo da tela (vai no `abas` do `Pagina` quando é da tela inteira). |
| `classes-de-tabela` | Classes da tabela (`CLASSE_TABELA`, `CLASSE_CABECALHO`, `CLASSE_TH`, `CLASSE_TD`, `CLASSE_LINHA`) para tabelas próprias ficarem idênticas ao `TabelaDados`; dentro de `Painel`, use `TabelaDados embutida`. |
| `SeloStatus` | Status em pílula (`tom`: sucesso/alerta/erro/info/neutro), ícone + texto. Substitui badges coloridos à mão. |
| `Aviso` | Faixa de alerta/erro/info/sucesso dentro da tela (título, texto, ação). Substitui caixas `amber-50`/`red-50`. |
| `EstadoVazio`, `MensagemErro`, `LinhasCarregando` | Estados. Vazio sempre diz o que fazer ("Amplie o período…"). |
| `Detalhe` (gaveta/modal), `ComoFunciona`, `InfoTip` | Já no visual novo. |
| `ui/*` (shadcn) | Botões: `default` (primária, 1 por área), `outline` (secundária), `ghost` (terciária). Tamanho padrão nas barras: `size="sm"` = 32 px; nos filtros, 36 px (`h-9`). |

## 5. Gráficos (skill dataviz)

- Forma pelo trabalho do dado: tempo → linha/área; comparar categorias → barras (horizontais se
  rótulos longos); parte do todo com ≤ 5 fatias → barra empilhada 100% (evite pizza/donut).
  Um número só → `KpiCard`, não gráfico.
- Um eixo Y só (nunca dois). Grade discreta, sem linha de eixo.
- Interativo por padrão: dica no hover; clique que filtra/abre lista quando fizer sentido
  (`aoClicarBarra`); legenda clicável. Barras feitas em HTML/CSS também precisam de dica e foco
  por teclado.
- Cor da série segue a entidade, não a posição: ao filtrar, as séries que ficam não mudam de cor.

## 6. Interação e acessibilidade

- Foco visível (já global). Alvo de clique ≥ 32 px (36 px em barras de filtro).
- Ícone sozinho = `aria-label` + `title`. Ícone decorativo = `aria-hidden`.
- `prefers-reduced-motion` já é respeitado no global; animação só com `motion-safe:`.
- Linha clicável: `tabIndex=0` + Enter/Espaço (o `TabelaDados` já faz).
- Celular (≤ 640 px): grade de KPIs em 1–2 colunas, filtros quebram linha, tabelas rolam na
  horizontal dentro do `Painel` (nada estoura a página).

## 7. Shell (já pronto, não mexer nas telas)

Barra lateral flutuante na cor escura da marca (logo, recolher, busca `Ctrl K`, seletor de
empresa, Menu principal / Admin / Plataforma), rodapé com tema, sino de avisos (integração SSW,
dados atrasados, XML aguardando), usuário e "Desenvolvido por Scale". Faixa de saúde da SSW no topo.

## 8. Checklist por tela

1. Começa com `<Pagina>`; título, descrição e ações à direita; filtros no slot `filtros`.
2. Nenhum hex/cor do Tailwind fora dos tokens; funciona no tema escuro (conferir).
3. KPIs com `KpiCard`; gráficos com `Graficos`; tabelas com `TabelaDados` (ou visual idêntico).
4. Blocos dentro de `Painel`; espaçamento só pelo `Pagina`/`gap-4`/`space-y-*`.
5. Tipografia só da escala da §2.
6. Status com ícone + texto. Avisos com `Aviso`.
7. Estados de carregando, vazio (com dica do que fazer) e erro (com "Tentar novamente").
8. Nada removido: mesmos textos, números, links, exportações, parâmetros de URL.
9. Sem código morto, import sem uso, componente duplicado do `comum`.
10. Conferido em 1440 px (claro e escuro) e 390 px.
