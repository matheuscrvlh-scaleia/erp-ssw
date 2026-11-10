# Kit de UI compartilhado (apps/web)

Peças prontas para portar as telas com o visual de hoje. Tudo em português, acessível por teclado
e leitor de tela. Componentes em `apps/web/src/componentes/comum/`, exportação em
`apps/web/src/lib/exportacao/`, hooks em `apps/web/src/hooks/`.

| Precisa de | Use |
| --- | --- |
| Arquivo CSV/Excel/PDF/impressão | `ExportMenu` (botão) ou `exportarExcel`/`exportarPdf`/`exportarCsv`/`imprimir` |
| Card de indicador | `KpiCard` (+ `statusDaMeta`) |
| "Dados atualizados em…" | `SeloAtualizacao` |
| Tabela | `TabelaDados` |
| "Anterior" / "Próxima" de lista paginada fora da `TabelaDados` | `BotoesDePagina` |
| Barra de filtros | `FiltrosAvancados` + `FiltroPeriodo` / `FiltroMultiplo` / `FiltroTexto` + `FiltrandoPor` |
| Filtros na URL | `useFiltrosNaUrl` + `campoFiltro` |
| Detalhe | `DrawerDetalhe` / `ModalDetalhe` + `GradeDetalhe` / `CampoDetalhe` |
| Gráfico | `GraficoLinha` / `GraficoBarras` |
| Sem dados / erro | `EstadoVazio` / `MensagemErro` (`mensagemAmigavel` para toast) |
| Abas | `Abas` + `ConteudoDaAba` |
| "Como funciona" da página | `ComoFunciona` + `ComoFuncionaSecao` / `Formula` |
| Ícone "i" com explicação | `InfoTip` |

---

## Exportação — `@/lib/exportacao`

Identidade visual da empresa ativa em todo arquivo (mesmo desenho do sistema atual, decisão
`identidade-visual-nas-exportações-2026-10-13`): logo + título + "Empresa · Painel BI" + "Gerado
em", faixa na cor principal com acento da cor de destaque, cabeçalho da tabela na cor principal,
zebra, rodapé "Empresa — Slogan" e "Página X de Y". **CSV é só dados**, de propósito (reimportar).
jsPDF e exceljs são baixados só no clique (import dinâmico).

```ts
type FormatoColuna = "texto" | "inteiro" | "decimal" | "percentual" | "moeda" | "data" | "datahora";
interface ColunaExportacao { chave: string; titulo: string; formato?: FormatoColuna; largura?: number }
interface EmpresaExportacao {
  nome: string; logoUrl?: string | null; corPrimaria?: string; corDestaque?: string;
  slogan?: string | null; fuso?: string; // a EmpresaAtiva do acesso serve direto
}

exportarExcel({ arquivo, titulo, subtitulo?, colunas, linhas, empresa }): Promise<void>
exportarPdf({ arquivo, titulo, subtitulo?, colunas, linhas, empresa, orientacao?, tamanhoFonte? }): Promise<void>
exportarCsv({ arquivo, colunas, linhas, fuso? }): void
imprimir({ titulo, subtitulo?, colunas, linhas, empresa, orientacao? }): Promise<void>
```

- `linhas`: objetos quaisquer; cada coluna lê `linha[chave]`.
- `formato`: `percentual` espera **fração** (0,951 → "95,1%"); `data` espera "AAAA-MM-DD" (instante
  com hora vira o dia de Brasília); `datahora` espera instante ISO (mostrado no fuso da empresa);
  `numeric` do Postgres em texto ("12.50") é aceito como número. Vazio sai vazio (não "—").
- Excel grava **número e data de verdade** (soma e filtro funcionam), com máscara pt-BR.
- CSV: separador `;`, BOM UTF-8, vírgula decimal sem milhar, datas dd/mm/aaaa.
- `arquivo`: base do nome; o sufixo `-dd-mm-aaaa` e a extensão entram sozinhos (não repetem).
- `orientacao`: `"retrato" | "paisagem"` (PDF padrão paisagem; impressão padrão retrato).
  `tamanhoFonte`: PDF de tabela larga (Romaneio usa 5,5).
