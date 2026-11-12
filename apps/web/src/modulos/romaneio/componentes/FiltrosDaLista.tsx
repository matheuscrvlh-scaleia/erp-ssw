import {
  AGRUPAMENTOS,
  type FiltrosRomaneio,
  LIMITE_AGRUPADO,
} from "@erp/shared/contratos/romaneio";
import { formatarData, formatarInteiro } from "@erp/shared/formatacao";
import { Layers } from "lucide-react";

import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { type EtiquetaFiltroOpcional, FiltrandoPor } from "@/componentes/comum/FiltrosAvancados";
import { SeloStatus } from "@/componentes/comum/SeloStatus";

import { type BuscaRomaneio, RECORTES_DA_LISTA, veTodos } from "../busca";
import { COLUNAS_DA_LISTA, type linhaParaExportar } from "../exportacao";
import {
  ETIQUETA_EM_ROTA_AGORA,
  ROTULO_AGRUPAMENTO,
  ROTULO_EM_ROTA_AGORA,
  ROTULO_RECORTE,
} from "../textos";
import { CampoAdiado } from "./CampoAdiado";
import { SeletorDaLista } from "./SeletorDaLista";

/**
 * Barra da lista da aba Total: situação, "Em rota agora", status, busca, "Filtrando por",
 * agrupamento e a exportação das linhas marcadas.
 */
export function FiltrosDaLista({
  busca: b,
  definir,
  filtros,
  otifVisivel,
  total,
  cabecalho,
  marcadas,
  aoMarcarTodas,
  carregarParaExportar,
  carregando,
}: {
  busca: BuscaRomaneio;
  definir: (mudanca: Partial<BuscaRomaneio>) => void;
  filtros: FiltrosRomaneio;
  otifVisivel: boolean;
  total: number;
  /** Estado da caixa do cabeçalho (true: todas marcadas). */
  cabecalho: boolean | "indeterminate";
  marcadas: number;
  aoMarcarTodas: () => void;
  carregarParaExportar: () => Promise<ReturnType<typeof linhaParaExportar>[]>;
  carregando: boolean;
}) {
  const etiquetas: EtiquetaFiltroOpcional[] = [
    b.recorte !== "todos" && {
      rotulo: "Situação",
      valor: ROTULO_RECORTE[b.recorte],
      limpar: () => {
        definir({ recorte: "todos", page: 1 });
      },
    },
    b.romaneado !== "todos" && {
      rotulo: "Em rota agora",
      valor: ETIQUETA_EM_ROTA_AGORA[b.romaneado],
      limpar: () => {
        definir({ romaneado: "todos", page: 1 });
      },
    },
    b.status === "andamento" && {
      rotulo: "Status",
      valor: "Só em andamento",
      limpar: () => {
        definir({ status: "todos", page: 1 });
      },
    },
    b.busca.trim() && {
      rotulo: "Busca",
      valor: b.busca.trim(),
      limpar: () => {
        definir({ busca: "", page: 1 });
      },
    },
  ];

  return (
    <div className="flex w-full flex-col gap-2.5">
      {/* Os mesmos recortes dos cards: clicar num card marca a Situação; mudar aqui é igual. */}
      <div className="flex flex-wrap items-center gap-2">
        <SeletorDaLista
          rotulo="Situação"
          valor={b.recorte}
          aoMudar={(recorte) => {
            definir({ recorte, page: 1 });
          }}
          opcoes={RECORTES_DA_LISTA.filter(
            (r) => (veTodos(b) || r !== "parado") && (otifVisivel || r !== "otif"),
          ).map((r) => ({ valor: r, rotulo: r === "todos" ? "Todas" : ROTULO_RECORTE[r] }))}
        />
        <SeletorDaLista
          rotulo="Em rota agora"
          valor={b.romaneado}
          aoMudar={(romaneado) => {
            definir({ romaneado, page: 1 });
          }}
          opcoes={(["todos", "sim", "nao"] as const).map((r) => ({
            valor: r,
            rotulo: ROTULO_EM_ROTA_AGORA[r],
          }))}
        />
        <SeletorDaLista
          rotulo="Status"
          valor={b.status}
          aoMudar={(status) => {
            definir({ status, page: 1 });
          }}
          opcoes={[
            { valor: "todos", rotulo: "Todos" },
            { valor: "andamento", rotulo: "Só em andamento" },
          ]}
        />
        <CampoAdiado
          valor={b.busca}
          aoMudar={(busca) => {
            definir({ busca, page: 1 });
          }}
          placeholder="Buscar na lista: NF, CTRC, remetente, cidade, placa…"
          className="w-[340px] max-w-full"
        />
      </div>
      <FiltrandoPor etiquetas={etiquetas} />
      <div className="flex flex-wrap items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground" aria-hidden />
        <SeletorDaLista
          rotulo="Agrupar por"
          valor={b.agrupar}
          aoMudar={(agrupar) => {
            definir({ agrupar, page: 1 });
          }}
          opcoes={AGRUPAMENTOS.map((g) => ({ valor: g, rotulo: ROTULO_AGRUPAMENTO[g] }))}
        />
        {b.agrupar !== "none" && (
          <SeloStatus tom="neutro" semIcone>
            paginação desativada (até {formatarInteiro(LIMITE_AGRUPADO)})
          </SeloStatus>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {total > 0 && (
            <span className="text-[12.5px] text-muted-foreground">
              {cabecalho === true ? (
                <>todas as {formatarInteiro(total)} linhas marcadas para exportar</>
              ) : (
                <>
                  {formatarInteiro(marcadas)} de {formatarInteiro(total)} marcadas para exportar ·{" "}
                  <button
                    type="button"
                    className="font-medium text-brand underline-offset-2 hover:underline"
                    onClick={() => {
                      aoMarcarTodas();
                    }}
                  >
                    marcar todas
                  </button>
                </>
              )}
            </span>
          )}
          <ExportMenu
            arquivo="romaneio"
            titulo="Romaneio"
            subtitulo={`${formatarData(filtros.inicio)} a ${formatarData(filtros.fim)}`}
            colunas={COLUNAS_DA_LISTA}
            linhas={[]}
            carregarLinhas={carregarParaExportar}
            orientacao="paisagem"
            tamanhoFonte={5.5}
            desabilitado={carregando || (total > 0 && marcadas === 0)}
          />
        </div>
      </div>
    </div>
  );
}
