/**
 * Regras do núcleo do CT-e (docs/regras/01-nucleo-ctrc.md) que o Romaneio usa e o núcleo
 * (`packages/dominio/src/nucleo/`) ainda não expõe com esta forma.
 */
import { CODIGOS_ENTREGA, TIPOS_PENDENCIA } from "../nucleo";

/** Tipo SSW do cadastro (texto) é pendência ("teve problema", travado, motivos). */
export const ehTipoPendencia = (tipo: string | null): boolean =>
  [...TIPOS_PENDENCIA].some((t) => t === tipo);

/** Código de entrega (1, 18, 67). */
export const ehCodigoEntrega = (codigo: number): boolean => CODIGOS_ENTREGA.has(codigo);

const TRES_HORAS_MS = 3 * 3_600_000;

// TODO(nucleo): trocar por nucleo/horaSp
/** Hora (0–23) do instante em America/Sao_Paulo. atalho: −3 h fixo (sem horário de verão). */
export function horaSp(instante: Date): number {
  return new Date(instante.getTime() - TRES_HORAS_MS).getUTCHours();
}

// TODO(nucleo): trocar por nucleo/unidadeResponsavel
/**
 * Unidade que responde pelo CT-e: destino, senão a atual, quando são filiais próprias; senão a
 * filial de emissão. origem: _unidade_responsavel
 */
export function unidadeResponsavel(
  filiaisProprias: ReadonlySet<string>,
  c: { unidadeDestino: string | null; unidadeAtual: string | null; filial: string | null },
): string | null {
  if (c.unidadeDestino !== null && filiaisProprias.has(c.unidadeDestino)) return c.unidadeDestino;
  if (c.unidadeAtual !== null && filiaisProprias.has(c.unidadeAtual)) return c.unidadeAtual;
  return c.filial;
}
