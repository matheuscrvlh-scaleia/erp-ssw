import {
  contratosListagem as c,
  type FiltroListaEntrada,
  ITENS_POR_PAGINA,
  ITENS_POR_PAGINA_EXPORTACAO,
  type LinhaLista,
  type OrdemLista,
} from "@erp/shared/contratos/listagem";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

/** Toda a Listagem fica sob esta chave ("Atualizar" invalida tudo). */
export const CHAVE_DA_LISTAGEM = ["listagem"] as const;

export interface Ordenacao {
  ordem: OrdemLista;
  direcao: "asc" | "desc";
}

export const consultaLista = (filtro: FiltroListaEntrada, ordenacao: Ordenacao, pagina: number) =>
  queryOptions({
    queryKey: [...CHAVE_DA_LISTAGEM, "lista", filtro, ordenacao, pagina],
    queryFn: () =>
      chamar(c.listar, {
        entrada: { ...filtro, ...ordenacao, pagina, porPagina: ITENS_POR_PAGINA },
      }),
    staleTime: 30_000,
  });

export const consultaCodigosDoRecorte = (filtro: FiltroListaEntrada) => {
  const semCodigos = { ...filtro, codigos: undefined };
  return queryOptions({
    queryKey: [...CHAVE_DA_LISTAGEM, "codigos", semCodigos],
    queryFn: () => chamar(c.codigos, { entrada: semCodigos }),
    staleTime: 60_000,
  });
};

/**
 * Teto da exportação no navegador: acima disto a planilha não cabe na memória da aba. Passou,
 * exporta os primeiros (na ordem da tela) e avisa quantos ficaram de fora — nunca em silêncio.
 */
export const LIMITE_DA_EXPORTACAO = 100_000;

/**
 * Todas as linhas do filtro, página a página (a API não corta). `aoProgredir` recebe quantas já
 * vieram, para a tela mostrar o andamento.
 */
export async function carregarTodasAsLinhas(
  filtro: FiltroListaEntrada,
  ordenacao: Ordenacao,
  aoProgredir?: (carregadas: number) => void,
): Promise<{ linhas: LinhaLista[]; cortada: boolean }> {
  const linhas: LinhaLista[] = [];
  for (let pagina = 1; ; pagina += 1) {
    const resposta = await chamar(c.exportar, {
      entrada: { ...filtro, ...ordenacao, pagina, porPagina: ITENS_POR_PAGINA_EXPORTACAO },
    });
    linhas.push(...resposta.linhas);
    aoProgredir?.(linhas.length);
    if (linhas.length >= LIMITE_DA_EXPORTACAO) {
      const cortada = resposta.temMais || linhas.length > LIMITE_DA_EXPORTACAO;
      return { linhas: linhas.slice(0, LIMITE_DA_EXPORTACAO), cortada };
    }
    if (!resposta.temMais) return { linhas, cortada: false };
  }
}
