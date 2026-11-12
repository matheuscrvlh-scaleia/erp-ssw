/**
 * Ranking operacional por parceiro (pagador) ou por cidade de destino.
 * origem: ranking_operacional (sistema atual)
 *
 * A consulta agrupa os CT-e do período em "baldes" (mesma chave e mesmas características que
 * decidem a classificação) e devolve só as contagens e somas de cada balde. A classificação
 * (entregue, finalizado sem entrega, em aberto, atrasada) e o SLA são decididos aqui.
 */

import { CODIGOS_ENTREGA } from "./nucleo/codigos";

export type GrupoRanking = "pagador" | "cidade";

/** Situação da previsão de entrega em relação a hoje. */
export type SituacaoPrevista = "sem_previsao" | "vencida" | "no_prazo";

/** CT-e com as mesmas características dentro de uma chave do ranking. */
export interface BaldeRanking {
  chave: string;
  temDataEntrega: boolean;
  /** Dígitos do código da ocorrência efetiva como número; nulo = sem código. */
  codigoEfetivo: number | null;
  noPrazo: boolean | null;
  responsabilidadeCliente: boolean | null;
  prevista: SituacaoPrevista;
  quantidade: number;
  /** Somas em unidades inteiras: peso em gramas, frete em centavos. */
  pesoGramas: number;
  volumes: number;
  freteCentavos: number;
}

export interface RotuloRanking {
  chave: string;
  rotulo: string | null;
  sub: string | null;
}

interface LinhaRanking {
  chave: string;
  rotulo: string | null;
  sub: string | null;
  totalCtes: number;
  entregue: number;
  noPrazo: number;
  foraPrazo: number;
  foraCliente: number;
  foraTransp: number;
  /** Fração 0–1: (entregue − fora do prazo por culpa da transportadora) ÷ entregue. */
  slaPct: number | null;
  aEntregar: number;
  atrasadas: number;
  noPrazoAberto: number;
  peso: number;
  volumes: number;
  frete: number;
}

function entregue(b: BaldeRanking): boolean {
  return b.temDataEntrega || (b.codigoEfetivo !== null && CODIGOS_ENTREGA.has(b.codigoEfetivo));
}

/** origem: _is_finalizado_sem_entrega (variante `nc NOT IN (1,18,67)` do ranking) */
function finalizadoSemEntrega(b: BaldeRanking, codigosBaixa: ReadonlySet<number>): boolean {
  return (
    !b.temDataEntrega &&
    b.codigoEfetivo !== null &&
    !CODIGOS_ENTREGA.has(b.codigoEfetivo) &&
    codigosBaixa.has(b.codigoEfetivo)
  );
}

function linhaVazia(chave: string, rotulo: RotuloRanking | undefined): LinhaRanking {
  return {
    chave,
    rotulo: rotulo?.rotulo ?? null,
    sub: rotulo?.sub ?? null,
    totalCtes: 0,
    entregue: 0,
    noPrazo: 0,
    foraPrazo: 0,
    foraCliente: 0,
    foraTransp: 0,
    slaPct: null,
    aEntregar: 0,
    atrasadas: 0,
    noPrazoAberto: 0,
    peso: 0,
    volumes: 0,
    frete: 0,
  };
}

/** SLA nulo vai para o fim; empate de SLA, quem tem mais CT-e primeiro. */
function compararLinhas(a: LinhaRanking, b: LinhaRanking): number {
  if (a.slaPct !== b.slaPct) {
    if (a.slaPct === null) return 1;
    if (b.slaPct === null) return -1;
    return b.slaPct - a.slaPct;
  }
  return b.totalCtes - a.totalCtes;
}

/**
 * Linhas do ranking a partir dos baldes. `codigosBaixa` = códigos do catálogo da empresa com
 * tipo BAIXA (Q22: cadastro da própria empresa).
 */
export function agregarRanking(
  baldes: readonly BaldeRanking[],
  rotulos: readonly RotuloRanking[],
  codigosBaixa: ReadonlySet<number>,
): LinhaRanking[] {
  const rotuloPorChave = new Map(rotulos.map((r) => [r.chave, r]));
  const somas = new Map<
    string,
    { linha: LinhaRanking; gramas: number; centavos: number; volumes: number }
  >();
  for (const b of baldes) {
    if (b.chave === "") continue;
    let soma = somas.get(b.chave);
    if (!soma) {
      soma = {
        linha: linhaVazia(b.chave, rotuloPorChave.get(b.chave)),
        gramas: 0,
        centavos: 0,
        volumes: 0,
      };
      somas.set(b.chave, soma);
    }
    const { linha } = soma;
    const n = b.quantidade;
    linha.totalCtes += n;
    soma.gramas += b.pesoGramas;
    soma.centavos += b.freteCentavos;
    soma.volumes += b.volumes;
    if (entregue(b)) {
      linha.entregue += n;
      if (b.noPrazo === true) linha.noPrazo += n;
      if (b.noPrazo === false) {
        linha.foraPrazo += n;
        if (b.responsabilidadeCliente === true) linha.foraCliente += n;
        else linha.foraTransp += n;
      }
    } else if (!finalizadoSemEntrega(b, codigosBaixa)) {
      linha.aEntregar += n;
      if (b.prevista === "vencida") linha.atrasadas += n;
      else linha.noPrazoAberto += n;
    }
  }
  return [...somas.values()]
    .map(({ linha, gramas, centavos, volumes }) => ({
      ...linha,
      slaPct: linha.entregue > 0 ? (linha.entregue - linha.foraTransp) / linha.entregue : null,
      peso: gramas / 1000,
      volumes,
      frete: centavos / 100,
    }))
    .sort(compararLinhas);
}

/** Decimal do Postgres (texto) em unidades inteiras: `"12.345"` com 3 casas → 12345. */
export function decimalEmUnidades(texto: string | null, casas: number): number {
  if (texto === null || texto === "") return 0;
  const negativo = texto.startsWith("-");
  const [inteira = "0", fracao = ""] = texto.replace("-", "").split(".");
  const unidades =
    Number(inteira) * 10 ** casas + Number(fracao.padEnd(casas, "0").slice(0, casas));
  return negativo ? -unidades : unidades;
}
