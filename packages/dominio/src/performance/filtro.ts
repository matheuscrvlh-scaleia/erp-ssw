import { type BaseDeData, type FiltroPerformanceValidado } from "@erp/shared/contratos/performance";

import { padroesDeTexto } from "../listagem/texto";
import { somenteDigitos } from "../nucleo/texto";

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehUuid(valor: string): boolean {
  return RE_UUID.test(valor);
}

/**
 * Filtro da Performance já normalizado: é o que o repositório transforma em `WHERE`.
 * `null` = sem filtro; lista vazia = nada casa (filtro informado, mas sem valor válido).
 */
export interface FiltroCtrc {
  /** Nulo = sem período. */
  periodo: { inicio: string; fim: string } | null;
  baseData: BaseDeData;
  /** uuids de `unidades`. */
  unidades: string[] | null;
  /** CNPJ do pagador só com dígitos. */
  parceiros: string[] | null;
  /** Siglas próprias (filial efetiva). */
  filiais: string[] | null;
  /** Padrões ILIKE de remetente. */
  remetente: string[] | null;
  /** Padrões ILIKE de cidade de destino. */
  destino: string[] | null;
  /** Códigos da ocorrência efetiva. */
  codigos: number[] | null;
  /** Tipo de documento efetivo; `SEM_TIPO_DOCUMENTO` = sem tipo. */
  tipos: string[] | null;
}

const preenchida = (lista: readonly string[] | null | undefined) =>
  lista && lista.length > 0 ? [...lista] : null;

function semDuplicados(lista: string[]): string[] {
  return [...new Set(lista)];
}

/** Mesma leitura da Listagem ("a|b", vazios ignorados, % e _ como letra), para card e lista baterem. */
const texto = (valor: string | null | undefined): string[] | null => padroesDeTexto(valor);

/** Itens sem dígito não casam nada (como o `NULL` do SQL de hoje). */
export function codigosDoFiltro(codigos: readonly string[] | null | undefined): number[] | null {
  if (!preenchida(codigos)) return null;
  return [
    ...new Set(
      (codigos ?? [])
        .map((c) => somenteDigitos(c))
        .filter((d) => d !== "")
        .map((d) => Number(d)),
    ),
  ];
}

/** Maiúsculas, sem vazios nem repetidos; `SEM_TIPO_DOCUMENTO` passa como está. */
export function tiposDoFiltro(tipos: readonly string[] | null | undefined): string[] | null {
  const limpos = semDuplicados((tipos ?? []).map((t) => t.trim().toUpperCase()).filter(Boolean));
  return limpos.length > 0 ? limpos : null;
}

/**
 * Normaliza o filtro da tela:
 * 1. `unidades` que não são uuid são siglas (links de outras telas) e vão para `filiais`;
 * 2. `filiais` ficam só as próprias da empresa — se nenhuma informada é própria, nada casa
 *    (decisão Q10: filtro inválido mostra lista vazia, não todas as filiais);
 * 3. tipos em maiúsculas, códigos pelos dígitos, textos em padrões ILIKE.
 * origem: _perf_filtro_ctrcs + normalizarFiltroUnidades (sistema atual)
 */
export function normalizarFiltro(
  entrada: FiltroPerformanceValidado,
  filiaisProprias: readonly string[],
): FiltroCtrc {
  const unidades = entrada.unidades ?? [];
  const siglasDeUnidades = unidades.filter((u) => !ehUuid(u)).map((u) => u.trim().toUpperCase());
  const filiaisPedidas = semDuplicados([
    ...(entrada.filiais ?? []).map((f) => f.trim().toUpperCase()),
    ...siglasDeUnidades,
  ]).filter(Boolean);
  const proprias = new Set(filiaisProprias.map((f) => f.trim().toUpperCase()));
  const parceiros = semDuplicados((entrada.parceiros ?? []).map(somenteDigitos).filter(Boolean));
  return {
    periodo: { inicio: entrada.inicio, fim: entrada.fim },
    baseData: entrada.baseData,
    unidades: preenchida(unidades.filter(ehUuid)),
    parceiros: preenchida(entrada.parceiros) ? parceiros : null,
    filiais: filiaisPedidas.length > 0 ? filiaisPedidas.filter((f) => proprias.has(f)) : null,
    remetente: texto(entrada.remetente),
    destino: texto(entrada.destino),
    codigos: codigosDoFiltro(entrada.codigos),
    tipos: tiposDoFiltro(entrada.tipos),
  };
}
