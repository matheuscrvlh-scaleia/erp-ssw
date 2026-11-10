/** Valor JSON já validado (o que o `jsonb` guarda). */
export type ValorJson =
  string | number | boolean | null | ValorJson[] | { [chave: string]: ValorJson };
export type ObjetoJson = { [chave: string]: ValorJson };

function ehValorJson(valor: unknown): valor is ValorJson {
  if (valor === null) return true;
  switch (typeof valor) {
    case "string":
    case "boolean":
      return true;
    case "number":
      return Number.isFinite(valor);
    case "object":
      return Array.isArray(valor)
        ? valor.every(ehValorJson)
        : Object.values(valor).every(ehValorJson);
    default:
      return false;
  }
}

/** `JSON.parse` com o resultado verificado (sem `any` escapando para o resto do código). */
export function lerJson(texto: string): ValorJson {
  const valor: unknown = JSON.parse(texto);
  if (!ehValorJson(valor)) throw new Error("JSON inválido");
  return valor;
}

export function ehObjetoJson(valor: ValorJson): valor is ObjetoJson {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** Texto `jsonb` (como o Postgres devolve) → objeto; qualquer outra forma vira objeto vazio. */
export function lerObjetoJson(texto: string | null): ObjetoJson {
  if (texto === null) return {};
  const valor = lerJson(texto);
  return ehObjetoJson(valor) ? valor : {};
}

/**
 * Serialização canônica (chaves em ordem): o mesmo dado dá o mesmo texto não importa a ordem
 * em que o Postgres ou o código montaram o objeto. Base dos checksums de conferência.
 */
export function jsonCanonico(valor: ValorJson): string {
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(",")}]`;
  if (ehObjetoJson(valor)) {
    const chaves = Object.keys(valor).sort();
    return `{${chaves.map((c) => `${JSON.stringify(c)}:${jsonCanonico(valor[c] ?? null)}`).join(",")}}`;
  }
  return JSON.stringify(valor);
}
