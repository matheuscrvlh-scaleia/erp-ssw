/** Agrupa preservando a ordem de chegada (primeira ocorrência de cada chave). */
export function agrupar<T, K>(itens: readonly T[], chave: (item: T) => K): Map<K, T[]> {
  const grupos = new Map<K, T[]>();
  for (const item of itens) {
    const k = chave(item);
    const grupo = grupos.get(k);
    if (grupo) grupo.push(item);
    else grupos.set(k, [item]);
  }
  return grupos;
}
