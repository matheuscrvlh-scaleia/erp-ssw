/** Liga/desliga um valor numa lista de filtro. */
export const alternar = (lista: readonly string[], valor: string) =>
  lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];

/** O 050 sai do SSW em ISO-8859-1 (impresso ou CSV); o servidor recebe o texto já decodificado. */
export async function lerArquivo050(arquivo: Pick<Blob, "arrayBuffer">): Promise<string> {
  return new TextDecoder("iso-8859-1").decode(await arquivo.arrayBuffer());
}
