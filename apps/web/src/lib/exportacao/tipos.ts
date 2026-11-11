/** Contrato público da exportação (CSV, Excel, PDF e impressão). */

export type FormatoColuna =
  "texto" | "inteiro" | "decimal" | "percentual" | "moeda" | "data" | "datahora";

export interface ColunaExportacao {
  /** Propriedade da linha que vira a célula. */
  chave: string;
  /** Cabeçalho da coluna. */
  titulo: string;
  /**
   * Como o valor sai. `percentual` espera fração (0,951 → "95,1%"); `data` espera "AAAA-MM-DD";
   * `datahora` espera um instante ISO (mostrado no fuso da empresa). Padrão: `texto`.
   */
  formato?: FormatoColuna | undefined;
  /** Largura aproximada em caracteres (Excel; no PDF vira largura fixa da coluna). */
  largura?: number | undefined;
}

/** Uma linha é qualquer objeto; cada coluna lê a propriedade `chave`. */
export type LinhaExportacao = object;

/** Identidade visual da empresa ativa (a `EmpresaAtiva` do acesso serve direto). */
export interface EmpresaExportacao {
  nome: string;
  logoUrl?: string | null | undefined;
  corPrimaria?: string | undefined;
  corDestaque?: string | undefined;
  slogan?: string | null | undefined;
  /** Fuso para data/hora (padrão America/Sao_Paulo). */
  fuso?: string | undefined;
}

export type Orientacao = "retrato" | "paisagem";

interface OpcoesComMarca {
  titulo: string;
  /** Linha de contexto: período, filtros, quantidade de registros. */
  subtitulo?: string | undefined;
  colunas: readonly ColunaExportacao[];
  linhas: readonly LinhaExportacao[];
  empresa: EmpresaExportacao;
}

/** Aba seguinte à principal no Excel, no mesmo desenho (logo, título, faixa, tabela). */
export interface AbaExcel {
  /** Nome da aba (o Excel corta em 31 caracteres). */
  nome: string;
  /** Título no topo da aba. Padrão: o título do arquivo. */
  titulo?: string | undefined;
  /** Linhas de contexto entre o topo e a tabela (filtros, totais). */
  notas?: readonly string[] | undefined;
  colunas: readonly ColunaExportacao[];
  linhas: readonly LinhaExportacao[];
}

export interface OpcoesExcel extends OpcoesComMarca {
  /** Nome do arquivo sem extensão; o sufixo "-dd-mm-aaaa" entra se não vier. */
  arquivo: string;
  /** Nome da aba principal. Padrão: o título. */
  nomeDaAba?: string | undefined;
  /** Linhas de contexto da aba principal, entre o topo e a tabela (ex.: "Filtros aplicados:"). */
  notas?: readonly string[] | undefined;
  /** Abas depois da principal (ex.: "SLA por unidade" no relatório de período). */
  abasExtras?: readonly AbaExcel[] | undefined;
}

export interface OpcoesPdf extends OpcoesComMarca {
  arquivo: string;
  /** Padrão: paisagem. */
  orientacao?: Orientacao | undefined;
  /** Fonte da tabela em pt (padrão 7,5). Tabelas muito largas usam menos (ex.: 5,5). */
  tamanhoFonte?: number | undefined;
}

export interface OpcoesCsv {
  arquivo: string;
  colunas: readonly ColunaExportacao[];
  linhas: readonly LinhaExportacao[];
  fuso?: string | undefined;
}

export interface OpcoesImpressao extends OpcoesComMarca {
  /** Padrão: retrato. */
  orientacao?: Orientacao | undefined;
}
