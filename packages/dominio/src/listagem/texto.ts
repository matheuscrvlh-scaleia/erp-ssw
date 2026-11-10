/**
 * Filtros de texto da Listagem: "a|b" (remetente, destino, cidade) e a busca por CT-e / nota.
 */

/** `btrim` do Postgres: tira só espaço (' '), não tab nem quebra de linha. */
function btrim(texto: string): string {
  return texto.replace(/^ +| +$/g, "");
}

/** `%`, `_` e `\` digitados valem como letra, não como curinga do ILIKE (Q10 do dono). */
function escaparCuringas(texto: string): string {
  return texto.replace(/[\\%_]/g, "\\$&");
}

/**
 * Padrões ILIKE de um filtro de texto: casa se o campo contém qualquer um dos valores separados
 * por "|". Caixa ignorada, acento não ("sao" não casa "SÃO"). Vazio = sem filtro (`null`).
 * "a||b" gera o padrão "%%", que casa tudo (atalho conhecido de hoje, mantido).
 * origem: texto_casa_filtro (função SQL) e src/lib/filtro-texto.ts (sistema atual)
 */
export function padroesDeTexto(filtro: string | null | undefined): string[] | null {
  if (!filtro?.trim()) return null;
  return btrim(filtro)
    .split(/\s*\|\s*/)
    .map((parte) => `%${escaparCuringas(parte)}%`);
}

const digitos = (texto: string) => texto.replace(/\D/g, "");
const semZerosAEsquerda = (texto: string) => texto.replace(/^0+/, "");

/** CT-e procurado: série (quando digitada) + número sem zeros à esquerda. */
export interface CtrcProcurado {
  sigla: string | null;
  numero: string;
}

/**
 * "ARA000123-4" → série ARA, número 123 (o "-4" é o dígito verificador); "000123" → 123. Com a
 * série digitada a busca casa série + número (Q02 do dono); sem ela, só o número.
 * "ARA-123" → número vazio, que não casa nenhum CT-e (igual a hoje).
 * origem: _lista_ctrcs_detalhado_filtro (p_ctrc, p_busca), sistema atual
 */
export function lerCtrcProcurado(texto: string): CtrcProcurado {
  const t = texto.trim().toUpperCase();
  const sigla = /^[A-Z]+/.exec(t)?.[0] ?? null;
  const resto = t.slice(sigla?.length ?? 0).split("-")[0] ?? "";
  return { sigla, numero: semZerosAEsquerda(digitos(resto)) };
}

/**
 * Nota procurada: só dígitos e sem zeros à esquerda. Vazio (ex.: "0") casa CT-e sem nota ou com
 * nota 0, como hoje (a nota nula é comparada como "0").
 * origem: _lista_ctrcs_detalhado_filtro (p_nf), sistema atual
 */
export function lerNotaProcurada(texto: string): string {
  return semZerosAEsquerda(digitos(texto));
}
