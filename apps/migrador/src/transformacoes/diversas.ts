import { createHash } from "node:crypto";

import { ErroDeConversao } from "./erros";

export function sha256Hex(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

/**
 * UUID estável a partir de partes (para linhas que não tinham `id` na origem): rodar de novo
 * gera o mesmo id, então o upsert e a conferência continuam batendo. Formato de UUID v5.
 */
export function uuidDeterministico(...partes: readonly string[]): string {
  const h = createHash("sha256").update(partes.join("\u0000"), "utf8").digest("hex");
  const variante = ((Number.parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `5${h.slice(13, 16)}`,
    `${variante}${h.slice(17, 20)}`,
    h.slice(20, 32),
  ].join("-");
}

/**
 * Valor de lista fechada (enum/check do destino). Valor desconhecido é erro, nunca um palpite.
 */
export function daLista<T extends string>(valor: string, lista: readonly T[], coluna: string): T {
  const achado = lista.find((item) => item === valor);
  if (achado === undefined) {
    throw new ErroDeConversao(coluna, valor, `fora da lista (${lista.join(", ")})`);
  }
  return achado;
}

/** `triggered_by` dos logs atuais → `disparado_por` (`cron` virou `agendamento`). */
export function disparadoPor<T extends string>(
  valor: string | null,
  lista: readonly T[],
  coluna: string,
): T {
  const traduzido = valor === null || valor === "cron" ? "agendamento" : valor;
  return daLista(traduzido, lista, coluna);
}

/** Etapa da coleta pela situação do SSW. origem: vw_coletas (docs/regras/04 §4.1) */
export function etapaDaColeta(
  situacao: string | null,
): "cadastrada" | "comandada" | "coletada" | "cancelada" {
  const s = situacao ?? "";
  if (s.startsWith("CANCEL")) return "cancelada";
  if (s.startsWith("COLETAD")) return "coletada";
  if (s.startsWith("COMAND")) return "comandada";
  return "cadastrada";
}

/**
 * Link público do ranking: o banco novo guarda só o SHA-256 do token (a URL não muda).
 * origem: equipes_entrega.share_token
 */
export function hashDoTokenPublico(token: string | null): string | null {
  return token === null || token === "" ? null : sha256Hex(token);
}
