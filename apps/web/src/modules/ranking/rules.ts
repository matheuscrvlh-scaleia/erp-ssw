import { type EntradaDe } from "@erp/shared/contract";
import {
  type contratosRanking as c,
  type CriterioDeRegra,
  type LinhaDoRanking,
  type Regra,
} from "@erp/shared/contracts/ranking";

import { type StatusKpi } from "@/components/common/KpiCard";

import { ROTULO_DO_CRITERIO } from "./texts";

/**
 * Regras da tela do ranking operacional (cards, nível de cor, ordenação, filtro dos cards).
 * origem: RankingTabela.tsx (sistema atual)
 * Mais abaixo, o rascunho da regra de bonificação (tela de Regras).
 */

/** Fração do percentual configurado; sem valor (ou inválido), o padrão. */
function fracao(valor: string | undefined, padrao: number): number {
  const n = Number(valor);
  return valor === undefined || !Number.isFinite(n) ? padrao : n / 100;
}

/**
 * Meta e alerta amarelo do SLA, das configurações da empresa (`sla_meta_pct`,
 * `sla_alerta_amarelo_pct`); 95% e 90% enquanto não chegam.
 * origem: useSlaThresholds (sistema atual)
 */
export function limiaresDoSla(valores: Readonly<Record<string, string>> | undefined): {
  meta: number;
  alerta: number;
} {
  return {
    meta: fracao(valores?.["sla_meta_pct"], 0.95),
    alerta: fracao(valores?.["sla_alerta_amarelo_pct"], 0.9),
  };
}

export type ChaveDeOrdem =
  | "nome"
  | "totalCtes"
  | "entregue"
  | "noPrazo"
  | "foraPrazo"
  | "foraCliente"
  | "foraTransp"
  | "slaPct"
  | "aEntregar"
  | "atrasadas"
  | "peso"
  | "volumes"
  | "frete";

export type FiltroDoCard = "todos" | "na_meta" | "abaixo_meta";

export function nivelDoSla(sla: number | null, meta: number, alerta: number): StatusKpi | null {
  if (sla === null) return null;
  if (sla >= meta) return "bom";
  if (sla >= alerta) return "alerta";
  return "ruim";
}

/** SLA médio ponderado: (Σ entregue − Σ fora por culpa da transportadora) ÷ Σ entregue. */
export function kpisDoRanking(linhas: readonly LinhaDoRanking[], meta: number) {
  const totalCtes = linhas.reduce((s, r) => s + r.totalCtes, 0);
  const entregue = linhas.reduce((s, r) => s + r.entregue, 0);
  const foraTransp = linhas.reduce((s, r) => s + r.foraTransp, 0);
  return {
    grupos: linhas.length,
    totalCtes,
    slaMedio: entregue > 0 ? (entregue - foraTransp) / entregue : null,
    abaixoMeta: linhas.filter((r) => r.slaPct !== null && r.slaPct < meta).length,
  };
}

export function filtrarPorCard(
  linhas: readonly LinhaDoRanking[],
  filtro: FiltroDoCard,
  meta: number,
): LinhaDoRanking[] {
  if (filtro === "na_meta") return linhas.filter((r) => r.slaPct !== null && r.slaPct >= meta);
  if (filtro === "abaixo_meta") return linhas.filter((r) => r.slaPct !== null && r.slaPct < meta);
  return [...linhas];
}

/** Nulos (ex.: SLA sem entregas) sempre por último, em qualquer direção. */
export function ordenarLinhas(
  linhas: readonly LinhaDoRanking[],
  chave: ChaveDeOrdem,
  direcao: "asc" | "desc",
  nomeDe: (r: LinhaDoRanking) => string,
): LinhaDoRanking[] {
  const valor = (r: LinhaDoRanking): number | string | null =>
    chave === "nome" ? nomeDe(r) : r[chave];
  const sinal = direcao === "asc" ? 1 : -1;
  return [...linhas].sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (typeof va === "string" || typeof vb === "string") {
      return sinal * String(va).localeCompare(String(vb), "pt-BR");
    }
    return sinal * (va - vb);
  });
}

