/** Tipo SSW do código de ocorrência (cadastro da empresa). */
export type TipoSsw =
  | "ENTREGA"
  | "PRE_ENTREGA"
  | "INFORMATIVA"
  | "PENDENCIA_CLIENTE"
  | "PENDENCIA_TRANSPORTADORA"
  | "BAIXA";

export type ResponsavelOcorrencia =
  "FR" | "transportador" | "destinatario" | "cliente" | "sistema" | "outro";

export interface CodigoDoCatalogo {
  codigo: number;
  descricao: string;
  tipoSsw: TipoSsw | null;
  penaliza: boolean;
  responsavel: ResponsavelOcorrencia;
  pendenteClassificacao: boolean;
  pendenciaAcompanhada: boolean;
}

/** Conjuntos de códigos que as regras da Performance usam, tirados do cadastro da empresa. */
export interface ConjuntosDoCatalogo {
  /** `tipo_ssw = BAIXA`: finaliza sem entrega (decisão Q22: cadastro da própria empresa). */
  baixas: number[];
  /** Códigos acompanhados como pendência: só eles contam como ocorrência penalizante. */
  penalizantes: number[];
  /** Ainda sem classificação: entram no banner "precisam de classificação". */
  pendentesClassificacao: number[];
  /** Pendência do cliente ou da transportadora. */
  pendencias: number[];
}

const ordenados = (codigos: number[]) => [...codigos].sort((a, b) => a - b);

/** origem: §0.2 da spec 02 (BAIXAS, PENAL, CLASSIFICADOS, PENDENCIA) */
export function conjuntosDoCatalogo(catalogo: readonly CodigoDoCatalogo[]): ConjuntosDoCatalogo {
  const de = (regra: (c: CodigoDoCatalogo) => boolean) =>
    ordenados(catalogo.filter(regra).map((c) => c.codigo));
  return {
    baixas: de((c) => c.tipoSsw === "BAIXA"),
    penalizantes: de((c) => c.pendenciaAcompanhada),
    pendentesClassificacao: de((c) => c.pendenteClassificacao),
    pendencias: de(
      (c) => c.tipoSsw === "PENDENCIA_CLIENTE" || c.tipoSsw === "PENDENCIA_TRANSPORTADORA",
    ),
  };
}

/**
 * Códigos que contam como "problema no percurso" do OTIF: pendência, menos a saída para entrega.
 * origem: performance_otif (sistema atual)
 */
export function codigosProblemaOtif(conjuntos: ConjuntosDoCatalogo): number[] {
  return conjuntos.pendencias.filter((c) => c !== 85);
}

/**
 * Códigos cujo frete vira "prejuízo": os do filtro (ou 13), que o cadastro marca como penalizante
 * de responsabilidade FR, menos o 85.
 * origem: relatorio_bloco_agregados (sistema atual)
 */
export function codigosDePrejuizo(
  catalogo: readonly CodigoDoCatalogo[],
  codigosDoFiltro: readonly number[] | null,
): number[] {
  const alvo = codigosDoFiltro && codigosDoFiltro.length > 0 ? codigosDoFiltro : [13];
  return ordenados(
    catalogo
      .filter((c) => c.codigo !== 85 && c.penaliza && c.responsavel === "FR")
      .filter((c) => alvo.includes(c.codigo))
      .map((c) => c.codigo),
  );
}

export function descricaoDoCodigo(
  catalogo: readonly CodigoDoCatalogo[],
  codigo: number | null,
): string | null {
  if (codigo === null) return null;
  return catalogo.find((c) => c.codigo === codigo)?.descricao ?? null;
}
