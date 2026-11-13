import { type ValorDeParametro } from "@erp/shared/contracts/platform";
import { LOGO_MAXIMO_BYTES } from "@erp/shared/platform";

/** Identificador sugerido pelo nome: minúsculas, sem acento, hífen no lugar do resto. */
export function slugDoNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Parâmetros que a tela edita trocados pelo digitado (lista separada por vírgula); os que ela não
 * conhece ficam como estão.
 */
export function parametrosEditados(
  atuais: Record<string, ValorDeParametro>,
  campos: readonly { chave: string; lista?: boolean }[],
  digitados: Record<string, string>,
): Record<string, ValorDeParametro> {
  const editados = new Set(campos.map((c) => c.chave));
  const parametros = Object.fromEntries(Object.entries(atuais).filter(([k]) => !editados.has(k)));
  for (const c of campos) {
    const bruto = (digitados[c.chave] ?? "").trim();
    if (bruto)
      parametros[c.chave] = c.lista
        ? bruto
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : bruto;
  }
  return parametros;
}

/** Confere tipo e tamanho antes de enviar; a API confere de novo pelo conteúdo. */
export function problemaDoLogo(arquivo: { type: string; size: number }): string | null {
  if (!/^image\/(png|jpeg)$/.test(arquivo.type)) return "Envie o logo em PNG ou JPEG.";
  if (arquivo.size > LOGO_MAXIMO_BYTES) {
    return "O logo passa de 512 KB. Reduza a imagem e envie de novo.";
  }
  return null;
}
