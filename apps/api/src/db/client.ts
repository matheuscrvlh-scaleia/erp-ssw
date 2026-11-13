import { Pool, type PoolClient, types } from "pg";

import { compilar, type Sql, sql } from "./sql";

/** Linha crua do `pg`: coluna → valor. */
export type Linha = Record<string, unknown>;

/**
 * Executor dentro da transação com contexto: é o que repositórios recebem. O tipo das linhas é o
 * que o SQL devolve (apelidos `as "campo"`); quem escreve a consulta garante o formato.
 */
export interface Transacao {
  consultar<T extends object = Linha>(consulta: Sql): Promise<T[]>;
  /** Comando sem linhas de volta: devolve quantas linhas foram afetadas. */
  executar(consulta: Sql): Promise<number>;
}

export interface Banco {
  /** BEGIN, `fn`, COMMIT; ROLLBACK em erro. */
  transacao<T>(fn: (tx: Transacao) => Promise<T>): Promise<T>;
}

interface ConfigBanco {
  url: string;
  maxConexoes: number;
  /** Teto de cada consulta; estourou, o Postgres cancela e a API pede para filtrar mais. */
  timeoutConsultaMs: number;
  nomeAplicacao: string;
}

interface ConexaoBanco {
  banco: Banco;
  verificar: () => Promise<void>;
  encerrar: () => Promise<void>;
}

/**
 * Data, hora e intervalo chegam como o texto do Postgres (`2026-01-31`,
 * `2026-01-31 12:00:00+00`), sem conversão para `Date` no fuso do processo: o dia é sempre o do
 * fuso da empresa, decidido no SQL. Quem precisa de `Date` converte (`comInstantes`).
 */
const COMO_TEXTO = new Set<number>([
  types.builtins.DATE,
  types.builtins.TIMESTAMP,
  types.builtins.TIMESTAMPTZ,
  types.builtins.INTERVAL,
  1182, // date[]
  1115, // timestamp[]
  1185, // timestamptz[]
  1187, // interval[]
  1231, // numeric[]
]);
const parserPadrao = types.getTypeParser.bind(types) as (
  oid: number,
  formato?: "text" | "binary",
) => (valor: string) => unknown;
const tiposDoBanco = {
  getTypeParser: ((oid: number, formato?: "text" | "binary") =>
    COMO_TEXTO.has(oid)
      ? (valor: string) => valor
      : parserPadrao(oid, formato)) as typeof types.getTypeParser,
};

function executor(cliente: PoolClient): Transacao {
  const rodar = (consulta: Sql) => cliente.query({ ...compilar(consulta), types: tiposDoBanco });
  return {
    consultar: async <T extends object>(consulta: Sql) => (await rodar(consulta)).rows as T[],
    executar: async (consulta) => (await rodar(consulta)).rowCount ?? 0,
  };
}

export function conectarBanco(config: ConfigBanco): ConexaoBanco {
  const pool = new Pool({
    connectionString: config.url,
    max: config.maxConexoes,
    application_name: config.nomeAplicacao,
    // Teto também fora das transações com contexto (ex.: readiness).
    statement_timeout: config.timeoutConsultaMs,
    // Conexão nova com o banco custa ~0,5 s (TLS + autenticação no pooler). O padrão do pg fecha a
    // conexão parada há 10 s, e aí o primeiro pedido depois de uma pausa (quase sempre o login)
    // pagava isso. Parada por até 10 min ela continua aberta, e o keepalive a mantém de pé.
    idleTimeoutMillis: 10 * 60_000,
    keepAlive: true,
  });
  const banco: Banco = {
    transacao: async (fn) => {
      const cliente = await pool.connect();
      try {
        await cliente.query("begin");
        const resultado = await fn(executor(cliente));
        await cliente.query("commit");
        return resultado;
      } catch (erro) {
        await cliente.query("rollback").catch(() => undefined);
        throw erro;
      } finally {
        cliente.release();
      }
    },
  };
  return {
    banco,
    verificar: async () => {
      await pool.query("select 1");
    },
    encerrar: () => pool.end(),
  };
}

/** `timestamptz` como chega do banco (texto) → `Date`. */
export function instanteDoBanco(valor: string): Date;
export function instanteDoBanco(valor: string | null): Date | null;
export function instanteDoBanco(valor: string | null): Date | null {
  return valor === null ? null : new Date(valor);
}

/**
 * Linhas com os campos de instante convertidos para `Date` (o `pg` os entrega em texto). O tipo
 * `T` é o formato final da linha, que a consulta garante com os apelidos `as "campo"`.
 */
export function comInstantes<T extends object>(
  linhas: readonly Linha[],
  campos: readonly (keyof T & string)[],
): T[] {
  return linhas.map((linha) => {
    const saida: Linha = { ...linha };
    for (const campo of campos) {
      const valor = saida[campo];
      saida[campo] = typeof valor === "string" ? new Date(valor) : null;
    }
    return saida as T;
  });
}

/**
 * Quem está pedindo. Vira `SET LOCAL` na transação e é o que as políticas RLS leem: sem empresa,
 * nenhuma linha de dado de empresa aparece.
 */
export interface ContextoBanco {
  empresaId: string | null;
  usuarioId: string | null;
  plataforma: boolean;
  /**
   * Só a rota pública do ranking: SHA-256 do token do link. A política
   * `equipes_token_publico_select` deixa ver a equipe desse link sem empresa na sessão.
   */
  tokenPublicoHash?: string;
}

export const CONTEXTO_VAZIO: ContextoBanco = {
  empresaId: null,
  usuarioId: null,
  plataforma: false,
};

/** `set_config(..., true)` = `SET LOCAL`, mas com os valores como parâmetros (nada concatenado). */
function sqlDoContexto(contexto: ContextoBanco): Sql {
  const token =
    contexto.tokenPublicoHash === undefined
      ? sql.vazio()
      : sql`, set_config('app.token_publico_hash', ${contexto.tokenPublicoHash}, true)`;
  return sql`select
    set_config('app.empresa_id', ${contexto.empresaId ?? ""}, true),
    set_config('app.usuario_id', ${contexto.usuarioId ?? ""}, true),
    set_config('app.plataforma', ${contexto.plataforma ? "on" : "off"}, true)${token}`;
}

/**
 * Abre uma transação, grava o contexto (`sqlDoContexto`) e roda `fn` nela. Commit ao terminar, rollback
 * em erro. O contexto some no fim da transação, então a conexão volta limpa ao pool.
 */
export async function comContexto<T>(
  banco: Banco,
  contexto: ContextoBanco,
  fn: (tx: Transacao) => Promise<T>,
): Promise<T> {
  return banco.transacao(async (tx) => {
    await tx.executar(sqlDoContexto(contexto));
    return fn(tx);
  });
}

/** Código do Postgres para consulta cancelada por `statement_timeout`. */
const CONSULTA_CANCELADA = "57014";

/** Código do Postgres para violação de chave única. */
const VIOLACAO_DE_UNICIDADE = "23505";

function temCodigo(erro: unknown, codigo: string): boolean {
  if (typeof erro !== "object" || erro === null) return false;
  if ("code" in erro && erro.code === codigo) return true;
  return "cause" in erro && temCodigo(erro.cause, codigo);
}

export function ehTempoEsgotado(erro: unknown): boolean {
  return temCodigo(erro, CONSULTA_CANCELADA);
}

/** Corrida entre duas gravações iguais: a checagem do caso de uso passou nas duas. */
export function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return temCodigo(erro, VIOLACAO_DE_UNICIDADE);
}
