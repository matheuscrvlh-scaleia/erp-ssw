import { ErroDaApi } from "@/lib/api";

export const MENSAGEM_DADOS_MUDARAM =
  "Os dados mudaram durante a exportação. Atualize e tente novamente.";

/** Páginas de 500 (o máximo dos contratos de lista). */
export const TAMANHO_DA_PAGINA_DE_EXPORTACAO = 500;

/**
 * Todas as páginas de uma lista paginada no servidor, com os mesmos filtros. Se o total mudar no
 * meio (chegou importação), avisa em vez de entregar um arquivo incoerente.
 */
export async function carregarTodasAsPaginas<L>(
  buscar: (pagina: number, tamanho: number) => Promise<{ linhas: L[]; total: number }>,
): Promise<L[]> {
  const todas: L[] = [];
  let esperado: number | null = null;
  for (let pagina = 1; ; pagina++) {
    const r = await buscar(pagina, TAMANHO_DA_PAGINA_DE_EXPORTACAO);
    esperado ??= r.total;
    if (r.total !== esperado || (r.linhas.length === 0 && todas.length < r.total)) {
      throw new ErroDaApi("CONFLITO", MENSAGEM_DADOS_MUDARAM, 409);
    }
    todas.push(...r.linhas);
    if (todas.length >= r.total) return todas;
  }
}
