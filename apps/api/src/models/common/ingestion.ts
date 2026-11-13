/**
 * Catálogo dos jobs de ingestão por empresa, como a tela Diagnóstico SSW os mostra. Quem agenda e
 * roda é o worker-ssw (ADR 0012); a situação de cada job vem do HTTP interno dele.
 * Especificação: docs/regras/06-ingestao.md §4.
 */

export type IntegracaoDaIngestao = "sftp" | "ssw_api" | "ssw_bi2" | "ssw_webhook" | "xml_cte";

interface JobDeIngestao {
  /** Nome do job no worker-ssw. */
  job: string;
  descricao: string;
  /** Integração que precisa estar ligada na empresa para o job rodar. */
  integracao: IntegracaoDaIngestao;
  /** Cron em UTC (os horários de hoje); `null` = só sob demanda. */
  cron: string | null;
}

export const JOBS_DE_INGESTAO = [
  {
    job: "bi2-0017",
    descricao: "BI2 0017 — entregues (entrega e previsão de CT-e encerrado)",
    integracao: "ssw_bi2",
    cron: "12,42 * * * *",
  },
  {
    job: "verificar-token-ssw",
    descricao: "Token da SSW API (renovação e verificação)",
    integracao: "ssw_api",
    cron: "25 * * * *",
  },
  {
    job: "processar-webhook-ssw",
    descricao: "Ocorrências recebidas pelo webhook SSW2181",
    integracao: "ssw_webhook",
    cron: null,
  },
  {
    job: "sincronizar-ftp",
    descricao: "Relatórios SSW do SFTP (036/038/050/306/455/930)",
    integracao: "sftp",
    // Todo minuto menos :00 e :30, um horário só para todas as empresas (Q37 do dono).
    cron: "1-29,31-59 * * * *",
  },
  {
    job: "sincronizar-ftp-retroativo",
    descricao: "Revarredura dos importados do SFTP (03:10 de Brasília)",
    integracao: "sftp",
    cron: "10 6 * * *",
  },
  {
    job: "aplicar-ciclos",
    descricao: "Aplicação dos ciclos de relatórios em CT-e e ocorrências",
    integracao: "sftp",
    cron: "* * * * *",
  },
  {
    job: "sla-arquivos",
    descricao: "Unidade pelo 455 e SLA pelos arquivos",
    integracao: "sftp",
    cron: "8,38 * * * *",
  },
  {
    job: "limpar-ingestao-arquivos",
    descricao: "Limpeza das linhas superadas do 038 (03:40 de Brasília)",
    integracao: "sftp",
    cron: "40 6 * * *",
  },
  {
    job: "reprocessar-xml-orfaos",
    descricao: "Nova tentativa dos XML de CT-e órfãos",
    integracao: "xml_cte",
    cron: null,
  },
] as const satisfies readonly JobDeIngestao[];
