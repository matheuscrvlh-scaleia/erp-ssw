/**
 * Visual das tabelas feitas à mão (linhas que abrem, células clicáveis), igual ao `TabelaDados`
 * (docs/design/guia.md §4). Usado pelo ranking, pela bonificação e pelo ponto.
 */
export const CLASSE_TABELA = "w-full text-[13px] tabular-nums";
export const CLASSE_CABECALHO =
  "border-b border-border bg-muted/70 text-left text-muted-foreground";
export const CLASSE_TH =
  "px-4 py-2.5 text-[11.5px] font-semibold tracking-[0.04em] whitespace-nowrap uppercase";
export const CLASSE_TD = "px-4 py-2.5";
export const CLASSE_LINHA =
  "border-b border-border transition-colors last:border-0 hover:bg-muted/60";
