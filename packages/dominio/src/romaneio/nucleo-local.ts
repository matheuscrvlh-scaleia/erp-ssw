/**
 * Regras do núcleo do CT-e (docs/regras/01-nucleo-ctrc.md) usadas pelo Romaneio e pelo Prazo do
 * parceiro. O núcleo está sendo escrito em `packages/dominio/src/nucleo/`; enquanto ele não chega
 * na main, ficam aqui com a mesma assinatura da spec.
 */

/** Códigos de entrega (tipo ENTREGA, fixos). origem: _is_entregue */
export const CODIGOS_ENTREGA: readonly number[] = [1, 18, 67];

/** Tipos SSW que contam como pendência ("teve problema", travado, motivos). */
export const TIPOS_PENDENCIA: readonly string[] = ["PENDENCIA_CLIENTE", "PENDENCIA_TRANSPORTADORA"];

// TODO(nucleo): trocar por nucleo/normCodigoOcorr
/**
 * Código só com dígitos: "085" → 85, "12-A" → 12, ""/null → null. Usada também onde o SQL atual
 * fazia `_normaliza_codigo_ocorr` (Q54: texto não numérico vira "sem código").
 * origem: norm_codigo_ocorr
 */
export function normCodigoOcorr(texto: string | null): number | null {
  const digitos = (texto ?? "").replace(/\D/g, "");
  return digitos === "" ? null : Number.parseInt(digitos, 10);
}

// TODO(nucleo): trocar por nucleo/estaEntregue
/** origem: _is_entregue */
export function estaEntregue(dataEntrega: Date | null, codigoEfetivo: string | null): boolean {
  if (dataEntrega !== null) return true;
  const codigo = normCodigoOcorr(codigoEfetivo);
  return codigo !== null && CODIGOS_ENTREGA.includes(codigo);
}

// TODO(nucleo): trocar por nucleo/estaFinalizadoSemEntrega
/**
 * Baixa formal sem entrega. `codigosBaixa` = cadastro da empresa com tipo BAIXA (Q22). As RPCs do
 * romaneio excluem 1/18/67; dá no mesmo enquanto 18/67 não forem BAIXA.
 * origem: _is_finalizado_sem_entrega
 */
export function estaFinalizadoSemEntrega(
  dataEntrega: Date | null,
  codigoEfetivo: string | null,
  codigosBaixa: ReadonlySet<number>,
): boolean {
  if (dataEntrega !== null) return false;
  const codigo = normCodigoOcorr(codigoEfetivo);
  return codigo !== null && !CODIGOS_ENTREGA.includes(codigo) && codigosBaixa.has(codigo);
}

const DE = "áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ";
const PARA = "aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC";

// TODO(nucleo): trocar por nucleo/normalizarNome
/** Maiúsculas e sem acento (não apara). "João Ação" → "JOAO ACAO". origem: normalizar_nome */
export function normalizarNome(texto: string | null): string {
  return [...(texto ?? "")]
    .map((ch) => {
      const i = DE.indexOf(ch);
      return i >= 0 ? (PARA[i] ?? ch) : ch;
    })
    .join("")
    .toUpperCase();
}

// TODO(nucleo): trocar por nucleo/padroesTextoFiltro
/**
 * Padrões ILIKE do filtro de texto com vários valores ("a|b"). Sem escapar `%`/`_` (igual ao
 * núcleo). origem: texto_casa_filtro
 */
export function padroesTextoFiltro(filtro: string): string[] {
  const t = filtro.replace(/^ +| +$/g, "");
  if (!filtro.includes("|")) return [`%${t}%`];
  return `%${t.replace(/\s*\|\s*/g, "%|%")}%`.split("|");
}

const TRES_HORAS_MS = 3 * 3_600_000;

// TODO(nucleo): trocar por nucleo/diaSp
/**
 * Dia (AAAA-MM-DD) do instante em America/Sao_Paulo.
 * atalho: deslocamento fixo de −3 h (Brasil sem horário de verão desde 2019).
 */
export function diaSp(instante: Date): string {
  return new Date(instante.getTime() - TRES_HORAS_MS).toISOString().slice(0, 10);
}

/** Hora (0–23) do instante em America/Sao_Paulo. atalho: −3 h fixo, como `diaSp`. */
export function horaSp(instante: Date): number {
  return new Date(instante.getTime() - TRES_HORAS_MS).getUTCHours();
}

/**
 * 00:00 do dia em America/Sao_Paulo. Hoje o SQL usa 00:00 UTC (`data::timestamptz` com a sessão
 * em UTC); o dono decidiu contar pelo dia de Brasília (Q11).
 * atalho: −3 h fixo, como `diaSp`.
 */
export function inicioDoDiaSp(dia: string): Date {
  return new Date(`${dia}T00:00:00-03:00`);
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
