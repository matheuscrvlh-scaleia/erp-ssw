import pg from "pg";

import { type ValorJson } from "../transformacoes/json";
import {
  chaveDaTupla,
  type Destino,
  type LoteLido,
  type Origem,
  type PedidoDeGravacao,
  type PedidoDeLeitura,
  textoDoValor,
} from "./infra";
import { colunaSql, identificador } from "./metadados";
import { ALIAS_DA_CHAVE, montarLoteDeOrigem, montarSql, parametrosDosFiltros } from "./sql";
import { type Filtros, type ParametroNomeado } from "./tipos";

/** Postgres aceita até 65535 parâmetros por comando; folga para não encostar no limite. */
const PARAMETROS_POR_COMANDO = 60_000;

/**
 * Datas, instantes e JSON voltam como o texto do Postgres: nada passa por `Date` do JS (que
 * perderia os microssegundos e poderia trocar o dia pelo fuso) nem por `JSON.parse` (que perde
 * precisão de número grande). `numeric` e `bigint` já são texto no driver.
 */
const TIPOS_EM_TEXTO = [
  pg.types.builtins.DATE,
  pg.types.builtins.TIMESTAMP,
  pg.types.builtins.TIMESTAMPTZ,
  pg.types.builtins.JSON,
  pg.types.builtins.JSONB,
];

function lerComoTexto(): void {
  for (const oid of TIPOS_EM_TEXTO) pg.types.setTypeParser(oid, (valor: string) => valor);
}

export function criarPool(url: string, nomeAplicacao: string): pg.Pool {
  lerComoTexto();
  return new pg.Pool({
    connectionString: url,
    max: 2,
    application_name: nomeAplicacao,
    // Sessão em UTC: o texto dos instantes sai igual na origem e no destino.
    options: "-c TimeZone=UTC",
  });
}

function separarChave<V>(
  linha: Readonly<Record<string, V>>,
  quantidade: number,
): { dados: Record<string, V>; chave: string[] } {
  const nomes = Array.from({ length: quantidade }, (_, i) => `${ALIAS_DA_CHAVE}${String(i)}`);
  const dados = Object.fromEntries(
    Object.entries(linha).filter(([coluna]) => !nomes.includes(coluna)),
  );
  return { dados, chave: nomes.map((nome) => String(linha[nome])) };
}

async function consultar<R extends object>(
  pool: pg.Pool,
  texto: string,
  parametros: Readonly<Record<string, ParametroNomeado>>,
): Promise<R[]> {
  const sql = montarSql(texto, parametros);
  const resultado = await pool.query<R>(sql.texto, sql.parametros);
  return resultado.rows;
}

export function origemPostgres(pool: pg.Pool): Origem {
  return {
    consultar: (texto, parametros) => consultar(pool, texto, parametros),
    lerLote: async <O extends object>(
      consulta: Parameters<Origem["lerLote"]>[0],
      filtros: Filtros,
      apos: readonly string[] | null,
      limite: number,
    ): Promise<LoteLido<O>> => {
      const sql = montarLoteDeOrigem(consulta, filtros, apos, limite);
      const resultado = await pool.query<O & Record<string, unknown>>(sql.texto, sql.parametros);
      const ultima = resultado.rows.at(-1);
      const ultimaChave = ultima ? separarChave(ultima, consulta.chave.length).chave : null;
      return { linhas: resultado.rows, ultimaChave };
    },
  };
}

function valorParaGravar(valor: ValorJson, json: boolean): unknown {
  if (json && valor !== null && typeof valor !== "string") return JSON.stringify(valor);
  return valor;
}

