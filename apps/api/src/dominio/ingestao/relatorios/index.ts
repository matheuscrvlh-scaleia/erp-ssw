/**
 * Leitores puros dos relatórios SSW (sem I/O, sem Node): a prévia da tela de Importação SSW e o
 * migrador usam os mesmos do worker-ssw (cópia, ADR 0012). Especificação: docs/regras/06-ingestao.md
 * §2–§3.
 */
export * from "./colunas-455";
export * from "./leitura";
export * from "./r036";
export * from "./r038";
export * from "./r306";
export * from "./r455csv";
export * from "./r930";
export * from "./texto";
export * from "./tipos";
