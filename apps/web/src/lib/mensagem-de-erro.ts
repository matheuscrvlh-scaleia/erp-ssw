import { MENSAGEM_ERRO_INTERNO, MENSAGEM_RECARREGAR } from "@erp/shared/erros";

import { ErroDaApi } from "@/lib/api";
import { ehChunkObsoleto } from "@/lib/versao";

/**
 * Texto para o operador. Só a mensagem da API é confiável para mostrar (ela já vem em português e
 * diz o que fazer, ex.: "reduza o período"); qualquer outro erro vira a mensagem genérica, para
 * não vazar texto técnico ("Failed to fetch", "undefined is not a function") na tela.
 */
export function mensagemAmigavel(erro: unknown): string {
  if (erro instanceof ErroDaApi) return erro.message;
  if (ehChunkObsoleto(erro)) return MENSAGEM_RECARREGAR;
  return MENSAGEM_ERRO_INTERNO;
}
