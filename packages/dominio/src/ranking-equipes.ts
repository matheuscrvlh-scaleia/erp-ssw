/**
 * Ranking de equipes por regras de bonificação: membros, regra vigente, cálculo por equipe e
 * posição no ranking do link público.
 * origem: ranking.functions.ts, calcular_bonificacao, calcular_bonificacao_lote,
 * get_ranking_publico_por_token (sistema atual)
 */
import { ErroDeNegocio } from "./erros";

type Criterio =
  "entregas_prazo" | "penalizante" | "meta_produtividade" | "piso_performance" | "livre";

/** Parâmetros como o editor grava: número quando o texto digitado é número, senão texto. */
type Parametros = Record<string, string | number>;

export interface CriterioDaRegra {
  criterio: Criterio;
  parametros: Parametros;
}

/** Totais da equipe no período (CT-e emitidos e atribuídos a ela). */
export interface TotaisDaEquipe {
  totalEntregas: number;
  entregasNoPrazo: number;
  penalizantes: number;
}

interface ItemDoCalculo {
  criterio: Criterio;
  label: string;
  detalhe: string;
  subtotal: number;
}

export interface CalculoDaEquipe extends TotaisDaEquipe {
  performance: number;
  pontos: number;
  valorCalculado: number;
  zeradoPorPiso: boolean;
  breakdown: ItemDoCalculo[];
}

const AJUDANTE_OCUPADO = (p: number) => `Ajudante ${p} já está ocupado nesta equipe.`;

/**
 * Posição do ajudante novo: a pedida (se livre) ou a primeira livre de 1 a 3. Motorista não
 * tem posição nem limite.
 * origem: addMembro (ranking.functions.ts)
 */
export function posicaoDoNovoMembro(
  papel: "motorista" | "ajudante",
  ocupadas: readonly number[],
  pedida: number | null,
): number | null {
  if (papel === "motorista") return null;
  const usadas = new Set(ocupadas);
  if (pedida !== null) {
    if (usadas.has(pedida)) throw new ErroDeNegocio("CONFLITO", AJUDANTE_OCUPADO(pedida));
    return pedida;
  }
  const livre = [1, 2, 3].find((p) => !usadas.has(p));
  if (livre === undefined) {
    throw new ErroDeNegocio("CONFLITO", "Esta equipe já tem 3 ajudantes ativos.");
  }
  return livre;
}

interface MembroOrdenavel {
  papel: "motorista" | "ajudante";
  posicao: number | null;
  nome: string;
}

/** Motorista primeiro; ajudantes pela posição (sem posição = 99); depois nome. */
export function compararMembros(a: MembroOrdenavel, b: MembroOrdenavel): number {
  const papel = Number(a.papel !== "motorista") - Number(b.papel !== "motorista");
  if (papel !== 0) return papel;
  const posicao = (a.posicao ?? 99) - (b.posicao ?? 99);
  if (posicao !== 0) return posicao;
  return a.nome.localeCompare(b.nome);
}

interface RegraComVigencia {
  id: string;
  ativo: boolean;
  vigenciaInicio: string;
  vigenciaFim: string | null;
}

/** Regra ativa que cobre parte do período; havendo várias, a de início de vigência mais recente. */
export function regraVigente<R extends RegraComVigencia>(
  regras: readonly R[],
  inicio: string,
  fim: string,
): R | null {
  const vigentes = regras.filter(
    (r) =>
      r.ativo && r.vigenciaInicio <= fim && (r.vigenciaFim === null || r.vigenciaFim >= inicio),
  );
  vigentes.sort((a, b) => b.vigenciaInicio.localeCompare(a.vigenciaInicio));
  return vigentes[0] ?? null;
}

function numero(valor: string | number | undefined): number {
  return Number(valor ?? 0);
}

