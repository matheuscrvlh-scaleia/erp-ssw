/**
 * Nomes dos jobs e filas da ingestão (o worker registra; a API e o FTP enfileiram).
 * Spec 06 §4; Q37 do dono (horário do FTP global, o de produção).
 */

/** Filas da ingestão SSW: FTP, ciclo de aplicação e manutenção não atrasam umas às outras. */
export const FILAS_DA_INGESTAO = {
  ftp: "ingestao.ftp",
  ciclo: "ingestao.ciclo",
  manutencao: "ingestao.manutencao",
} as const;

export const JOBS_DA_INGESTAO = {
  ftp: "ingestao.ftp",
  ftpRetroativo: "ingestao.ftp-retroativo",
  ciclo: "ingestao.ssw-ciclo-aplicar",
  unidadePelo455: "ingestao.unidade-pelo-455",
  limpeza: "ingestao.limpeza",
  xmlOrfaos: "ingestao.xml-orfaos-retry",
} as const;

/** Horários (America/Sao_Paulo; a spec dá em UTC). Q37: o do FTP é o de produção, para todas. */
export const AGENDA_DA_INGESTAO = {
  ftp: "1-29,31-59 * * * *",
  ftpRetroativo: "10 3 * * *",
  ciclo: "* * * * *",
  unidadePelo455: "8,38 * * * *",
  limpeza: "40 3 * * *",
} as const;

/** Chave do singleton por empresa + tipo (spec 06 §4.2). */
export const idDoJob = (nome: string, empresaId: string) => `${nome}:${empresaId}`;

// TODO(romaneio): o job é do domínio de Romaneio (`recalcularProjecoesDoRomaneio`); a ingestão só
// enfileira as chaves que mudaram no 036/038/306 e no CT-e.
export const JOB_PROJECOES = { fila: "projecoes", nome: "projecoes.recalcular" } as const;

// TODO(coletas): o job é do domínio de Coletas (leitor e gravação do 050).
export const JOB_COLETAS_050 = { fila: "coletas", nome: "coletas.importar-050" } as const;
