import { type Feriado } from "@erp/shared/contratos/calendario";
import {
  type Anotacao,
  ROTULO_DO_TIPO_DE_ANOTACAO,
  TIPOS_ANOTACAO,
} from "@erp/shared/contratos/historico";
import { somarDias } from "@erp/shared/datas";
import { z } from "@erp/shared/zod";

import { type EtiquetaDaBusca, resumirNomes } from "@/componentes/comum/FiltrosAvancados";
import { type Intervalo } from "@/componentes/comum/periodo";
import { campoFiltro } from "@/hooks/use-filtros-na-url";

export const PERIODOS = ["7d", "30d", "mes", "90d"] as const;
export type PeriodoDoHistorico = (typeof PERIODOS)[number];

export const ROTULO_DO_PERIODO: Record<PeriodoDoHistorico, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  mes: "Mês",
  "90d": "90 dias",
};

export const PRESENCAS = ["todos", "anotacao", "feriado", "ambos"] as const;
export type Presenca = (typeof PRESENCAS)[number];

export const ROTULO_DA_PRESENCA: Record<Presenca, string> = {
  todos: "Todos os dias",
  anotacao: "Só com anotação",
  feriado: "Só com feriado",
  ambos: "Com ambos",
};

/** Parâmetros da URL de /historico — os mesmos do sistema atual. */
export const esquemaDaBusca = z.object({
  periodo: campoFiltro.opcao(PERIODOS, "30d"),
  unidades: campoFiltro.lista(),
  visao: campoFiltro.opcao(["timeline", "calendario"], "timeline"),
  tipos: z
    .preprocess(
      (v): unknown[] => {
        const itens: unknown[] = Array.isArray(v) ? v : v ? [v] : [];
        return itens.filter((t) => TIPOS_ANOTACAO.some((x) => x === t));
      },
      z.array(z.enum(TIPOS_ANOTACAO)),
    )
    .catch([]),
  presenca: campoFiltro.opcao(PRESENCAS, "todos"),
  autor: campoFiltro.texto(60),
  q: campoFiltro.texto(200),
});
export type BuscaHistorico = z.output<typeof esquemaDaBusca>;

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

export function etiquetasDaBusca(
  b: BuscaHistorico,
  nomes: { unidade: (id: string) => string | undefined; autor: (id: string) => string | undefined },
): EtiquetaDaBusca<BuscaHistorico>[] {
  const unidades = b.unidades.flatMap((u) => nomes.unidade(u) ?? []);
  return [
    ...(b.unidades.length === 0
      ? []
      : [
          {
            rotulo: "Unidades",
            ...(unidades.length === b.unidades.length
              ? resumirNomes(unidades)
              : {
                  valor:
                    b.unidades.length === 1
                      ? "1 selecionada"
                      : `${String(b.unidades.length)} selecionadas`,
                }),
            limpar: { unidades: [] },
          },
        ]),
    ...(b.tipos.length > 0
      ? [
          {
            rotulo: "Tipo",
            ...resumirNomes(b.tipos.map((t) => ROTULO_DO_TIPO_DE_ANOTACAO[t])),
            limpar: { tipos: [] },
          },
        ]
      : []),
    ...(b.presenca !== "todos"
      ? [
          {
            rotulo: "Dias",
            valor: ROTULO_DA_PRESENCA[b.presenca],
            limpar: { presenca: "todos" as const },
          },
        ]
      : []),
    ...(b.autor !== ""
      ? [
          {
            rotulo: "Autor",
            valor: nomes.autor(b.autor) ?? "autor sem nome",
            limpar: { autor: "" },
          },
        ]
      : []),
    ...(b.q.trim() !== "" ? [{ rotulo: "Busca", valor: b.q.trim(), limpar: { q: "" } }] : []),
  ];
}
