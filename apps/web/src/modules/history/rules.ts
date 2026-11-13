import { type Feriado } from "@erp/shared/contracts/calendar";
import { type Anotacao } from "@erp/shared/contracts/history";
import { somarDias } from "@erp/shared/dates";

import { type Intervalo } from "@/components/common/period";

import { type BuscaHistorico, type PeriodoDoHistorico } from "./search";

/** Período do atalho, com o dia de Brasília (Q11). */
export function intervaloDoPeriodo(periodo: PeriodoDoHistorico, hoje: string): Intervalo {
  if (periodo === "mes") return { inicio: `${hoje.slice(0, 8)}01`, fim: hoje };
  const dias = { "7d": 7, "30d": 30, "90d": 90 }[periodo];
  return { inicio: somarDias(hoje, -(dias - 1)), fim: hoje };
}

export interface DiaDoHistorico {
  dia: string;
  anotacoes: Anotacao[];
  feriados: Feriado[];
}

/**
 * Dias com contexto, do mais recente ao mais antigo, com os filtros da tela (tipo, autor e busca
 * valem para as anotações; "dias" escolhe pela presença de anotação e/ou feriado).
 */
export function diasDoHistorico(
  anotacoes: readonly Anotacao[],
  feriados: readonly Feriado[],
  b: Pick<BuscaHistorico, "tipos" | "autor" | "q" | "presenca">,
): DiaDoHistorico[] {
  const termo = b.q.trim().toLowerCase();
  const visiveis = anotacoes.filter(
    (a) =>
      (b.tipos.length === 0 || b.tipos.includes(a.tipo)) &&
      (b.autor === "" || a.autorId === b.autor) &&
      (termo === "" || a.texto.toLowerCase().includes(termo)),
  );
  const porDia = new Map<string, DiaDoHistorico>();
  const doDia = (dia: string) => {
    let d = porDia.get(dia);
    if (!d) {
      d = { dia, anotacoes: [], feriados: [] };
      porDia.set(dia, d);
    }
    return d;
  };
  for (const a of visiveis) doDia(a.data).anotacoes.push(a);
  for (const f of feriados) doDia(f.data).feriados.push(f);
  const presente = {
    todos: () => true,
    anotacao: (d: DiaDoHistorico) => d.anotacoes.length > 0 && d.feriados.length === 0,
    feriado: (d: DiaDoHistorico) => d.feriados.length > 0 && d.anotacoes.length === 0,
    ambos: (d: DiaDoHistorico) => d.anotacoes.length > 0 && d.feriados.length > 0,
  }[b.presenca];
  return [...porDia.values()].filter(presente).sort((x, y) => (x.dia < y.dia ? 1 : -1));
}

/** Q09: só o autor ou um administrador altera a anotação. */
export function podeAlterar(a: Anotacao, usuarioId: string, admin: boolean): boolean {
  return admin || a.autorId === usuarioId;
}
