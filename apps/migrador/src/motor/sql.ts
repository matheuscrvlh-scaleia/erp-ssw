import {
  type ChaveDeOrigem,
  type ConsultaDeOrigem,
  type Filtros,
  type ParametroNomeado,
} from "./tipos";

export interface SqlMontado {
  texto: string;
  parametros: unknown[];
}

const TOKEN = /@([a-z][a-z0-9_]*)/g;

/**
 * Troca `@nome` por `$n::tipo` e devolve os valores na ordem. Cada nome usado vira um parâmetro
 * só (repetido no texto, mesmo `$n`). Nome sem valor é erro de programação.
 */
export function montarSql(
  texto: string,
  valores: Readonly<Record<string, ParametroNomeado>>,
): SqlMontado {
  const indices = new Map<string, number>();
  const parametros: unknown[] = [];
  const montado = texto.replace(TOKEN, (_trecho, nome: string) => {
    const parametro = valores[nome];
    if (!parametro) throw new Error(`Parâmetro @${nome} sem valor.`);
    let indice = indices.get(nome);
    if (indice === undefined) {
      parametros.push(parametro.valor);
      indice = parametros.length;
      indices.set(nome, indice);
    }
    return `$${indice}::${parametro.tipo}`;
  });
  return { texto: montado, parametros };
}

export function parametrosDosFiltros(filtros: Filtros): Record<string, ParametroNomeado> {
  return {
    empresa: { valor: filtros.empresaId, tipo: "uuid" },
    instante: { valor: filtros.instante, tipo: "timestamptz" },
  };
}

/** Recorte por empresa (`--empresa`): sem empresa, todas. */
export function daEmpresa(coluna: string): string {
  return `(@empresa is null or ${coluna} = @empresa)`;
}

/** Janela de retenção contada do instante da migração (fixo entre execuções). */
export function nosUltimosDias(coluna: string, dias: number): string {
  return `${coluna} >= @instante - interval '${String(dias)} days'`;
}

export const ALIAS_DA_CHAVE = "__k";

function tupla(expressoes: readonly string[]): string {
  return expressoes.length === 1 ? (expressoes[0] ?? "") : `(${expressoes.join(", ")})`;
}

/**
 * Página por keyset: `chave > última chave lida`, ordenada pela chave. As chaves voltam em
 * texto (`__k0`, `__k1`...) e são comparadas de novo com o tipo nativo (ordem certa de número
 * e data).
 */
export function montarLoteDeOrigem(
  consulta: ConsultaDeOrigem,
  filtros: Filtros,
  apos: readonly string[] | null,
  limite: number,
): SqlMontado {
  const valores: Record<string, ParametroNomeado> = {
    ...parametrosDosFiltros(filtros),
    limite: { valor: limite, tipo: "integer" },
  };
  const condicoes = [...consulta.onde];
  if (apos !== null) {
    condicoes.push(condicaoDeKeyset(consulta.chave, apos, valores));
  }
  const chaves = consulta.chave
    .map((c, i) => `(${c.expressao})::text as ${ALIAS_DA_CHAVE}${String(i)}`)
    .join(", ");
  const texto = [
    `select ${consulta.colunas}, ${chaves}`,
    `from ${consulta.de}`,
    condicoes.length > 0 ? `where ${condicoes.map((c) => `(${c})`).join(" and ")}` : "",
    `order by ${consulta.chave.map((c) => c.expressao).join(", ")}`,
    "limit @limite",
  ]
    .filter((linha) => linha !== "")
    .join("\n");
  return montarSql(texto, valores);
}

function condicaoDeKeyset(
  chave: readonly ChaveDeOrigem[],
  apos: readonly string[],
  valores: Record<string, ParametroNomeado>,
): string {
  if (apos.length !== chave.length) throw new Error("Checkpoint com chave de outro formato.");
  const nomes = chave.map((c, i) => {
    const nome = `k${String(i)}`;
    valores[nome] = { valor: apos[i], tipo: c.tipo };
    return `@${nome}`;
  });
  return `${tupla(chave.map((c) => c.expressao))} > ${tupla(nomes)}`;
}
