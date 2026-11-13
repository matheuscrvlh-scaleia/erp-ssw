import {
  ITENS_POR_PAGINA,
  recortesSelecionados,
  type TipoRecorte,
} from "@erp/shared/contracts/listing";
import { hojeNoFuso } from "@erp/shared/dates";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { consultaAcesso } from "@/access/session";
import { ExportMenu } from "@/components/common/ExportMenu";
import { Aviso } from "@/components/common/Notice";
import { BotoesDePagina } from "@/components/common/PageButtons";
import { Painel } from "@/components/common/Panel";
import { SeloDosDados } from "@/components/layout/DataBadge";
import { Pagina } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { useFusoDaEmpresa } from "@/hooks/use-company-timezone";
import { mensagemAmigavel } from "@/lib/error-message";
import { consultaPagadores } from "@/modules/filters/api";

import {
  carregarTodasAsLinhas,
  chaves,
  consultaCodigosDoRecorte,
  consultaLista,
  LIMITE_DA_EXPORTACAO,
  type Ordenacao,
} from "./api";
import { TabelaCtrcs } from "./components/CtrcsTable";
import { GraficosListagem } from "./components/ListingCharts";
import { FiltrosListagem } from "./components/ListingFilters";
import {
  COLUNAS_DA_EXPORTACAO,
  linhaExportada,
  nomeDoArquivo,
  subtituloDaExportacao,
} from "./export";
import { codigosEmAberto } from "./rules";
import { type BuscaDaLista, filtroDaBusca, periodoDaLista, tituloDaLista } from "./search";

const rota = getRouteApi("/_authenticated/performance/lista");

/**
 * Listagem detalhada de CT-e: um filtro único (recortes + filtros) alimenta a tabela paginada, o
 * total, os quatro gráficos e a exportação.
 * origem: src/routes/_authenticated/performance.lista.tsx (sistema atual)
 */
