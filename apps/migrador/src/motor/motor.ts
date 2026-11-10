import { type PgTable } from "drizzle-orm/pg-core";

import { ErroDeConversao } from "../transformacoes/erros";
import { type ValorJson } from "../transformacoes/json";
import { SomaDeConferencia } from "./checksum";
import {
  type Contagem,
  contar,
  type ErroRegistrado,
  type EstadoDaTabela,
  estadoInicialDaTabela,
} from "./estado";
import { chaveDaTupla, type Destino, type Infra, type Log, type LoteLido } from "./infra";
import { type MetadadosDaTabela, metadadosDe } from "./metadados";
import { type DefinicaoDeTabela, type Filtros, type LinhaDestino, type Referencia } from "./tipos";

export interface OpcoesDoMotor {
  tamanhoDoLote: number;
  /** `--dry-run`: lê e transforma tudo, não grava nem salva checkpoint. */
  simulacao: boolean;
}

interface LinhaProcessada<T extends PgTable> {
  chave: string;
  linha: LinhaDestino<T>;
  /** Coluna de identidade preservada (fora do tipo de inserção do Drizzle). */
  identidade: Record<string, ValorJson>;
}

interface LoteProcessado<T extends PgTable> {
  linhas: LinhaProcessada<T>[];
  descartes: Record<string, Contagem>;
  ajustes: Record<string, Contagem>;
  erros: ErroRegistrado[];
}

function processarLote<O extends object, T extends PgTable, A>(
  def: DefinicaoDeTabela<O, T, A>,
  linhas: readonly O[],
  apoio: A,
  filtros: Filtros,
): LoteProcessado<T> {
  const lote: LoteProcessado<T> = { linhas: [], descartes: {}, ajustes: {}, erros: [] };
  for (const origem of linhas) {
    const chave = def.chaveDaLinha(origem);
    try {
      const resultado = def.transformar(origem, apoio, filtros);
      if (resultado.tipo === "descartar") {
        contar(lote.descartes, resultado.motivo, chave);
        continue;
      }
      for (const ajuste of resultado.ajustes) contar(lote.ajustes, ajuste, chave);
      const identidade: Record<string, ValorJson> = def.identidade
        ? { [def.identidade.coluna]: def.identidade.valor(origem) }
        : {};
      lote.linhas.push({ chave, linha: resultado.linha, identidade });
    } catch (erro) {
      if (!(erro instanceof ErroDeConversao)) throw erro;
      lote.erros.push({ chave, coluna: erro.coluna, valor: erro.valor, motivo: erro.message });
    }
  }
  return lote;
}

function valoresDaReferencia<T extends PgTable>(
  linha: LinhaDestino<T>,
  referencia: Referencia<T>,
): ValorJson[] | null {
  const valores = referencia.colunas.map((coluna) => linha[coluna]);
  return valores.some((v) => v === null) ? null : valores;
}

/** Confere as FKs do lote no destino e aplica a política de cada uma (descartar ou anular). */
async function ajustarReferencias<T extends PgTable>(
  referencias: readonly Referencia<T>[],
  destino: Destino,
  lote: LoteProcessado<T>,
): Promise<void> {
  for (const referencia of referencias) {
    const tuplas = new Map<string, ValorJson[]>();
    for (const { linha } of lote.linhas) {
      const valores = valoresDaReferencia(linha, referencia);
      if (valores) tuplas.set(chaveDaTupla(valores), valores);
    }
    if (tuplas.size === 0) continue;
    const existentes = await destino.existentes(referencia, [...tuplas.values()]);
    const mantidas: LinhaProcessada<T>[] = [];
    for (const item of lote.linhas) {
      const valores = valoresDaReferencia(item.linha, referencia);
      if (valores === null || existentes.has(chaveDaTupla(valores))) {
        mantidas.push(item);
      } else if ("descartar" in referencia.seAusente) {
        contar(lote.descartes, referencia.seAusente.descartar, item.chave);
      } else {
        item.linha[referencia.seAusente.anular] = null;
        contar(lote.ajustes, referencia.seAusente.motivo, item.chave);
        mantidas.push(item);
      }
    }
    lote.linhas = mantidas;
  }
}

function somarContagens(destino: Record<string, Contagem>, origem: Record<string, Contagem>) {
  for (const [motivo, { quantidade, exemplos }] of Object.entries(origem)) {
    const atual = destino[motivo] ?? { quantidade: 0, exemplos: [] };
    atual.quantidade += quantidade;
    atual.exemplos.push(...exemplos.slice(0, Math.max(0, 1000 - atual.exemplos.length)));
    destino[motivo] = atual;
  }
}

function paraGravacao<T extends PgTable>(
  linhas: readonly LinhaProcessada<T>[],
): Readonly<Record<string, ValorJson>>[] {
  return linhas.map(({ linha, identidade }) => ({ ...identidade, ...linha }));
}

/**
 * Migra uma tabela: lotes por keyset, transação por lote, checkpoint depois de cada commit.
 * Valor que não cabe no destino para a tabela (o lote não é gravado) e vai para o relatório.
 * Na simulação nada é gravado e a leitura segue até o fim, juntando todos os erros.
 */