- **Link do SSW**: célula com a URL de `urlCtrcNoSsw(sigla, numero, emissao)` vira "Abrir no SSW"
  clicável no Excel/PDF, "SSW" na impressão e a URL no CSV. Título da coluna: `COLUNA_LINK_SSW`.
- Logo só PNG/JPEG; se falhar, o arquivo sai sem logo (nunca trava).

## `ExportMenu`

Botão "Exportar" com CSV, Excel (.xlsx), PDF (e Imprimir, se pedido). Ordena por placa quando há
coluna "Placa"/"Placas", acrescenta " · N registros" ao subtítulo, avisa "Nenhum registro no filtro
atual — o arquivo não foi gerado." e mostra a mensagem amigável se falhar. A empresa vem do acesso.

```tsx
<ExportMenu
  arquivo="coletas-abertas"
  titulo="Coletas — Abertas"
  subtitulo={`Cadastro de ${formatarData(inicio)} a ${formatarData(fim)}`}
  colunas={[
    { chave: "numero", titulo: "Coleta" },
    { chave: "cadastradaEm", titulo: "Cadastro", formato: "datahora" },
    { chave: "frete", titulo: "Frete (R$)", formato: "moeda" },
    { chave: "linkSsw", titulo: COLUNA_LINK_SSW },
  ]}
  linhas={pagina.linhas}
  carregarLinhas={buscarTodas} // opcional: todas as páginas com os mesmos filtros
  formatos={["csv", "excel", "pdf", "imprimir"]} // padrão: csv, excel, pdf
  soIcone // opcional, cabeçalho apertado
/>
```

Props: `arquivo`, `titulo`, `subtitulo?`, `colunas`, `linhas`, `carregarLinhas?`, `formatos?`,
`orientacao?`, `tamanhoFonte?`, `empresa?` (padrão: empresa ativa), `desabilitado?`, `soIcone?`.

## `KpiCard`

```tsx
<KpiCard
  rotulo="SLA Operacional"
  valor={formatarPercentual(sla)}
  status={statusDaMeta(sla, meta)} // "bom" | "alerta" | "ruim"
  detalhe={`meta ${formatarPercentual(meta)}`}
  selo="abaixo da meta" // opcional
  progresso={sla} // opcional, fração
  neutro // opcional: volume, sem bom/ruim
  aoClicar={() => definir({ recorte: "fora" })} // opcional: vira botão
  ativo={filtros.recorte === "fora"}
/>
```

## `SeloAtualizacao`

Presentacional: quem usa busca o horário (a cada 60 s) e passa. Sem horário: "Aguardando a
primeira importação".

```tsx
<SeloAtualizacao atualizadoEm={dados?.atualizadoEm ?? null} xmlAguardando={orfaos} />
```

O horário vem de `consultaAtualizacaoDosDados(empresaId)` (`@/modulos/ingestao-ssw/api`, já busca a
cada 60 s): `{ atualizadoEm, xmlAguardando }` (`xmlAguardando` só para a Plataforma; `null` nos
demais — passe `?? undefined`).

## `TabelaDados`

```tsx
const colunas: ColunaTabela<Coleta>[] = [
  { chave: "numero", titulo: "Coleta", classe: "font-mono whitespace-nowrap", fixa: true },
  { chave: "cadastradaEm", titulo: "Cadastro", formato: "datahora" },
  { chave: "frete", titulo: "Frete", formato: "moeda" }, // alinha à direita sozinho
  { chave: "situacao", titulo: "Situação", celula: (c) => <SeloSituacao coleta={c} />, valor: (c) => c.etapa },
  { chave: "obs", titulo: "Observação", oculta: true }, // liga em "Colunas"
];

<TabelaDados
  titulo="Detalhe das coletas"
  acoes={<BuscaDocumento ... />}
  colunas={colunas}
  linhas={consulta.data ?? []}
  chaveDaLinha={(c) => c.id}
  carregando={consulta.isLoading}
  erro={consulta.error}
  aoTentarDeNovo={() => void consulta.refetch()}
  mensagemVazia="Nenhuma coleta encontrada."
  aoClicarLinha={setAberta}
  linhaAtiva={aberta?.id}
  configurarColunas
  exportacao={{ arquivo: "coletas", titulo: "Coletas", subtitulo }}
  rotuloTotal={(n) => `${n} coleta(s)`}
/>
```

