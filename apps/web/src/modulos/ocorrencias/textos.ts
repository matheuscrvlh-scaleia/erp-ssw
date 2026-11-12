import { type ResponsavelDoEvento } from "@erp/shared/contratos/ocorrencias";

import { type Tom } from "@/componentes/comum/SeloStatus";

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

/** Tom do selo do responsável: transportador em vermelho, pendente em alerta, o resto neutro. */
export function tomDoResponsavel(r: ResponsavelDoEvento): Tom {
  if (r === "transportador") return "erro";
  if (r === "pendente") return "alerta";
  return "neutro";
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
