/**
 * Integrações que a ingestão do SSW usa por empresa. Quem agenda e roda os jobs é o worker-ssw
 * (ADR 0012). Especificação: docs/regras/06-ingestao.md §4.
 */
export type IntegracaoDaIngestao =
  "sftp" | "ssw_api" | "ssw_bi2" | "ssw_webhook" | "ssw_web" | "xml_cte";
