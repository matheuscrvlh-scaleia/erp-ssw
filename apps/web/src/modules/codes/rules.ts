import {
  type CodigoDoAdmin,
  type LetraDeResponsavel,
  LETRAS_DE_RESPONSAVEL,
} from "@erp/shared/contracts/occurrence-codes";

/** Letras do SSW; a F aparece com o nome curto da empresa. */
export function rotulosDaLetra(nomeCurto: string): Record<LetraDeResponsavel, string> {
  return {
    F: `${nomeCurto} (transportadora)`,
    C: "Cliente",
    D: "Destinatário",
    T: "Transportador parceiro",
    S: "Sistema / status",
    O: "Outro",
  };
}

export const ehLetra = (v: string | null): v is LetraDeResponsavel =>
  LETRAS_DE_RESPONSAVEL.some((l) => l === v);

export const ORDENS = ["codigo", "freq", "atualizado"] as const;
type OrdemDosCodigos = (typeof ORDENS)[number];

export interface FiltrosDosCodigos {
  busca: string;
  letras: readonly LetraDeResponsavel[];
  penaliza: "tudo" | "sim" | "nao";
  ativo: "tudo" | "ativo" | "inativo";
  ordem: OrdemDosCodigos;
}

export const FILTROS_INICIAIS: FiltrosDosCodigos = {
  busca: "",
  letras: [],
  penaliza: "tudo",
  ativo: "ativo",
  ordem: "codigo",
};

/** Busca por número ou descrição; frequência e última edição do maior para o menor. */
export function filtrarCodigos(
  codigos: readonly CodigoDoAdmin[],
  f: FiltrosDosCodigos,
): CodigoDoAdmin[] {
  const termo = f.busca.trim().toLowerCase();
  const visiveis = codigos.filter(
    (c) =>
      (termo === "" ||
        String(c.codigo).includes(termo) ||
        c.descricao.toLowerCase().includes(termo)) &&
      (f.letras.length === 0 ||
        (ehLetra(c.letraResponsavel) && f.letras.includes(c.letraResponsavel))) &&
      (f.penaliza === "tudo" || c.penaliza === (f.penaliza === "sim")) &&
      (f.ativo === "tudo" || c.ativo === (f.ativo === "ativo")),
  );
  const comparar: Record<OrdemDosCodigos, (a: CodigoDoAdmin, b: CodigoDoAdmin) => number> = {
    codigo: (a, b) => a.codigo - b.codigo,
    freq: (a, b) => b.frequencia30d - a.frequencia30d || a.codigo - b.codigo,
    atualizado: (a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm) || a.codigo - b.codigo,
  };
  return visiveis.sort(comparar[f.ordem]);
}
