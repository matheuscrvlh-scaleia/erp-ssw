import { SEM_TIPO_DOCUMENTO } from "@erp/shared/contratos/ocorrencias";

import { btrim, tipoDocumentoEfetivo } from "../nucleo";

/**
 * Número do CT-e digitado na busca, como está gravado (`ctes.numero`: dígitos sem zero à
 * esquerda). Aceita sigla colada e dígito verificador: "CAS 150354-5" → "150354". Sem dígito
 * útil ("ABC", "000") → nulo, e o filtro fica desligado.
 * origem: ocorrencias_painel_v5 / comprovantes_lista_v2 (sistema atual)
 */
export function termoCtrc(entrada: string): string | null {
  const termo = btrim(entrada)
    .toUpperCase()
    .replace(/^[A-Z]+/, "")
    .replace(/-.*$/s, "")
    .replace(/[^0-9]/g, "")
    .replace(/^0+/, "");
  return termo === "" ? null : termo;
}

/** Número da NF digitado na busca: só dígitos, sem zero à esquerda. Vazio → nulo. */
export function termoNf(entrada: string): string | null {
  const termo = entrada.replace(/[^0-9]/g, "").replace(/^0+/, "");
  return termo === "" ? null : termo;
}

/**
 * Padrões `ILIKE` de um filtro de texto. Vários valores separados por "|" casam se qualquer um
 * casar ("a||b" tem um valor vazio, que casa tudo). `%`, `_` e `\` digitados valem como texto
 * (Q10 do dono: busca literal).
 * origem: texto_casa_filtro (sistema atual)
 */
export function padroesDoFiltroDeTexto(filtro: string): string[] {
  const literal = (valor: string) => valor.replace(/[\\%_]/g, (c) => `\\${c}`);
  return btrim(filtro)
    .split(/\s*\|\s*/)
    .map((valor) => `%${literal(valor)}%`);
}

/**
 * Tipos de documento do seletor: maiúsculos, sem vazios nem repetidos. Lista vazia = sem filtro.
 * origem: saneTipos (src/features/performance, sistema atual)
 */
export function saneTipos(tipos: readonly string[]): string[] {
  return [...new Set(tipos.map((t) => t.trim().toUpperCase()).filter((t) => t !== ""))];
}

/** Tipo de documento do CT-e (regra do núcleo) como os filtros usam: sem tipo = `SEM_TIPO_DOCUMENTO`. */
export function tipoDocumentoDoFiltro(tipo455: string | null, tipoBi2: string | null): string {
  return tipoDocumentoEfetivo(tipo455, tipoBi2) ?? SEM_TIPO_DOCUMENTO;
}

/** Rótulo do pagador nas telas: nome, senão CNPJ, senão "—" (texto vazio conta como ausente). */
export function rotuloDoPagador(nome: string | null, cnpj: string | null): string {
  return nome || cnpj || "—";
}