export async function migrarTabela<O extends object, T extends PgTable, A>(
  def: DefinicaoDeTabela<O, T, A>,
  infra: Infra,
  filtros: Filtros,
  opcoes: OpcoesDoMotor,
  anterior: EstadoDaTabela | undefined,
  salvar: (estado: EstadoDaTabela) => Promise<void>,
  log: Log,
): Promise<EstadoDaTabela> {
  if (anterior?.status === "concluida") return anterior;
  const estado: EstadoDaTabela =
    anterior && !opcoes.simulacao
      ? { ...anterior, status: "em_andamento", erros: [] }
      : estadoInicialDaTabela();
  const meta = metadadosDe(def.tabela);
  const apoio = await def.preparar(infra, filtros);

  for (;;) {
    const lido = await infra.origem.lerLote<O>(
      def.consulta,
      filtros,
      estado.ultimaChave,
      opcoes.tamanhoDoLote,
    );
    if (lido.linhas.length === 0) break;
    const lote = processarLote(def, lido.linhas, apoio, filtros);
    if (!opcoes.simulacao) await ajustarReferencias(def.referencias, infra.destino, lote);

    if (lote.erros.length > 0) {
      estado.erros.push(...lote.erros);
      if (!opcoes.simulacao) {
        estado.status = "falhou";
        await salvar(estado);
        log.error({ tabela: def.nome, erros: lote.erros.length }, "valor fora do destino; parei");
        return estado;
      }
    }
    if (!opcoes.simulacao && lote.linhas.length > 0) {
      await infra.destino.gravar({
        meta,
        linhas: paraGravacao(lote.linhas),
        conflito: def.conflito,
        aoConflitar: def.aoConflitar,
        sobreporIdentidade: def.identidade !== undefined,
      });
    }
    estado.lidas += lido.linhas.length;
    estado.migradas += lote.linhas.length;
    somarContagens(estado.descartes, lote.descartes);
    somarContagens(estado.ajustes, lote.ajustes);
    estado.ultimaChave = lido.ultimaChave;
    if (!opcoes.simulacao) await salvar(estado);
    log.info({ tabela: def.nome, lidas: estado.lidas, migradas: estado.migradas }, "lote");
    if (lido.linhas.length < opcoes.tamanhoDoLote) break;
  }

  estado.status = estado.erros.length > 0 ? "falhou" : "concluida";
  if (!opcoes.simulacao) await salvar(estado);
  return estado;
}

export interface Conferencia {
  origem: number;
  destino: number;
  checksumOrigem: string;
  checksumDestino: string;
  /** Linhas da origem que não converteram (deveriam ter parado a migração). */
  errosDeConversao: number;
  confere: boolean;
}

function colunasConferidas(
  foraDaConferencia: readonly string[] | undefined,
  meta: MetadadosDaTabela,
): string[] {
  const fora = new Set<string>(foraDaConferencia ?? []);
  return [...meta.colunas.entries()]
    .filter(([propriedade, coluna]) => !coluna.identidade && !fora.has(propriedade))
    .map(([propriedade]) => propriedade)
    .sort();
}

function selecionar(
  linha: Readonly<Record<string, ValorJson>>,
  colunas: readonly string[],
): Record<string, ValorJson> {
  const saida: Record<string, ValorJson> = {};
  for (const coluna of colunas) {
    if (!(coluna in linha)) throw new Error(`Linha sem a coluna ${coluna}.`);
    saida[coluna] = linha[coluna] ?? null;
  }
  return saida;
}

/**
 * Conferência origem × destino: refaz a leitura e a transformação da origem (sem gravar) e lê
 * o destino de volta no escopo da definição. Mesma quantidade e mesmo checksum = o destino tem
 * exatamente o que a regra de transformação manda.
 */
export async function conferirTabela<O extends object, T extends PgTable, A>(
  def: DefinicaoDeTabela<O, T, A>,
  infra: Infra,
  filtros: Filtros,
  tamanhoDoLote: number,
): Promise<Conferencia> {
  const meta = metadadosDe(def.tabela);
  const colunas = colunasConferidas(def.foraDaConferencia, meta);
  const json = new Set(colunas.filter((c) => meta.colunas.get(c)?.json));
  const apoio = await def.preparar(infra, filtros);
  const esperado = new SomaDeConferencia();
  let errosDeConversao = 0;

  let apos: string[] | null = null;
  for (;;) {
    const lido: LoteLido<O> = await infra.origem.lerLote<O>(
      def.consulta,
      filtros,
      apos,
      tamanhoDoLote,
    );
    if (lido.linhas.length === 0) break;
    const lote = processarLote(def, lido.linhas, apoio, filtros);
    await ajustarReferencias(def.referencias, infra.destino, lote);
    errosDeConversao += lote.erros.length;
    for (const { linha } of lote.linhas) esperado.adicionar(selecionar(linha, colunas), json);
    apos = lido.ultimaChave;
    if (lido.linhas.length < tamanhoDoLote) break;
  }

  const encontrado = new SomaDeConferencia();
  const pedido = {
    meta,
    colunas,
    chave: def.chaveDestino ?? def.conflito,
    escopo: def.escopoDestino,
  };
  apos = null;
  for (;;) {
    const lido = await infra.destino.lerLote(pedido, filtros, apos, tamanhoDoLote);
    if (lido.linhas.length === 0) break;
    for (const linha of lido.linhas) encontrado.adicionar(selecionar(linha, colunas), json);
    apos = lido.ultimaChave;
    if (lido.linhas.length < tamanhoDoLote) break;
  }

  return {
    origem: esperado.quantidade,
    destino: encontrado.quantidade,
    checksumOrigem: esperado.valor,
    checksumDestino: encontrado.valor,
    errosDeConversao,
    confere:
      errosDeConversao === 0 &&
      esperado.quantidade === encontrado.quantidade &&
      esperado.valor === encontrado.valor,
  };
}
