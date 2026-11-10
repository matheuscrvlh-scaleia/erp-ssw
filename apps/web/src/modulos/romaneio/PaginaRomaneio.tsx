/**
 * Tela Romaneio (`/romaneio`): Hoje, Total, Romaneio de entrega, Performance por romaneio,
 * Performance Motorista/Ajudante e Prejuízo. Os filtros vivem na URL, com os mesmos parâmetros
 * de hoje. origem: src/routes/_authenticated/romaneio.tsx (sistema atual)
 */
import { CAMPOS_DATA, type Recorte } from "@erp/shared/contratos/romaneio";
import { hojeNoFuso } from "@erp/shared/datas";
import { useIsFetching, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { RefreshCw, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { consultaAcesso } from "@/acesso/sessao";
import { Abas } from "@/componentes/comum/Abas";
import { resolverPeriodo } from "@/componentes/comum/periodo";
import { Button } from "@/componentes/ui/button";
import { useFiltrosNaUrl } from "@/hooks/use-filtros-na-url";
import { cn } from "@/lib/utils";

import { AbaHoje } from "./AbaHoje";
import {
  AbaPerformanceAjudante,
  AbaPerformanceMotorista,
  AbaPerformanceRomaneio,
  AbaPrejuizo,
  AbaRomaneioEntrega,
} from "./AbasDesempenho";
import { CHAVE_DO_ROMANEIO, consultaTotais } from "./api";
import { BarraDeFiltros, BaseDeData } from "./BarraDeFiltros";
import {
  type Aba,
  ABAS,
  type Abertura,
  buscaDaAbertura,
  esquemaRomaneio,
  filtrosDaBarra,
  ROTULO_RECORTE,
  veTodos,
} from "./busca";
import { CardsDoPeriodo, type PropsCardsDoPeriodo } from "./CardsDoPeriodo";
import { useCardsSecundarios } from "./componentes";
import { Distribuicao } from "./Distribuicao";
import { ListaTotal } from "./ListaTotal";

const ROTULO_ABA: Record<Aba, string> = {
  hoje: "Hoje",
  andamento: "Total",
  romaneio: "Romaneio de entrega",
  performance: "Performance por romaneio",
  motoristas: "Performance Motorista",
  ajudantes: "Performance Ajudante",
  prejuizo: "Prejuízo",
};

const CHAVE_DA_BASE = "romaneio:ver";

export function PaginaRomaneio() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const fuso = acesso.empresa?.fuso ?? "America/Sao_Paulo";
  const nomeCurto = acesso.empresa?.nomeCurto ?? "transportadora";
  const podeVerPlaca = acesso.telas.includes("romaneio_placa");
  const { filtros: b, definir } = useFiltrosNaUrl(esquemaRomaneio);
  const queryClient = useQueryClient();
  const atualizando = useIsFetching({ queryKey: CHAVE_DO_ROMANEIO }) > 0;
  const cardsSecundarios = useCardsSecundarios();
  const listaRef = useRef<HTMLDivElement>(null);

  // Base de data escolhida: sem `ver` na URL, retoma a última escolha guardada no navegador.
  useEffect(() => {
    try {
      const temNaUrl = new URLSearchParams(window.location.search).has("ver");
      const salvo = CAMPOS_DATA.find((c) => c === window.localStorage.getItem(CHAVE_DA_BASE));
      if (!temNaUrl && salvo && salvo !== b.ver) {
        definir({ ver: salvo, page: 1 });
        return;
      }
      window.localStorage.setItem(CHAVE_DA_BASE, b.ver);
    } catch {
      // sem armazenamento: fica o padrão da URL
    }
    // Só reage à troca da base; `definir` muda a cada navegação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.ver]);

  const ehHoje = b.tab === "hoje";
  const intervalo = resolverPeriodo(b.periodo, b.de, b.ate, hojeNoFuso(fuso));
  const filtros = filtrosDaBarra(b, intervalo);
  const verTodos = veTodos(b);
  const totais = useQuery({
    ...consultaTotais({
      filtros,
      ...(b.ctrc ? { ctrc: b.ctrc } : {}),
      ...(b.nf ? { nf: b.nf } : {}),
      universo: verTodos ? "todos" : "romaneados",
      semMovimento: b.semMovimento,
    }),
    enabled: !ehHoje,
  });

  const abrir = (a: Abertura) => {
    definir(buscaDaAbertura(a));
    window.setTimeout(
      () => listaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      60,
    );
  };
  const cards: PropsCardsDoPeriodo = {
    totais: totais.data?.totais,
    otifVisivel: totais.data?.otifVisivel ?? false,
    verTodos,
    cardsSecundarios,
    aoAbrir: (recorte: Recorte) => {
      abrir({ recorte });
    },
  };
  const recorteAtivo = b.romaneado !== "todos" || b.status === "andamento" || b.recorte !== "todos";

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[24px] font-semibold">Romaneio</h1>
        <Button
          size="sm"
          variant="ghost"
          disabled={atualizando}
          onClick={() => void queryClient.invalidateQueries({ queryKey: CHAVE_DO_ROMANEIO })}
        >
          <RefreshCw className={cn("mr-1.5 h-3 w-3", atualizando && "animate-spin")} /> Atualizar
        </Button>
      </header>

      {/* As abas ficam logo abaixo do cabeçalho em todas as abas: trocar nunca desloca os botões. */}
      <div className="sticky top-0 z-20 -mx-1 bg-background px-1 py-1.5">
        <Abas
          abas={ABAS.map((aba) => ({ valor: aba, rotulo: ROTULO_ABA[aba] }))}
          valor={b.tab}
          aoMudar={(tab) => {
            definir({ tab, page: 1 });
          }}
          rotulo="Abas do Romaneio"
          className="max-w-full justify-start overflow-x-auto"
        />
      </div>

      {ehHoje ? (
        // A aba Hoje não tem a barra de filtros: o prejuízo usa o padrão (código 13).
        <AbaHoje fuso={fuso} aoAbrir={abrir} />
      ) : (
        <>
          <div className="space-y-4">
            <BaseDeData busca={b} definir={definir} />
            <BarraDeFiltros busca={b} definir={definir} intervalo={intervalo} filtros={filtros} />
            {/* Na aba Performance por romaneio os totalizadores ficam lá dentro. */}
            {b.tab !== "performance" && (
              <>
                {(recorteAtivo || !verTodos) && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>Tabela abaixo filtrada:</span>
                    {!verTodos && (
                      <span className="rounded-full border border-border/70 bg-muted px-2 py-0.5">
                        somente romaneados (sem os parados)
                      </span>
                    )}
                    {b.recorte !== "todos" && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand)]/40 bg-[var(--brand)]/10 px-2 py-0.5 text-foreground">
                        {ROTULO_RECORTE[b.recorte]}
                        <button
                          type="button"
                          aria-label="Remover recorte"
                          onClick={() => {
                            definir({ recorte: "todos", page: 1 });
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {b.romaneado !== "todos" && (
                      <span className="rounded-full border border-border/70 bg-muted px-2 py-0.5">
                        {b.romaneado === "sim" ? "só em rota agora" : "só fora de rota agora"}
                      </span>
                    )}
                    {b.status === "andamento" && (
                      <span className="rounded-full border border-border/70 bg-muted px-2 py-0.5">
                        excluindo entregues e baixados
                      </span>
                    )}
                    <span>· os cards abaixo mostram o total do universo ativo do período.</span>
                  </div>
                )}
                <CardsDoPeriodo {...cards} />
              </>
            )}
          </div>

          <div ref={listaRef} className="scroll-mt-14">
            {b.tab === "andamento" && (
              <div className="space-y-3">
                <Distribuicao filtros={filtros} nomeCurto={nomeCurto} aoAbrir={abrir} />
                <ListaTotal
                  busca={b}
                  definir={definir}
                  filtros={filtros}
                  otifVisivel={cards.otifVisivel}
                />
              </div>
            )}
            {b.tab === "romaneio" && <AbaRomaneioEntrega filtros={filtros} aoAbrir={abrir} />}
            {b.tab === "performance" && (
              <AbaPerformanceRomaneio
                filtros={filtros}
                aoAbrir={abrir}
                cards={cards}
                nomeCurto={nomeCurto}
              />
            )}
            {b.tab === "motoristas" && (
              <AbaPerformanceMotorista
                filtros={filtros}
                aoAbrir={abrir}
                podeVerPlaca={podeVerPlaca}
              />
            )}
            {b.tab === "ajudantes" && (
              <AbaPerformanceAjudante
                filtros={filtros}
                aoAbrir={abrir}
                podeVerPlaca={podeVerPlaca}
              />
            )}
            {b.tab === "prejuizo" && <AbaPrejuizo filtros={filtros} aoAbrir={abrir} />}
          </div>
        </>
      )}
    </div>
  );
}
