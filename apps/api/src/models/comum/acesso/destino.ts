/**
 * Caractere de controle (incl. tab, CR, LF), espaço, DEL ou barra invertida: o navegador os
 * descarta ou troca por "/" ao montar a URL, e "/\t/site" vira "//site".
 */
// eslint-disable-next-line no-control-regex -- o ponto é justamente recusar caractere de controle
const CARACTERE_PROIBIDO = /[\u0000- \u007f\\]/;

/**
 * Destino depois do login (`?redirect=`): só caminho interno. Rejeita o que não começa com "/",
 * caracteres de controle e espaço, e resolve contra a origem do sistema exigindo a mesma origem
 * (fecha "//site", "/\t/site" e afins). Devolve caminho + query + fragmento; "/" se não serve.
 */
export function destinoInterno(destino: string | undefined, origem: string): string {
  if (!destino?.startsWith("/") || CARACTERE_PROIBIDO.test(destino)) return "/";
  try {
    const base = new URL(origem);
    const url = new URL(destino, base);
    return url.origin === base.origin ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}
