/**
 * SQL puro, parametrizado. `sql\`... ${valor} ...\`` vira texto com `$1, $2…` e a lista de
 * valores: nada de fora é concatenado no texto. Um `Sql` interpolado em outro entra como trecho
 * (composição); qualquer outro valor entra como UM parâmetro (lista JS vira array do Postgres,
 * com o cast escrito por quem usa: `= any(${ids}::uuid[])`).
 */
export class Sql {
  constructor(
    readonly textos: readonly string[],
    readonly valores: readonly unknown[],
  ) {}
}

interface SqlCompilado {
  text: string;
  values: unknown[];
}

function montar(strings: TemplateStringsArray, ...valores: unknown[]): Sql {
  return new Sql([...strings], valores);
}

/** Trechos separados por `separador` (padrão `, `). */
function juntar(trechos: readonly Sql[], separador: Sql = new Sql([", "], [])): Sql {
  if (trechos.length === 0) return new Sql([""], []);
  const textos = [""];
  const valores: unknown[] = [];
  trechos.forEach((trecho, i) => {
    if (i > 0) {
      valores.push(separador);
      textos.push("");
    }
    valores.push(trecho);
    textos.push("");
  });
  return new Sql(textos, valores);
}

/**
 * Texto do código entra literal. Só para texto escrito no código (nome de coluna de uma lista
 * fixa, direção de ordenação), nunca para valor vindo do usuário.
 */
function literal(texto: string): Sql {
  return new Sql([texto], []);
}

/** Identificador entre aspas (`"apelido"`), com aspas internas dobradas. */
function identificador(nome: string): Sql {
  return literal(`"${nome.replaceAll('"', '""')}"`);
}

/** Valor de coluna jsonb: em texto, com cast (o `pg` mandaria lista JS como array do Postgres). */
function json(valor: unknown): Sql {
  return valor === null || valor === undefined
    ? new Sql(["null"], [])
    : new Sql(["", "::jsonb"], [JSON.stringify(valor)]);
}

/** `(a and b and …)` das condições dadas (`undefined` fica de fora); nenhuma = `true`. */
function e(...condicoes: (Sql | undefined)[]): Sql {
  const dadas = condicoes.filter((c) => c !== undefined);
  return dadas.length === 0 ? new Sql(["true"], []) : montar`(${juntar(dadas, montar` and `)})`;
}

/** `(a or b or …)` das condições dadas (`undefined` fica de fora); nenhuma = `false`. */
function ou(...condicoes: (Sql | undefined)[]): Sql {
  const dadas = condicoes.filter((c) => c !== undefined);
  return dadas.length === 0 ? new Sql(["false"], []) : montar`(${juntar(dadas, montar` or `)})`;
}

export const sql = Object.assign(montar, {
  e,
  ou,
  juntar,
  literal,
  identificador,
  json,
  vazio: (): Sql => new Sql([""], []),
});

/** `Sql` → `{ text, values }` do `pg`, numerando os parâmetros na ordem em que aparecem. */
export function compilar(consulta: Sql): SqlCompilado {
  const values: unknown[] = [];
  const percorrer = (trecho: Sql): string => {
    let texto = trecho.textos[0] ?? "";
    trecho.valores.forEach((valor, i) => {
      if (valor instanceof Sql) {
        texto += percorrer(valor);
      } else {
        values.push(valor === undefined ? null : valor);
        texto += `$${values.length}`;
      }
      texto += trecho.textos[i + 1] ?? "";
    });
    return texto;
  };
  return { text: percorrer(consulta), values };
}
