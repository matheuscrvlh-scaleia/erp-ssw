import { type EntradaDe } from "@erp/shared/contrato";
import {
  type Card,
  contratosOcorrencias as c,
  type FiltrosDeCte,
  type LinhaDeOcorrencia,
  type Recortes,
} from "@erp/shared/contratos/ocorrencias";
import { queryOptions } from "@tanstack/react-query";

import { chamar, ErroDaApi } from "@/lib/api";

export const consultaPainel = (entrada: FiltrosDeCte & Recortes) =>
  queryOptions({
    queryKey: ["ocorrencias", "painel", entrada],
    queryFn: () => chamar(c.painel, { entrada }),
  });

export type EntradaDaLista = EntradaDe<typeof c.lista>;

export const consultaLista = (entrada: EntradaDaLista) =>
  queryOptions({
    queryKey: ["ocorrencias", "lista", entrada],
    queryFn: () => chamar(c.lista, { entrada }),
  });

/** As opções só dependem do período e das unidades/filiais. */
export const consultaOpcoes = (entrada: EntradaDe<typeof c.opcoes>) =>
  queryOptions({
    queryKey: ["ocorrencias", "opcoes", entrada],
    queryFn: () => chamar(c.opcoes, { entrada }),
    staleTime: 5 * 60_000,
  });

export const consultaConferentes = queryOptions({
  queryKey: ["ocorrencias", "conferentes"],
  queryFn: () => chamar(c.conferentes),
  staleTime: 60 * 60_000,
});

export const consultaCodigosDoCard = (filtros: FiltrosDeCte, card: Card) =>
  queryOptions({
    queryKey: ["ocorrencias", "codigos-do-card", card, filtros],
    queryFn: () => chamar(c.codigosDoCard, { entrada: { ...filtros, card } }),
    staleTime: 60_000,
  });

const TAMANHO_DA_EXPORTACAO = 500;
export const MENSAGEM_DADOS_MUDARAM =
  "Os dados mudaram durante a exportação. Atualize e tente novamente.";

const dadosMudaram = () => new ErroDaApi("CONFLITO", MENSAGEM_DADOS_MUDARAM, 409);

/** Todas as páginas da lista com os mesmos filtros; se o total mudar no meio, avisa. */
export async function carregarListaInteira(
  entrada: EntradaDaLista,
  buscar: (e: EntradaDaLista) => Promise<{ linhas: LinhaDeOcorrencia[]; total: number }> = (e) =>
    chamar(c.lista, { entrada: e }),
): Promise<LinhaDeOcorrencia[]> {
  const todas: LinhaDeOcorrencia[] = [];
  let esperado: number | null = null;
  for (let pagina = 1; ; pagina++) {
    const r = await buscar({ ...entrada, pagina, tamanho: TAMANHO_DA_EXPORTACAO });
    esperado ??= r.total;
    if (r.total !== esperado) throw dadosMudaram();
    todas.push(...r.linhas);
    if (todas.length >= r.total) return todas;
    if (r.linhas.length === 0) throw dadosMudaram();
  }
}
