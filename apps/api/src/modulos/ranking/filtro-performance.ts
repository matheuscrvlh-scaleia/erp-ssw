// TODO(performance): construtor local do filtro de performance (FP, spec 02 §0.3 e §0.5). Quando o
// agente de Performance publicar o construtor compartilhado, o ranking passa a usar o dele.
import { ctes } from "@erp/db/schema";
import { and, eq, inArray, isNotNull, not, type SQL, sql } from "drizzle-orm";

export type BaseDeData = "emissao" | "prevista" | "concluido";

/** Filtro já normalizado pelo caso de uso (listas vazias viram nulo = sem filtro). */
export interface FiltroPerformance {
  empresaId: string;
  inicio: string;
  fim: string;
  baseData: BaseDeData;
  /** Filiais próprias pedidas (já cruzadas com as próprias); nulo = todas as próprias. */
  filiais: string[] | null;
  filiaisProprias: string[];
  pagadores: string[] | null;
  remetente: string | null;
  destino: string | null;
  tipos: string[] | null;
}

export const SEM_TIPO = "__SEM_TIPO__";

/**
 * Padrões ILIKE do texto com vários valores: "a|b" → ["%a%", "%b%"]. Não escapa % e _ digitados
 * (igual a hoje).
 * origem: texto_casa_filtro, src/lib/filtro-texto.ts
 */
export function padroesDoTexto(filtro: string): string[] {
  const limpo = filtro.replace(/^ +| +$/g, "");
  if (!limpo.includes("|")) return [`%${limpo}%`];
  return `%${limpo.replace(/\s*\|\s*/g, "%|%")}%`.split("|");
}

/** Só dígitos; nulo vira vazio. */
export function digitos(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

/** Filiais pedidas que são próprias, em maiúsculas; nenhuma pedida = nulo (sem filtro). */
export function filiaisPedidas(
  pedidas: readonly string[] | null | undefined,
  proprias: readonly string[],
) {
  const set = new Set(proprias.map((p) => p.trim().toUpperCase()));
  const validas = [...new Set((pedidas ?? []).map((f) => f.trim().toUpperCase()))].filter((f) =>
    set.has(f),
  );
  return validas.length > 0 ? validas : null;
}

/** Tipos em maiúsculas, sem vazio nem repetição; nenhum = nulo. origem: saneTipos */
export function tiposPedidos(pedidos: readonly string[] | null | undefined): string[] | null {
  const tipos = [...new Set((pedidos ?? []).map((t) => t.trim().toUpperCase()).filter(Boolean))];
  return tipos.length > 0 ? tipos : null;
}

/** `array[$1, $2, …]::text[]` (lista não vazia), um parâmetro por item. */
function arrayDeTexto(valores: readonly string[]): SQL {
  return sql`array[${sql.join(
    valores.map((v) => sql`${v}`),
    sql`, `,
  )}]::text[]`;
}

const COLUNA_DA_BASE = {
  emissao: ctes.dataEmissao,
  prevista: ctes.dataPrevistaEntrega,
  concluido: ctes.dataConclusaoEfetiva,
} as const;

/** origem: tipo_documento_efetivo — o tipo do 455 vence o do BI2; vazio = sem tipo. */
const tipoDocumentoEfetivo = sql<string>`coalesce(nullif(upper(coalesce(nullif(btrim(${ctes.tipoDocumento455}), ''), btrim(${ctes.tipoDocumento}))), ''), ${SEM_TIPO})`;

/**
 * Universo da tela (empresa, filial efetiva própria, fora do universo excluído) + período pela
 * base + filtros. Sem filial própria cadastrada o universo é vazio.
 */
export function condicaoDoFiltro(f: FiltroPerformance): SQL {
  const coluna = COLUNA_DA_BASE[f.baseData];
  const filiais = f.filiais ?? f.filiaisProprias;
  const condicoes: (SQL | undefined)[] = [
    eq(ctes.empresaId, f.empresaId),
    not(ctes.foraUniverso),
    filiais.length > 0 ? inArray(ctes.filialEfetiva, filiais) : sql`false`,
    isNotNull(coluna),
    sql`${coluna} between ${f.inicio} and ${f.fim}`,
    f.pagadores ? inArray(ctes.pagadorCnpjDigitos, f.pagadores) : undefined,
    f.remetente
      ? sql`${ctes.remetente} ilike any(${arrayDeTexto(padroesDoTexto(f.remetente))})`
      : undefined,
    f.destino
      ? sql`${ctes.cidadeDestino} ilike any(${arrayDeTexto(padroesDoTexto(f.destino))})`
      : undefined,
    f.tipos ? sql`${tipoDocumentoEfetivo} = any(${arrayDeTexto(f.tipos)})` : undefined,
  ];
  return and(...condicoes) ?? sql`true`;
}
