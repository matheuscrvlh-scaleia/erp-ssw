import { ehDataIso } from "./datas";
import { z } from "./zod";

/*
 * Peças de schema para a query string dos GET. `?a=1&a=2` chega como array e `?a=1` como texto;
 * números e sim/não chegam como texto. Cada peça aceita o tipo de verdade (o web chama tipado) e
 * o texto da URL, e sempre devolve o tipo de verdade.
 */

/** Lista: aceita o array ou um valor solto (um item só na query string). */
export function lista<T extends z.ZodType>(item: T) {
  return z.union([z.array(item), item.transform((v) => [v])]);
}

export const inteiro = z.union([
  z.number().int(),
  z
    .string()
    .regex(/^-?\d+$/, "Número inteiro inválido.")
    .transform(Number)
    .pipe(z.number().int().safe()),
]);

export const decimal = z.union([
  z.number(),
  z
    .string()
    .regex(/^-?\d+(\.\d+)?$/, "Número inválido.")
    .transform(Number),
]);

/** `"1"`/`"true"` = sim; `"0"`/`"false"` = não (o formato dos links de hoje é `"1"`). */
export const simNao = z.union([
  z.boolean(),
  z.enum(["1", "0", "true", "false"]).transform((v) => v === "1" || v === "true"),
]);

export const dataIso = z.string().refine(ehDataIso, "Data inválida (use AAAA-MM-DD).");

/** Texto livre de filtro: tamanho limitado (vai para ILIKE). */
export const textoDeFiltro = z.string().max(200);
