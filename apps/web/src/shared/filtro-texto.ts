/**
 * Filtro de texto com vários valores (remetente, destino): viaja como um texto só, com os valores
 * separados por "|", da URL até a consulta, que aceita o registro se o campo contiver qualquer um
 * deles. Um valor só continua igual ao filtro simples. origem: src/lib/filtro-texto.ts
 */
const SEPARADOR_FILTRO_TEXTO = "|";

/** "a| b |a|" → ["a", "b"]: sem vazios nem repetidos, na ordem em que vieram. */
export function lerFiltroTexto(valor: string | null | undefined): string[] {
  if (!valor) return [];
  const vistos = new Set<string>();
  for (const parte of valor.split(SEPARADOR_FILTRO_TEXTO)) {
    const limpo = parte.trim();
    if (limpo) vistos.add(limpo);
  }
  return [...vistos];
}

export function juntarFiltroTexto(valores: readonly string[]): string {
  return lerFiltroTexto(valores.join(SEPARADOR_FILTRO_TEXTO)).join(SEPARADOR_FILTRO_TEXTO);
}