/** Parâmetros sugeridos ao escolher o critério (iguais ao sistema atual). */
export const PARAMETROS_PADRAO: Record<CriterioDeRegra, Record<string, string>> = {
  entregas_prazo: { peso: "2" },
  penalizante: { valor: "15" },
  meta_produtividade: { meta_entregas: "200", bonus_se_atingir: "200" },
  piso_performance: { performance_minima: "85" },
  livre: { nome: "Bônus pontual", valor: "50" },
};

interface RascunhoDeCriterio {
  criterio: CriterioDeRegra;
  /** Texto como digitado; vira número só ao salvar. */
  parametros: Record<string, string>;
}

export interface Rascunho {
  id?: string | undefined;
  nome: string;
  descricao: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  ativo: boolean;
  criterios: RascunhoDeCriterio[];
}

type EntradaDaRegra = EntradaDe<typeof c.salvarRegra>;
type CriterioDaEntrada = NonNullable<EntradaDaRegra["criterios"]>[number];

/** `hoje` = AAAA-MM-DD no fuso da empresa. */
export function rascunhoVazio(hoje: string): Rascunho {
  return {
    nome: "",
    descricao: "",
    vigenciaInicio: hoje,
    vigenciaFim: "",
    ativo: true,
    criterios: [],
  };
}

export function rascunhoDaRegra(r: Regra): Rascunho {
  return {
    id: r.id,
    nome: r.nome,
    descricao: r.descricao ?? "",
    vigenciaInicio: r.vigenciaInicio,
    vigenciaFim: r.vigenciaFim ?? "",
    ativo: r.ativo,
    criterios: r.criterios.map((k) => ({
      criterio: k.criterio,
      parametros: Object.fromEntries(
        Object.entries(k.parametros).map(([chave, v]) => [chave, String(v)]),
      ),
    })),
  };
}

/** "12,5" e "12.5" valem; vazio ou texto não numérico não. */
function numero(texto: string | undefined): number | null {
  const t = (texto ?? "").trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type Conversao<T> = { ok: true; valor: T } | { ok: false; erro: string };

function criterioParaSalvar(k: RascunhoDeCriterio): Conversao<CriterioDaEntrada> {
  const campo = (chave: string): Conversao<number> => {
    const n = numero(k.parametros[chave]);
    return n === null
      ? { ok: false, erro: `${ROTULO_DO_CRITERIO[k.criterio]}: "${chave}" precisa ser um número.` }
      : { ok: true, valor: n };
  };
  switch (k.criterio) {
    case "entregas_prazo": {
      const peso = campo("peso");
      return peso.ok
        ? { ok: true, valor: { criterio: k.criterio, parametros: { peso: peso.valor } } }
        : peso;
    }
    case "penalizante": {
      const valor = campo("valor");
      return valor.ok
        ? { ok: true, valor: { criterio: k.criterio, parametros: { valor: valor.valor } } }
        : valor;
    }
    case "meta_produtividade": {
      const meta = campo("meta_entregas");
      if (!meta.ok) return meta;
      const bonus = campo("bonus_se_atingir");
      if (!bonus.ok) return bonus;
      return {
        ok: true,
        valor: {
          criterio: k.criterio,
          parametros: { meta_entregas: meta.valor, bonus_se_atingir: bonus.valor },
        },
      };
    }
    case "piso_performance": {
      const minima = campo("performance_minima");
      return minima.ok
        ? {
            ok: true,
            valor: { criterio: k.criterio, parametros: { performance_minima: minima.valor } },
          }
        : minima;
    }
    case "livre": {
      const valor = campo("valor");
      if (!valor.ok) return valor;
      return {
        ok: true,
        valor: {
          criterio: k.criterio,
          parametros: { nome: (k.parametros.nome ?? "").trim(), valor: valor.valor },
        },
      };
    }
  }
}

/** Converte o rascunho na entrada da API; o primeiro parâmetro inválido vira a mensagem. */
export function regraParaSalvar(d: Rascunho): Conversao<EntradaDaRegra> {
  const criterios: CriterioDaEntrada[] = [];
  for (const k of d.criterios) {
    const r = criterioParaSalvar(k);
    if (!r.ok) return r;
    criterios.push(r.valor);
  }
  return {
    ok: true,
    valor: {
      id: d.id,
      nome: d.nome,
      descricao: d.descricao.trim() || null,
      vigenciaInicio: d.vigenciaInicio,
      vigenciaFim: d.vigenciaFim || null,
      ativo: d.ativo,
      criterios,
    },
  };
}