export function PaginaListagem() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const fuso = useFusoDaEmpresa();
  const nomeCurto = acesso.empresa?.nomeCurto ?? "transportadora";
  const busca = rota.useSearch();
  const navegar = rota.useNavigate();
  const queryClient = useQueryClient();

  const hoje = hojeNoFuso(fuso);
  const periodo = useMemo(
    () => periodoDaLista({ periodo: busca.periodo, de: busca.de, ate: busca.ate }, hoje),
    [busca.periodo, busca.de, busca.ate, hoje],
  );
  const filtro = useMemo(() => filtroDaBusca(busca, periodo), [busca, periodo]);
  const recortes = useMemo(
    () => recortesSelecionados(busca.tipo, busca.recortes),
    [busca.tipo, busca.recortes],
  );
  const temRecorte = (r: TipoRecorte) => recortes.includes(r);
  const ordenacao: Ordenacao = { ordem: busca.sort, direcao: busca.dir };

  const atualizarBusca = (mudanca: Partial<BuscaDaLista>) => {
    void navegar({
      search: (anterior) => ({ ...anterior, ...mudanca, page: mudanca.page ?? 1 }),
    });
  };

  // Com `abertos` (alerta ou recorte "Saíram para entrega"): marca no seletor Ocorrência os
  // códigos em aberto do recorte e só então carrega a lista. O filtro fica visível e pode ser
  // limpo para ver também os finalizados.
  const codigosAbertos = useQuery({
    ...consultaCodigosDoRecorte(filtro),
    enabled: busca.abertos === true,
  });
  useEffect(() => {
    if (!busca.abertos || (!codigosAbertos.data && !codigosAbertos.isError)) return;
    const codigos = codigosEmAberto(recortes, busca.codigos, codigosAbertos.data);
    void navegar({
      replace: true,
      search: (anterior) => ({ ...anterior, abertos: undefined, codigos, page: 1 }),
    });
  }, [
    busca.abertos,
    busca.codigos,
    recortes,
    codigosAbertos.data,
    codigosAbertos.isError,
    navegar,
  ]);

  const lista = useQuery({
    ...consultaLista(filtro, ordenacao, busca.page),
    enabled: busca.abertos !== true,
  });
  const pagadores = useQuery(
    consultaPagadores({
      inicio: periodo.inicio,
      fim: periodo.fim,
      unidades: busca.unidades.length > 0 ? busca.unidades : undefined,
      filiais: busca.filiais.length > 0 ? busca.filiais : undefined,
    }),
  );

  const total = lista.data?.total ?? 0;
  const linhas = lista.data?.linhas ?? [];
  const porCodigo = lista.data?.porCodigo ?? [];
  const porUnidade = lista.data?.porUnidade ?? [];
  const porCidade = lista.data?.porCidade ?? [];
  const porFaixa = lista.data?.porFaixa ?? [];
  const totalDePaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));

  // ------------------------------------------------------------ exportação
  const titulo = tituloDaLista(busca, periodo.rotulo, nomeCurto);
  const subtitulo = subtituloDaExportacao(busca, periodo);
  /** Todas as páginas do filtro (Q04: sem corte silencioso — passou do teto, avisa). */
  const carregarParaExportar = async () => {
    const { linhas: todas, cortada } = await carregarTodasAsLinhas(filtro, ordenacao);
    if (cortada) {
      toast.warning(
        `O arquivo saiu com os primeiros ${LIMITE_DA_EXPORTACAO.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} CTRCs (na ordem da tela). Reduza o período ou aplique mais filtros para exportar o restante.`,
      );
    }
    return todas.map(linhaExportada);
  };

  const atualizar = () => queryClient.invalidateQueries({ queryKey: chaves.tudo });
  const voltar = () => {
    if (window.history.length > 1) window.history.back();
    else void navegar({ to: "/" });
  };

  return (
    <Pagina
      titulo={titulo}
      meta={<SeloDosDados className="" />}
      acoes={
        <>
          <Button variant="ghost" size="sm" onClick={voltar}>
            <ArrowLeft aria-hidden />
            Voltar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void atualizar()}>
            <RefreshCw aria-hidden />
            Atualizar
          </Button>
          <ExportMenu
            arquivo={nomeDoArquivo(recortes, periodo.inicio, periodo.fim)}
            titulo={titulo}
            subtitulo={subtitulo}
            colunas={COLUNAS_DA_EXPORTACAO}
            linhas={[]}
            carregarLinhas={carregarParaExportar}
            desabilitado={total === 0}
            tamanhoFonte={5.5}
            className="h-8"
          />
        </>
      }
      filtros={
        <FiltrosListagem
          busca={busca}
          periodo={periodo}
          recortes={recortes}
          filtro={filtro}
          nomeCurto={nomeCurto}
          pagadores={pagadores.data ?? []}
          porCodigo={porCodigo}
          aoMudar={atualizarBusca}
        />
      }
    >
      {lista.isError && (
        <Aviso
          tom="erro"
          acao={
            <Button size="sm" variant="outline" onClick={() => void lista.refetch()}>
              <RefreshCw aria-hidden />
              Tentar novamente
            </Button>
          }
        >
          {mensagemAmigavel(lista.error)}
        </Aviso>
      )}

      <GraficosListagem
        busca={busca}
        recortes={recortes}
        total={total}
        carregando={lista.isLoading}
        rotuloDoPeriodo={periodo.rotulo}
        porCodigo={porCodigo}
        porUnidade={porUnidade}
        porCidade={porCidade}
        porFaixa={porFaixa}
        aoMudar={atualizarBusca}
      />

      <Painel
        rodape={
          <>
            <span className="flex-1">
              Página {busca.page} de {totalDePaginas} · {total.toLocaleString("pt-BR")} CTRCs
            </span>
            <BotoesDePagina
              pagina={busca.page}
              totalDePaginas={totalDePaginas}
              aoMudar={(page) => {
                atualizarBusca({ page });
              }}
              desabilitado={lista.isLoading}
            />
          </>
        }
      >
        <TabelaCtrcs
          linhas={linhas}
          ordenacao={ordenacao}
          aoOrdenar={(ordem) => {
            const direcao = busca.sort === ordem && busca.dir === "desc" ? "asc" : "desc";
            atualizarBusca({ sort: ordem, dir: direcao });
          }}
          saiuComPrazoVencido={temRecorte("nascido_atrasado")}
        />
      </Painel>
    </Pagina>
  );
}