/** `ROUND(x, 1)` do Postgres (meio para longe de zero), como texto com uma casa. */
function arredondar1(x: number): string {
  const escalado = Math.round(Math.abs(x) * 10 + 1e-9) / 10;
  return (x < 0 ? -escalado : escalado).toFixed(1);
}

function textoDoParametro(valor: string | number | undefined, padrao: string): string {
  return valor === undefined ? padrao : String(valor);
}

/**
 * Bonificação de uma equipe por uma regra. O piso de performance compara a performance em
 * percentual (95) com o número digitado (85) — hoje comparava a fração (0,95) e zerava sempre.
 * origem: calcular_bonificacao (sistema atual), com a correção do piso (Q47)
 */
export function calcularBonificacaoDaEquipe(
  totais: TotaisDaEquipe,
  criterios: readonly CriterioDaRegra[],
): CalculoDaEquipe {
  const { totalEntregas, entregasNoPrazo, penalizantes } = totais;
  const performance = totalEntregas > 0 ? 1 - penalizantes / totalEntregas : 1;
  const performancePct = Math.round(performance * 100 * 1e9) / 1e9;
  let valor = 0;
  const breakdown: ItemDoCalculo[] = criterios.map(({ criterio, parametros: p }) => {
    switch (criterio) {
      case "entregas_prazo": {
        const subtotal = entregasNoPrazo * numero(p["peso"]);
        valor += subtotal;
        return {
          criterio,
          label: "Entregas no prazo",
          detalhe: `${entregasNoPrazo} × R$${textoDoParametro(p["peso"], "0")}`,
          subtotal,
        };
      }
      case "penalizante": {
        const subtotal = -penalizantes * numero(p["valor"]);
        valor += subtotal;
        return {
          criterio,
          label: "Penalidades",
          detalhe: `${penalizantes} × -R$${textoDoParametro(p["valor"], "0")}`,
          subtotal,
        };
      }
      case "meta_produtividade": {
        const meta = Math.trunc(numero(p["meta_entregas"]));
        const atingiu = totalEntregas >= meta;
        const subtotal = atingiu ? numero(p["bonus_se_atingir"]) : 0;
        valor += subtotal;
        const metaTexto = textoDoParametro(p["meta_entregas"], "");
        return {
          criterio,
          label: "Meta de produtividade",
          detalhe: `Meta ${atingiu ? "atingida" : "não atingida"} (${totalEntregas}/${metaTexto})`,
          subtotal,
        };
      }
      case "piso_performance": {
        const piso = numero(p["performance_minima"]);
        const abaixo = performancePct < piso;
        const pct = arredondar1(performance * 100);
        return {
          criterio,
          label: "Piso de performance",
          detalhe: abaixo
            ? `Performance ${pct}% < piso ${textoDoParametro(p["performance_minima"], "")}%`
            : `Performance ${pct}% ≥ piso`,
          subtotal: 0,
        };
      }
      case "livre": {
        const subtotal = numero(p["valor"]);
        valor += subtotal;
        return {
          criterio,
          label: "Ajuste livre",
          detalhe: typeof p["nome"] === "string" ? p["nome"] : "Ajuste livre",
          subtotal,
        };
      }
    }
  });
  const zerado = criterios.some(
    (k) =>
      k.criterio === "piso_performance" &&
      performancePct < numero(k.parametros["performance_minima"]),
  );
  return {
    totalEntregas,
    entregasNoPrazo,
    penalizantes,
    performance,
    pontos: entregasNoPrazo - penalizantes,
    valorCalculado: zerado ? 0 : Math.max(valor, 0),
    zeradoPorPiso: zerado,
    breakdown,
  };
}

/** Maior valor primeiro; empate pelo nome (hoje a ordem do empate era indefinida). */
export function ranquearEquipes<E extends { nome: string; valorCalculado: number }>(
  equipes: readonly E[],
): E[] {
  return [...equipes].sort(
    (a, b) => b.valorCalculado - a.valorCalculado || a.nome.localeCompare(b.nome),
  );
}