function comandosDeGravacao(pedido: PedidoDeGravacao): { texto: string; parametros: unknown[] }[] {
  const { meta } = pedido;
  const propriedades = Object.keys(pedido.linhas[0] ?? {});
  const colunas = propriedades.map((p) => colunaSql(meta, p));
  const nomes = colunas.map((c) => identificador(c.nome));
  const alvo = pedido.conflito.map((p) => identificador(colunaSql(meta, p).nome));
  const atualizaveis = nomes.filter((n) => !alvo.includes(n));
  const aoConflitar =
    pedido.aoConflitar === "ignorar" || atualizaveis.length === 0
      ? "do nothing"
      : `do update set ${atualizaveis.map((n) => `${n} = excluded.${n}`).join(", ")}`;
  const porComando = Math.max(1, Math.floor(PARAMETROS_POR_COMANDO / colunas.length));

  const comandos: { texto: string; parametros: unknown[] }[] = [];
  for (let inicio = 0; inicio < pedido.linhas.length; inicio += porComando) {
    const parametros: unknown[] = [];
    const tuplas = pedido.linhas.slice(inicio, inicio + porComando).map((linha) => {
      const chaves = Object.keys(linha);
      if (chaves.length !== propriedades.length) throw new Error("Linhas com colunas diferentes.");
      const marcadores = propriedades.map((p, i) => {
        const coluna = colunas[i];
        if (!coluna || !(p in linha)) throw new Error(`Linha sem a coluna ${p}.`);
        parametros.push(valorParaGravar(linha[p] ?? null, coluna.json));
        return `$${String(parametros.length)}::${coluna.tipo}`;
      });
      return `(${marcadores.join(", ")})`;
    });
    comandos.push({
      texto: [
        `insert into ${meta.nomeSql} (${nomes.join(", ")})`,
        pedido.sobreporIdentidade ? "overriding system value" : "",
        `values ${tuplas.join(", ")}`,
        `on conflict (${alvo.join(", ")}) ${aoConflitar}`,
      ]
        .filter((t) => t !== "")
        .join("\n"),
      parametros,
    });
  }
  return comandos;
}

export function destinoPostgres(pool: pg.Pool): Destino {
  return {
    consultar: (texto, parametros) => consultar(pool, texto, parametros),

    executar: async (texto, parametros) => {
      const sql = montarSql(texto, parametros);
      const resultado = await pool.query(sql.texto, sql.parametros);
      return resultado.rowCount ?? 0;
    },

    gravar: async (pedido) => {
      if (pedido.linhas.length === 0) return;
      const cliente = await pool.connect();
      try {
        await cliente.query("begin");
        for (const comando of comandosDeGravacao(pedido)) {
          await cliente.query(comando.texto, comando.parametros);
        }
        await cliente.query("commit");
      } catch (erro) {
        await cliente.query("rollback");
        throw erro;
      } finally {
        cliente.release();
      }
    },

    existentes: async (referencia, tuplas) => {
      const colunas = referencia.colunasDestino.map(identificador);
      const parametros: unknown[] = referencia.colunasDestino.map((_, i) =>
        tuplas.map((t) => textoDoValor(t[i])),
      );
      const arrays = referencia.tipos.map((tipo, i) => `$${String(i + 1)}::${tipo}[]`);
      const texto = `select distinct ${colunas.map((c) => `${c}::text as ${c}`).join(", ")}
        from ${referencia.tabela}
        where (${colunas.join(", ")}) in (select * from unnest(${arrays.join(", ")}))`;
      const resultado = await pool.query<Record<string, string | null>>(texto, parametros);
      return new Set(
        resultado.rows.map((linha) =>
          chaveDaTupla(referencia.colunasDestino.map((c) => linha[c] ?? null)),
        ),
      );
    },

    lerLote: async (pedido: PedidoDeLeitura, filtros, apos, limite) => {
      const { meta } = pedido;
      const valores: Record<string, ParametroNomeado> = {
        ...parametrosDosFiltros(filtros),
        limite: { valor: limite, tipo: "integer" },
      };
      const chave = pedido.chave.map((p) => colunaSql(meta, p));
      const tuplaChave = `(${chave.map((c) => identificador(c.nome)).join(", ")})`;
      const condicoes = [`(${pedido.escopo})`];
      if (apos !== null) {
        const marcadores = chave.map((c, i) => {
          valores[`k${String(i)}`] = { valor: apos[i], tipo: c.tipo };
          return `@k${String(i)}`;
        });
        condicoes.push(`${tuplaChave} > (${marcadores.join(", ")})`);
      }
      const selecao = pedido.colunas
        .map((p) => `${identificador(colunaSql(meta, p).nome)} as ${identificador(p)}`)
        .concat(
          chave.map((c, i) => `${identificador(c.nome)}::text as ${ALIAS_DA_CHAVE}${String(i)}`),
        );
      const sql = montarSql(
        `select ${selecao.join(", ")} from ${meta.nomeSql}
         where ${condicoes.join(" and ")}
         order by ${chave.map((c) => identificador(c.nome)).join(", ")}
         limit @limite`,
        valores,
      );
      const resultado = await pool.query<Record<string, ValorJson>>(sql.texto, sql.parametros);
      let ultimaChave: string[] | null = null;
      const linhas = resultado.rows.map((linha) => {
        const { dados, chave: lida } = separarChave(linha, chave.length);
        ultimaChave = lida;
        const saida: Record<string, ValorJson> = {};
        for (const p of pedido.colunas) saida[p] = dados[p] ?? null;
        return saida;
      });
      return { linhas, ultimaChave };
    },
  };
}
