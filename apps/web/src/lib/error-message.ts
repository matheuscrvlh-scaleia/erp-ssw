import { MENSAGEM_ERRO_INTERNO, MENSAGEM_RECARREGAR } from "@erp/shared/errors";

import { ErroDaApi } from "@/lib/api";
import { ehChunkObsoleto } from "@/lib/version";

/**
 * Erro do próprio front com texto escrito para o operador (validação local, navegador bloqueou a
 * impressão...). Só ele e o erro da API têm a mensagem mostrada na tela.
 */
export class ErroDoOperador extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDoOperador";
  }
}

/**
 * Texto para o operador. Só a mensagem da API e a do `ErroDoOperador` são confiáveis para mostrar
 * (já vêm em português e dizem o que fazer, ex.: "reduza o período"); qualquer outro erro vira a
 * mensagem genérica, para não vazar texto técnico ("Failed to fetch", "undefined is not a
 * function") na tela.
 */
export function mensagemAmigavel(erro: unknown, generica: string = MENSAGEM_ERRO_INTERNO): string {
  if (erro instanceof ErroDaApi || erro instanceof ErroDoOperador) return erro.message;
  if (ehChunkObsoleto(erro)) return MENSAGEM_RECARREGAR;
  return generica;
}
