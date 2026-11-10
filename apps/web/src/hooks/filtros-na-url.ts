import { ehDataIso } from "@erp/shared/datas";
import { z } from "@erp/shared/zod";

/**
 * Regras puras dos filtros na URL. O roteador lê a busca como JSON: `?ctrc=123` chega como número
 * e `?unidades=["CAS"]` como lista; um link antigo pode trazer texto onde se espera lista. Os campos
 * abaixo aceitam essas variações e, se o valor for inválido, voltam ao padrão (nunca derrubam a tela).
 */

const textoOuNumero = z.union([z.string(), z.number()]).transform(String);

export const campoFiltro = {
  /** Texto livre (CT-e, NF, "a|b"); cortado em `max` caracteres. */
  texto: (max = 2000) => textoOuNumero.transform((s) => s.slice(0, max)).catch(""),
  /** Lista de valores; um valor solto vira lista de um. */
  lista: () =>
    z
      .preprocess(
        (v: unknown): unknown =>
          Array.isArray(v) ? (v as unknown[]) : v == null || v === "" ? [] : [v],
        z.array(textoOuNumero),
      )
      .catch([]),
  /** Data "AAAA-MM-DD" ou "" (sem data). */
  data: () =>
    z
      .string()
      .refine((s) => s === "" || ehDataIso(s))
      .catch(""),
  /** Uma das opções; fora delas, o padrão. */
  opcao: <const T extends readonly [string, ...string[]]>(opcoes: T, padrao: T[number]) =>
    z.enum(opcoes).catch(padrao),
  /** Página a partir de 1. */
  pagina: () => z.coerce.number().int().min(1).catch(1),
  booleano: (padrao = false) => z.boolean().catch(padrao),
};

export type EsquemaFiltros = z.ZodObject;

/** Lê os filtros da busca crua; campo inválido volta ao padrão em vez de derrubar a tela. */
export function lerFiltros<S extends EsquemaFiltros>(
  esquema: S,
  bruto: Record<string, unknown>,
): z.output<S> {
  const lido = esquema.safeParse(bruto);
  if (lido.success) return lido.data;
  const invalidos = new Set(lido.error.issues.map((i) => String(i.path[0])));
  return esquema.parse(
    Object.fromEntries(Object.entries(bruto).filter(([chave]) => !invalidos.has(chave))),
  );
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Tira da busca os filtros no valor padrão: a URL fica só com o que o usuário escolheu. */
export function semPadroes(
  busca: Record<string, unknown>,
  padrao: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(busca).filter(
      ([chave, valor]) => valor !== undefined && !(chave in padrao && igual(valor, padrao[chave])),
    ),
  );
}

/** Campos que diferem do padrão (para "Limpar filtros" e contagem de filtros ligados). */
export function filtrosAtivos(
  filtros: Record<string, unknown>,
  padrao: Record<string, unknown>,
): string[] {
  return Object.keys(padrao).filter((chave) => !igual(filtros[chave], padrao[chave]));
}
