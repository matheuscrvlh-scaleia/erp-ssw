/**
 * Status, Atraso e Alertas de uma linha da lista do Romaneio (aba Total). A tela e a exportação
 * usam as mesmas funções: o arquivo mostra o mesmo que a tela.
 * origem: src/features/romaneio/romaneio-linha.ts (sistema atual)
 */
import { diferencaEmDias } from "@erp/shared/datas";

import { CODIGOS_ENTREGA } from "./nucleo-local";

export interface LinhaSituacao {
  dataPrevista: string | null;
  dataEntregaRealizada: string | null;
  atrasoDias: number | null;
  performanceDias: number | null;
  responsabilidadeCliente: boolean | null;
  /** Encerrado por baixa formal (devolução/cancelamento/indenização) sem entrega. */
  baixadoSemEntrega: boolean;
  /** "Em rota agora": a última ocorrência é a 85. */
  emRotaAgora: boolean;
  peso: number | null;
  volumes: number | null;
  ultimaOcorrenciaCodigo: number | null;
  tde: number | null;
}

export type StatusLinha = "Entregue" | "Baixado" | "Em rota" | "Pendente";

export function entregueDaLinha(l: LinhaSituacao): boolean {
  return (
    l.dataEntregaRealizada !== null ||
    (l.ultimaOcorrenciaCodigo !== null && CODIGOS_ENTREGA.includes(l.ultimaOcorrenciaCodigo))
  );
}

export function statusDaLinha(l: LinhaSituacao): StatusLinha {
  if (entregueDaLinha(l)) return "Entregue";
  if (l.baixadoSemEntrega) return "Baixado";
  if (l.emRotaAgora) return "Em rota";
  return "Pendente";
}

export interface Atraso {
  dias: number;
  fonte: "baixa formal" | "resp. cliente" | "performance" | "prazo" | "BI2";
}

/**
 * Precedência: baixa formal → responsabilidade do cliente → performance (entregue) → hoje −
 * previsão → atraso_dias do BI2 (só sem previsão). `hoje` = dia de Brasília (Q11).
 */
export function atrasoDaLinha(l: LinhaSituacao, hoje: string): Atraso {
  if (l.baixadoSemEntrega) return { dias: 0, fonte: "baixa formal" };
  if (l.responsabilidadeCliente) return { dias: 0, fonte: "resp. cliente" };
  if (entregueDaLinha(l)) {
    return { dias: Math.max(l.performanceDias ?? 0, 0), fonte: "performance" };
  }
  if (l.dataPrevista !== null) {
    return { dias: Math.max(diferencaEmDias(l.dataPrevista, hoje), 0), fonte: "prazo" };
  }
  if (l.atrasoDias !== null && l.atrasoDias > 0) return { dias: l.atrasoDias, fonte: "BI2" };
  return { dias: 0, fonte: "prazo" };
}

export interface LimitesDeCarga {
  pesoKg: number;
  volumes: number;
}

const diasPorExtenso = (dias: number) => `${dias} ${dias === 1 ? "dia" : "dias"}`;

/** Selos da coluna "Alertas", na ordem da tela. */
export function alertasDaLinha(
  l: LinhaSituacao,
  atrasoDias: number,
  limites: LimitesDeCarga,
): string[] {
  const alertas: string[] = [];
  if (atrasoDias > 0) alertas.push(`ATRASADO ${diasPorExtenso(atrasoDias)}`);
  if (l.responsabilidadeCliente) alertas.push("RESP. CLIENTE");
  if (l.peso !== null && l.peso > limites.pesoKg) alertas.push("CARGA PESADA");
  if (l.volumes !== null && l.volumes > limites.volumes) alertas.push("ALTO VOLUME");
  if (l.tde !== null && l.tde > 0) alertas.push("TDE");
  return alertas;
}

/** Texto da coluna "Atraso" na exportação. */
export function atrasoParaExportar(l: LinhaSituacao, atraso: Atraso): string {
  if (l.baixadoSemEntrega) return "";
  if (l.responsabilidadeCliente) return "Resp. cliente";
  if (atraso.dias > 0) return diasPorExtenso(atraso.dias);
  if (entregueDaLinha(l) && l.performanceDias !== null) return "No prazo";
  return "";
}
