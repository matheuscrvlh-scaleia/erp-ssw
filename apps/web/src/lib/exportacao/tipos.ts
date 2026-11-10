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

export interface OpcoesExcel extends OpcoesComMarca {
  /** Nome do arquivo sem extensão; o sufixo "-dd-mm-aaaa" entra se não vier. */
  arquivo: string;
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
