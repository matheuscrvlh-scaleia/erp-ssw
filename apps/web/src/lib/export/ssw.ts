/**
 * Link do CT-e no SSW. Toda exportação que lista CT-e um a um leva a coluna "Link SSW": no CSV
 * sai a URL; no Excel e no PDF, o texto "Abrir no SSW" clicável; na impressão, "SSW".
 * origem: src/lib/ssw.ts (sistema atual)
 */
export const COLUNA_LINK_SSW = "Link SSW";
export const TEXTO_LINK_SSW = "Abrir no SSW";

const PREFIXO_SSW = "https://sistema.ssw.inf.br/";

/** URL do CT-e no SSW; sem sigla, número ou emissão ("AAAA-MM-DD") não há link. */
export function urlCtrcNoSsw(
  sigla: string | null | undefined,
  numero: string | number | null | undefined,
  emissao: string | null | undefined,
): string | null {
  if (!sigla || numero == null || numero === "" || !emissao) return null;
  const data = /^(\d{4})-(\d{2})-(\d{2})/.exec(emissao);
  if (!data) return null;
  const [, ano = "", mes = "", dia = ""] = data;
  const ddmmaa = `${dia}${mes}${ano.slice(2)}`;
  const nro = String(numero).replace(/\D+/g, "").padStart(6, "0");
  return (
    `${PREFIXO_SSW}bin/ssw0053?act=P1` +
    `&t_ser_ctrc=${encodeURIComponent(sigla)}` +
    `&t_nro_ctrc=${nro}` +
    `&t_data_ini=${ddmmaa}` +
    `&t_data_fin=${ddmmaa}`
  );
}

export function ehLinkSsw(valor: unknown): valor is string {
  return typeof valor === "string" && valor.startsWith(PREFIXO_SSW);
}
