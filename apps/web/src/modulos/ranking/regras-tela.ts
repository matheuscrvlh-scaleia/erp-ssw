import { type EntradaDe } from "@erp/shared/contrato";
import {
  type contratosRanking as c,
  type CriterioDeRegra,
  type Regra,
} from "@erp/shared/contratos/ranking";

export const ROTULO_DO_CRITERIO: Record<CriterioDeRegra, string> = {
  entregas_prazo: "Entregas no prazo",
  penalizante: "Penalidade por ocorrência",
  meta_produtividade: "Meta de produtividade",
  piso_performance: "Piso de performance",
  livre: "Critério livre",
};

/** Parâmetros sugeridos ao escolher o critério (iguais ao sistema atual). */
export const PARAMETROS_PADRAO: Record<CriterioDeRegra, Record<string, string>> = {
  entregas_prazo: { peso: "2" },
  penalizante: { valor: "15" },
  meta_produtividade: { meta_entregas: "200", bonus_se_atingir: "200" },
  piso_performance: { performance_minima: "85" },
  livre: { nome: "Bônus pontual", valor: "50" },
};

export interface RascunhoDeCriterio {
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