- Ordenação no clique do cabeçalho (vazio sempre no fim, texto pt-BR com números naturais,
  estável). `ordenacaoInicial` para começar ordenada.
- Paginação no cliente (`porPagina`, padrão 50; 0 = tudo). No servidor: `paginacaoServidor={{
  pagina, porPagina, total, aoMudarPagina }}` + `ordenacao`/`aoOrdenar` (a tabela só avisa).
- `exportacao` exporta as **colunas visíveis**, na ordem da tela, com o valor de `valor()`;
  `semExportar` tira uma coluna (ex.: ações). Para todas as páginas: `exportacao.carregarLinhas`.
- Célula vazia mostra "—". Linha clicável abre com Enter/Espaço.

## Filtros

```tsx
const PERIODOS = ["hoje", "7d", "30d", "mes", "custom"] as const;
const esquemaFiltros = z.object({
  periodo: campoFiltro.opcao(PERIODOS, "mes"),
  de: campoFiltro.data(),
  ate: campoFiltro.data(),
  filiais: campoFiltro.lista(),
  remetente: campoFiltro.texto(),
  pagina: campoFiltro.pagina(),
});

function Tela() {
  const { filtros, definir, limpar, ativos } = useFiltrosNaUrl(esquemaFiltros);
  const { inicio, fim } = resolverPeriodo(filtros.periodo, filtros.de, filtros.ate, hojeNoFuso(fuso));
  return (
    <>
      <FiltrosAvancados ativos={ativos.length > 0} aoLimpar={() => limpar()}>
        <FiltroPeriodo
          periodo={filtros.periodo}
          de={filtros.de}
          ate={filtros.ate}
          rotulo="Entrega"
          aoMudar={(p) => definir({ ...p, pagina: 1 })}
        />
        <FiltroMultiplo
          rotulo="Unidade responsável"
          opcoes={opcoesUnidade.data?.map((s) => ({ valor: s }))} // undefined = carregando
          aoAbrir={setSeletorAberto} // busque as opções só com ele aberto
          selecionados={filtros.filiais}
          aoMudar={(filiais) => definir({ filiais, pagina: 1 })}
          monoespacado
        />
        <FiltroTexto
          rotulo="Remetente"
          valor={filtros.remetente} // "Natura|Avon"
          aoMudar={(remetente) => definir({ remetente, pagina: 1 })}
          sugestoes={{ chave: ["sugestoes", "remetente", inicio, fim], buscar: buscarRemetentes }}
        />
      </FiltrosAvancados>
      <FiltrandoPor
        etiquetas={[
          filtros.filiais.length > 0 && {
            rotulo: "Unidade",
            ...resumirNomes(filtros.filiais),
            limpar: () => definir({ filiais: [] }),
          },
        ]}
      />
    </>
  );
}
```

- `useFiltrosNaUrl(esquema)` → `{ filtros, definir(mudanca), limpar(manter?), ativos }`. Filtro no
  valor padrão sai da URL; parâmetros de fora do esquema ficam. Campo inválido (link antigo) volta
  ao padrão sem derrubar a tela. Declare o esquema fora do componente.
- `campoFiltro`: `texto(max?)`, `lista()`, `data()`, `opcao(opcoes, padrao)`, `pagina()`,
  `booleano(padrao?)` — todos com `.catch` (o roteador lê `?ctrc=123` como número e aceita valor
  solto onde se espera lista).
- `resolverPeriodo(periodo, de, ate, hoje, padrao?)`: atalhos `hoje`, `7d`, `30d`, `mes`,
  `mes_anterior`; `hoje` é o dia de Brasília (Q11), passado de fora.
- Múltipla escolha marca na hora e só reconsulta após 600 ms sem clique ou ao fechar
  (`useSelecaoAdiada`).
- Texto com vários valores: `lerFiltroTexto`/`juntarFiltroTexto` em `@erp/shared/filtro-texto`
  (o back usa a mesma regra: "contém qualquer um").

## Detalhe

