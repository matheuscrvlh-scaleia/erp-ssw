import {
  CATEGORIAS_DE_TELA,
  type CategoriaDeTela,
  chavesDoItem,
} from "@erp/shared/acesso/editor-de-telas";
import { type Tela } from "@erp/shared/acesso/telas";
import { type ExcecaoDeTela } from "@erp/shared/contratos/admin";

/** Exceção por tela: `true` libera, `false` bloqueia; ausente = padrão do nível/departamento. */
export type MapaDeExcecoes = Partial<Record<Tela, boolean>>;

export function mapaDasExcecoes(lista: readonly ExcecaoDeTela[]): MapaDeExcecoes {
  return Object.fromEntries(lista.map((e) => [e.tela, e.permitido]));
}

/** Lista para a API; o item "Ranking" grava as duas chaves. */
export function listaDasExcecoes(mapa: MapaDeExcecoes): ExcecaoDeTela[] {
  return CATEGORIAS_DE_TELA.flatMap((c) => c.telas).flatMap((t) => {
    const permitido = mapa[t];
    return permitido === undefined ? [] : chavesDoItem(t).map((tela) => ({ tela, permitido }));
  });
}

export const rotuloDaExcecao = (v: boolean | undefined) =>
  v === undefined ? "Padrão" : v ? "Liberar" : "Bloquear";

export interface Troca {
  rotulo: string;
  antes: string;
  depois: string;
}

export interface TrocasDaCategoria extends CategoriaDeTela {
  trocas: (Troca & { tela: Tela })[];
}

/** Exceções alteradas, por categoria do editor (só as categorias com alguma troca). */
export function trocasDeExcecao(
  antes: MapaDeExcecoes,
  depois: MapaDeExcecoes,
  rotuloDaTela: (t: Tela) => string,
): TrocasDaCategoria[] {
  return CATEGORIAS_DE_TELA.map((c) => ({
    ...c,
    trocas: c.telas
      .filter((t) => antes[t] !== depois[t])
      .map((t) => ({
        tela: t,
        rotulo: rotuloDaTela(t),
        antes: rotuloDaExcecao(antes[t]),
        depois: rotuloDaExcecao(depois[t]),
      })),
  })).filter((c) => c.trocas.length > 0);
}
