/**
 * Ordenação de texto igual à do banco atual (collation `en_US.UTF-8`): ignora acento e caixa no
 * primeiro nível. Ver docs/regras/00-ambiente.md.
 */
const colacao = new Intl.Collator("en-US", { sensitivity: "variant" });

export function compararTexto(a: string, b: string): number {
  return colacao.compare(a, b);
}