```tsx
<DrawerDetalhe
  aberto={!!coleta}
  aoFechar={() => setColeta(null)}
  titulo={`Coleta ${coleta.unidade} ${coleta.numero}`}
  descricao="Cadastro 05/11/2026" // opcional
  acoes={<ExportMenu ... soIcone />} // opcional
  largura="media" // "media" (560 px) | "larga" (3xl)
>
  <GradeDetalhe>
    <CampoDetalhe rotulo="Situação" valor={coleta.situacao} />
    <CampoDetalhe rotulo="Placa" valor={coleta.placa} /> {/* vazio vira "—" */}
  </GradeDetalhe>
</DrawerDetalhe>
```

`ModalDetalhe` tem as mesmas props (janela no centro).

## Gráficos

```tsx
<GraficoLinha
  descricao="SLA por dia no período" // lido pelo leitor de tela
  dados={serie} // [{ rotulo: "05/11", sla: 0.951 }, ...]
  eixoX="rotulo"
  series={[{ chave: "sla", nome: "SLA Operacional" }]}
  formato="percentual"
  dominioY={[0.8, 1]}
  meta={{ valor: 0.95, rotulo: "meta 95,0%" }}
  carregando={consulta.isLoading}
  erro={consulta.error}
/>

<GraficoBarras
  descricao="Coletas por dia"
  dados={dias}
  eixoX="rotulo"
  series={[
    { chave: "noPrazo", nome: "No prazo", cor: "var(--status-good)", pilha: "a" },
    { chave: "atrasadas", nome: "Atrasadas", cor: "var(--status-bad)", pilha: "a" },
  ]}
  formato="inteiro"
  aoClicarBarra={(dia) => abrirLista(dia)}
  dica={(dia) => <DicaDoDia dia={dia} />} // opcional
/>
```

Altura padrão 260 px (`altura`); carregando, erro e "Sem dados para os filtros selecionados."
ocupam a mesma altura. Legenda aparece com mais de uma série; pontos só até 31.

## Estados

```tsx
<EstadoVazio mensagem="Nenhuma coleta encontrada." detalhe="Amplie o período." icone={Inbox} />
<MensagemErro erro={consulta.error} titulo="Não foi possível carregar as coletas" aoTentarDeNovo={...} />
toast.error("Não foi possível salvar", { description: mensagemAmigavel(erro) });
```

`mensagemAmigavel` mostra só a mensagem da API (já fala com o operador, ex.: "reduza o período");
erro técnico vira a mensagem genérica, e versão antiga do app vira "Recarregue a página (F5)".

## Abas

```tsx
<Abas
  abas={[
    { valor: "parceiro", rotulo: "Parceiro" },
    { valor: "cidade", rotulo: "Cidade" },
  ]}
  padrao="parceiro" // sozinha; ou valor={aba} aoMudar={setAba} (estado da tela ou da URL)
  rotulo="Agrupar por" // opcional: nome da lista para o leitor de tela
  classeDaAba="text-[12px]" // opcional; className = lista, classeDoGrupo = bloco todo
>
  <ConteudoDaAba valor="parceiro">...</ConteudoDaAba>
  <ConteudoDaAba valor="cidade">...</ConteudoDaAba>
</Abas>
```

Tabs do shadcn: setas do teclado trocam de aba; o conteúdo da aba fechada sai da tela (só consulta
aberta). Sem `ConteudoDaAba`, quem usa mostra o conteúdo pelo `valor`. `aoMudar` recebe o valor já
tipado. Nos testes, a aba troca com `fireEvent.mouseDown` (o Radix age no mousedown).

## `ComoFunciona` e `InfoTip`

```tsx
<ComoFunciona
  chave="bonificacao-entrega" // lembra no navegador quem já abriu (o botão para de pulsar)
  titulo="Como funciona a bonificação de entrega"
  resumo="O bônus é calculado por pessoa e por dia..."
>
  <ComoFuncionaSecao titulo="1. De onde vêm os dados">
    <p>Dos <strong>romaneios do SSW</strong>...</p>
    <Formula>horas do dia = (saída 1 − entrada 1) + …</Formula>
  </ComoFuncionaSecao>
</ComoFunciona>

<InfoTip texto="O período filtra pelo dia da entrega concluída em Brasília." />
```

O clique no `InfoTip` não aciona o card em volta.
