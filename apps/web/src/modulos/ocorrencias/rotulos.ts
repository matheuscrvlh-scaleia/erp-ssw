import { type ResponsavelDoEvento } from "@erp/shared/contratos/ocorrencias";

/** Rótulos do responsável; "FR" (valor gravado) aparece com o nome curto da empresa. */
export function rotulosDoResponsavel(nomeCurto: string): Record<ResponsavelDoEvento, string> {
  return {
    FR: nomeCurto,
    transportador: "Transportador",
    destinatario: "Destinatário",
    cliente: "Cliente",
    sistema: "Sistema",
    outro: "Outro",
    pendente: "Pendente",
  };
}

export function classeDoResponsavel(r: ResponsavelDoEvento): string {
  if (r === "transportador") return "bg-[var(--status-bad-bg)] text-[var(--status-bad)]";
  if (r === "pendente") return "bg-amber-100 text-amber-800";
  return "bg-muted text-muted-foreground";
}

/** NF em destaque quando houver; senão o CT-e. */
export function identificacaoDoCte(
  numeroNf: number | null,
  numeroCtrc: string,
): { principal: string; rotulo: "NF" | "CTRC"; secundario: string | null } {
  if (numeroNf !== null)
    return { principal: String(numeroNf), rotulo: "NF", secundario: numeroCtrc };
  return { principal: numeroCtrc, rotulo: "CTRC", secundario: null };
}
