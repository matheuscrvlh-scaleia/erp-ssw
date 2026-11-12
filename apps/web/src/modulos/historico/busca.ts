import { ROTULO_DO_TIPO_DE_ANOTACAO, TIPOS_ANOTACAO } from "@erp/shared/contratos/historico";
import { z } from "@erp/shared/zod";

import { type EtiquetaDaBusca, resumirNomes } from "@/componentes/comum/FiltrosAvancados";
import { campoFiltro } from "@/hooks/use-filtros-na-url";

import { ROTULO_DA_PRESENCA } from "./textos";

export const PERIODOS = ["7d", "30d", "mes", "90d"] as const;
export type PeriodoDoHistorico = (typeof PERIODOS)[number];

export const PRESENCAS = ["todos", "anotacao", "feriado", "ambos"] as const;
export type Presenca = (typeof PRESENCAS)[number];

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
