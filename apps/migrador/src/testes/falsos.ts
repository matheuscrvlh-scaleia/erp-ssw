/**
 * Postgres falso para os testes: origem e destino em memória com a mesma interface do real
 * (`motor/postgres.ts`). Não interpreta SQL: a origem pagina pelas colunas da chave e o destino
 * faz upsert pela chave de conflito.
 */
import {
  chaveDaTupla,
  type Destino,
  type LoteLido,
  type Origem,
  type PedidoDeGravacao,
} from "../motor/infra";
import { type ConsultaDeOrigem } from "../motor/tipos";
import { type ValorJson } from "../transformacoes/json";

type LinhaFalsa = object;

function campo(linha: LinhaFalsa, nome: string): unknown {
  const descritor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(linha, nome);
  return descritor?.value;
}

function coluna(expressao: string): string {
  return expressao.replace(/^\w+\./, "");
}

function comparar(a: readonly string[], b: readonly string[]): number {
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? "";
    const y = b[i] ?? "";
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function chaveDe(linha: LinhaFalsa, colunas: readonly string[]): string[] {
  return colunas.map((c) => {
    const valor = campo(linha, c);
    return typeof valor === "string" || typeof valor === "number" ? String(valor) : "";
  });
}

export interface OrigemFalsa extends Origem {
  leituras: number;
}

/** `tabelas`: linhas por `consulta.de`; `respostas`: resposta de `consultar` por trecho do SQL. */
export function origemFalsa(
  tabelas: Record<string, LinhaFalsa[]>,
  respostas: Record<string, object[]> = {},
): OrigemFalsa {
  const origem: OrigemFalsa = {
    leituras: 0,
    consultar: <R extends object>(texto: string): Promise<R[]> => {
      const achada = Object.entries(respostas).find(([trecho]) => texto.includes(trecho));
      const linhas: R[] = [];
      for (const linha of achada?.[1] ?? []) {
        if (ehDoTipo<R>(linha)) linhas.push(linha);
      }
      return Promise.resolve(linhas);
    },
    lerLote: <O extends object>(
      consulta: ConsultaDeOrigem,
      _filtros: unknown,
      apos: readonly string[] | null,
      limite: number,
    ): Promise<LoteLido<O>> => {
      origem.leituras += 1;
      const colunas = consulta.chave.map((c) => coluna(c.expressao));
      const ordenadas = [...(tabelas[consulta.de] ?? [])].sort((a, b) =>
        comparar(chaveDe(a, colunas), chaveDe(b, colunas)),
      );
      const pagina = ordenadas
        .filter((l) => apos === null || comparar(chaveDe(l, colunas), apos) > 0)
        .slice(0, limite);
      const ultima = pagina.at(-1);
      const linhas: O[] = [];
      for (const linha of pagina) if (ehDoTipo<O>(linha)) linhas.push(linha);
      return Promise.resolve({ linhas, ultimaChave: ultima ? chaveDe(ultima, colunas) : null });
    },
  };
  return origem;
}

/**
 * O falso devolve o que o teste pôs: a forma é responsabilidade do teste. (`_tipo` só nomeia o
 * tipo esperado.)
 */
function ehDoTipo<R extends object>(valor: object, _tipo?: R): valor is R {
  return typeof valor === "object";
}

export interface DestinoFalso extends Destino {
  gravacoes: PedidoDeGravacao[];
  tabelas: Map<string, Map<string, Record<string, ValorJson>>>;
  /** Tuplas (`chaveDaTupla`) existentes por tabela referenciada. */
  referencias: Map<string, Set<string>>;
  executados: string[];
}

export function destinoFalso(referencias: Record<string, readonly string[][]> = {}): DestinoFalso {
  const destino: DestinoFalso = {
    gravacoes: [],
    tabelas: new Map(),
    referencias: new Map(
      Object.entries(referencias).map(([tabela, tuplas]) => [
        tabela,
        new Set(tuplas.map((t) => chaveDaTupla(t))),
      ]),
    ),
    executados: [],
    consultar: () => Promise.resolve([]),
    executar: (texto) => {
      destino.executados.push(texto);
      return Promise.resolve(1);
    },
    gravar: (pedido) => {
      destino.gravacoes.push(pedido);
      const tabela =
        destino.tabelas.get(pedido.meta.nomeSql) ?? new Map<string, Record<string, ValorJson>>();
      for (const linha of pedido.linhas) {
        const chave = chaveDaTupla(pedido.conflito.map((c) => linha[c] ?? null));
        if (pedido.aoConflitar === "ignorar" && tabela.has(chave)) continue;
        tabela.set(chave, { ...linha });
      }
      destino.tabelas.set(pedido.meta.nomeSql, tabela);
      return Promise.resolve();
    },
    existentes: (referencia, tuplas) => {
      const existentes = destino.referencias.get(referencia.tabela) ?? new Set<string>();
      return Promise.resolve(
        new Set(tuplas.map((t) => chaveDaTupla(t)).filter((t) => existentes.has(t))),
      );
    },
    lerLote: (pedido, _filtros, apos, limite) => {
      const linhas = [...(destino.tabelas.get(pedido.meta.nomeSql)?.values() ?? [])]
        .sort((a, b) => comparar(chaveDe(a, pedido.chave), chaveDe(b, pedido.chave)))
        .filter((l) => apos === null || comparar(chaveDe(l, pedido.chave), apos) > 0)
        .slice(0, limite);
      const ultima = linhas.at(-1);
      return Promise.resolve({
        linhas: linhas.map((l) => Object.fromEntries(pedido.colunas.map((c) => [c, l[c] ?? null]))),
        ultimaChave: ultima ? chaveDe(ultima, pedido.chave) : null,
      });
    },
  };
  return destino;
}

export const logMudo = { info: () => undefined, warn: () => undefined, error: () => undefined };
