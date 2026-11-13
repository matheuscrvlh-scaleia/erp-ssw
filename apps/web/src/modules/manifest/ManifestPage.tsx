/**
 * Tela Romaneio (`/romaneio`): Hoje, Total, Romaneio de entrega, Performance por romaneio,
 * Performance Motorista/Ajudante e Prejuízo. Os filtros vivem na URL, com os mesmos parâmetros
 * de hoje. origem: src/routes/_authenticated/romaneio.tsx (sistema atual)
 */
import { CAMPOS_DATA, type Recorte } from "@erp/shared/contracts/manifest";
import { hojeNoFuso } from "@erp/shared/dates";
import { useIsFetching, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { consultaAcesso } from "@/access/session";
import { Aviso } from "@/components/common/Notice";
import { resolverPeriodo } from "@/components/common/period";
import { Abas } from "@/components/common/Tabs";
import { SeloDosDados } from "@/components/layout/DataBadge";
import { Pagina } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { useFusoDaEmpresa } from "@/hooks/use-company-timezone";
import { useFiltrosNaUrl } from "@/hooks/use-url-filters";
import { cn } from "@/lib/utils";

import { chaves, consultaTotais } from "./api";
import { AbaRomaneioEntrega } from "./components/DeliveryManifestTab";
import { Distribuicao } from "./components/Distribution";
import { AbaPerformanceMotorista } from "./components/DriverPerformanceTab";
import { ListaTotal } from "./components/FullList";
import { FiltrosGerais } from "./components/GeneralFilters";
import { AbaPerformanceAjudante } from "./components/HelperPerformanceTab";
import { AbaPrejuizo } from "./components/LossTab";
import { AbaPerformanceRomaneio } from "./components/ManifestPerformanceTab";
import { CardsDoPeriodo, type PropsCardsDoPeriodo } from "./components/PeriodCards";
import { FiltrosDaHoje } from "./components/TodayFilters";
import { AbaHoje } from "./components/TodayTab";
import { FILTROS_DA_HOJE_VAZIOS, type FiltrosHoje } from "./rules";
import {
  type Aba,
  ABAS,
  type Abertura,
  buscaDaAbertura,
  esquemaRomaneio,
  filtrosDaBarra,
  veTodos,
} from "./search";
import { ROTULO_RECORTE } from "./texts";
import { useCardsSecundarios } from "./use-secondary-cards";

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

/** Pílula do aviso "Tabela abaixo filtrada". */
function PilulaDoRecorte({ children, aoTirar }: { children: string; aoTirar?: () => void }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-card px-2.5 text-[12px] font-medium text-foreground">
      {children}
      {aoTirar && (
        <button
          type="button"
          aria-label="Remover recorte"
          title="Remover recorte"
          onClick={aoTirar}
          className="-mr-1 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </span>
  );
}

export function PaginaRomaneio() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const fuso = useFusoDaEmpresa();
  const nomeCurto = acesso.empresa?.nomeCurto ?? "transportadora";
  const podeVerPlaca = acesso.telas.includes("romaneio_placa");
  const { filtros: b, definir } = useFiltrosNaUrl(esquemaRomaneio);
  const queryClient = useQueryClient();
  const atualizando = useIsFetching({ queryKey: chaves.tudo }) > 0;
  const cardsSecundarios = useCardsSecundarios();
  const listaRef = useRef<HTMLDivElement>(null);
  // Filtros da aba Hoje: só da visita à aba (não vão para a URL) e zeram ao sair dela.
  const [filtrosHoje, setFiltrosHoje] = useState<FiltrosHoje>(FILTROS_DA_HOJE_VAZIOS);

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
  if (!ehHoje && filtrosHoje !== FILTROS_DA_HOJE_VAZIOS) setFiltrosHoje(FILTROS_DA_HOJE_VAZIOS);
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
    <Pagina
      titulo="Romaneio"
      meta={<SeloDosDados />}
      acoes={
        <Button
          size="sm"
          variant="ghost"
          disabled={atualizando}
          onClick={() => void queryClient.invalidateQueries({ queryKey: chaves.tudo })}
        >
          <RefreshCw className={cn(atualizando && "motion-safe:animate-spin")} aria-hidden />
          Atualizar
        </Button>
      }
      abas={
        <Abas
          abas={ABAS.map((aba) => ({ valor: aba, rotulo: ROTULO_ABA[aba] }))}
          valor={b.tab}
          aoMudar={(tab) => {
            definir({ tab, page: 1 });
          }}
          rotulo="Abas do Romaneio"
          className="max-w-full justify-start overflow-x-auto"
        />
      }
      filtros={
        ehHoje ? (
          // A aba Hoje não usa a barra geral: só unidade e tipo de documento, do dia.
          <FiltrosDaHoje fuso={fuso} filtros={filtrosHoje} aoMudar={setFiltrosHoje} />
        ) : (
          <FiltrosGerais busca={b} definir={definir} intervalo={intervalo} filtros={filtros} />
        )
      }
    >
      {ehHoje ? (
        <AbaHoje fuso={fuso} filtros={filtrosHoje} aoAbrir={abrir} />
      ) : (
        <>
          {/* Na aba Performance por romaneio os totalizadores ficam lá dentro. */}
          {b.tab !== "performance" && (
            <>
              {(recorteAtivo || !verTodos) && (
                <Aviso tom="info">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span>Tabela abaixo filtrada:</span>
                    {!verTodos && (
                      <PilulaDoRecorte>somente romaneados (sem os parados)</PilulaDoRecorte>
                    )}
                    {b.recorte !== "todos" && (
                      <PilulaDoRecorte
                        aoTirar={() => {
                          definir({ recorte: "todos", page: 1 });
                        }}
                      >
                        {ROTULO_RECORTE[b.recorte]}
                      </PilulaDoRecorte>
                    )}
                    {b.romaneado !== "todos" && (
                      <PilulaDoRecorte>
                        {b.romaneado === "sim" ? "só em rota agora" : "só fora de rota agora"}
                      </PilulaDoRecorte>
                    )}
                    {b.status === "andamento" && (
                      <PilulaDoRecorte>excluindo entregues e baixados</PilulaDoRecorte>
                    )}
                    <span>· os cards abaixo mostram o total do universo ativo do período.</span>
                  </span>
                </Aviso>
              )}
              <CardsDoPeriodo {...cards} />
            </>
          )}

          <div ref={listaRef} className="scroll-mt-4 space-y-5 md:scroll-mt-44 md:space-y-6">
            {b.tab === "andamento" && (
              <>
                <Distribuicao filtros={filtros} nomeCurto={nomeCurto} aoAbrir={abrir} />
                <ListaTotal
                  busca={b}
                  definir={definir}
                  filtros={filtros}
                  otifVisivel={cards.otifVisivel}
                />
              </>
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
    </Pagina>
  );
}
