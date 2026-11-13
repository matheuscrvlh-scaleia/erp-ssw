import {
  type FaixaPrevisto,
  type Previstos,
  type SomasPrevisto,
  type StatusPrevisto,
} from "@erp/shared/contracts/performance";

import { faixaPrevisao, statusPrevisto } from "../core/status";
import { type CodigoDoCatalogo } from "./catalog";
import { centavos } from "./numbers";

/**
 * CT-e previstos agrupados por (código efetivo × previsão), como o repositório devolve: a
 * classificação em status e faixa é feita aqui, com a regra em TS.
 */
export interface GrupoPrevisto {
  codigo: number | null;
  prevista: string | null;
  qtd: number;
  /** `numeric` (texto) do banco. */
  peso: string | number | null;
  volumes: number;
  frete: string | number | null;
}

/** Peso em gramas inteiras para somar sem erro de float (peso é `numeric(12,3)`). */
function gramas(valor: string | number | null): number {
  if (valor === null || valor === "") return 0;
  const texto = typeof valor === "number" ? valor.toFixed(3) : valor;
  const [inteiro = "0", fracao = ""] = texto.split(".");
  return Number(inteiro) * 1000 + Number(fracao.padEnd(3, "0").slice(0, 3));
}

interface Acumulado {
  qtd: number;
  gramas: number;
  volumes: number;
  centavos: number;
}

const vazio = (): Acumulado => ({ qtd: 0, gramas: 0, volumes: 0, centavos: 0 });

function acumular(a: Acumulado, g: GrupoPrevisto): Acumulado {
  return {
    qtd: a.qtd + g.qtd,
    gramas: a.gramas + gramas(g.peso),
    volumes: a.volumes + g.volumes,
    centavos: a.centavos + centavos(g.frete),
  };
}

const somas = (a: Acumulado): SomasPrevisto => ({
  qtd: a.qtd,
  peso: a.gramas / 1000,
  volumes: a.volumes,
  frete: a.centavos / 100,
});

/**
 * Soma os grupos nos dois eixos (status da última ocorrência e faixa de vencimento, com `hoje` no
 * Brasília, decisão Q11) e no total. Só aparecem as chaves com CT-e; a tela ordena.
 * origem: performance_previstos_breakdown (sistema atual)
 */
export function montarPrevistos(
  grupos: readonly GrupoPrevisto[],
  catalogo: readonly CodigoDoCatalogo[],
  agora: Date,
): Previstos {
  const tipos = new Map(catalogo.map((c) => [c.codigo, c.tipoSsw]));
  const porStatus = new Map<StatusPrevisto, Acumulado>();
  const porFaixa = new Map<FaixaPrevisto, Acumulado>();
  let total = vazio();
  for (const g of grupos) {
    const status = statusPrevisto(
      g.codigo,
      g.codigo === null ? null : (tipos.get(g.codigo) ?? null),
    );
    const faixa = faixaPrevisao(g.prevista, agora);
    porStatus.set(status, acumular(porStatus.get(status) ?? vazio(), g));
    porFaixa.set(faixa, acumular(porFaixa.get(faixa) ?? vazio(), g));
    total = acumular(total, g);
  }
  return {
    status: [...porStatus].map(([key, a]) => ({ key, ...somas(a) })),
    faixa: [...porFaixa].map(([key, a]) => ({ key, ...somas(a) })),
    total: somas(total),
  };
}
