import {
  type LinhaDeComprovante,
  type StatusDeComprovante,
} from "@erp/shared/contracts/delivery-proofs";
import { hojeNoFuso } from "@erp/shared/dates";
import { formatarData } from "@erp/shared/formatting";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { etiquetasQueLimpam, FiltrandoPor } from "@/components/common/AdvancedFilters";
import { type ColunaTabela } from "@/components/common/data-table";
import { MensagemErro } from "@/components/common/ErrorMessage";
import { ExportMenu } from "@/components/common/ExportMenu";
import { resolverPeriodo } from "@/components/common/period";
import { SeloStatus } from "@/components/common/StatusBadge";
import { SeloDosDados } from "@/components/layout/DataBadge";
import { Pagina } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { temFiltro } from "@/hooks/url-filters";
import { useFusoDaEmpresa } from "@/hooks/use-company-timezone";
import { useFiltrosNaUrl } from "@/hooks/use-url-filters";
import { COLUNA_LINK_SSW, urlCtrcNoSsw } from "@/lib/export";
import { nomesDosPagadores } from "@/lib/filter-options";
import { consultaPagadores } from "@/modules/filters/api";

import { carregarListaInteira, consultaLista, consultaPainel } from "./api";
import { GraficoPorDia } from "./components/ByDayChart";
import { CardsDeComprovantes } from "./components/ProofsCards";
import { FiltrosComprovantes } from "./components/ProofsFilters";
import { ListaDeComprovantes } from "./components/ProofsList";
import { TabelasDeResumo } from "./components/SummaryTables";
import { colunasDaExportacao, linhaDaExportacao } from "./export";
import { esquemaDaBusca, etiquetasDaBusca, filtrosDaBusca, NAO_SAO_FILTRO } from "./search";
import { TITULO_DO_STATUS } from "./texts";

/** Colunas da lista lateral; a exportação sai com as mesmas, na mesma ordem. */
const COLUNAS_DA_LISTA: ColunaTabela<LinhaDeComprovante>[] = [
  { chave: "numeroNf", titulo: "NF" },
  { chave: "numeroCtrc", titulo: "CTRC", classe: "font-mono" },
  { chave: "dataEntrega", titulo: "Data de entrega", formato: "data" },
  { chave: "unidade", titulo: "Unidade responsável", classe: "font-mono" },
  { chave: "setor", titulo: "Setor" },
  { chave: "pagadorNome", titulo: "Pagador", classe: "max-w-[180px] truncate" },
  { chave: "remetente", titulo: "Remetente", oculta: true },
  { chave: "destinatario", titulo: "Destinatário", classe: "max-w-[180px] truncate" },
  { chave: "cidadeDestino", titulo: "Cidade" },
  { chave: "tipoDocumento", titulo: "Tipo de documento" },
  {
    chave: "digitalizado",
    titulo: "Comprovante",
    valor: (l) => (l.digitalizado ? "Digitalizado" : "Pendente"),
    celula: (l) =>
      l.digitalizado ? (
        <SeloStatus tom="sucesso">Digitalizado</SeloStatus>
      ) : (
        <SeloStatus tom="erro">Pendente</SeloStatus>
      ),
  },
  {
    chave: "linkSsw",
    titulo: COLUNA_LINK_SSW,
    oculta: true,
    valor: (l) => urlCtrcNoSsw(l.siglaCtrc, l.numeroCtrc, l.dataEmissao),
  },
];

export function PaginaComprovantes() {
  const fuso = useFusoDaEmpresa();
  const { filtros: busca, definir, limpar, ativos } = useFiltrosNaUrl(esquemaDaBusca);
  const periodo = resolverPeriodo(busca.periodo, busca.de, busca.ate, hojeNoFuso(fuso));
  const filtros = filtrosDaBusca(busca, periodo);
  const subtitulo = `Entrega de ${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}`;

  const painel = useQuery(consultaPainel(filtros));
  // A lista lateral abre pelo card (o status fica na URL) e só consulta aberta.
  const [listaAberta, setListaAberta] = useState(false);
  const lista = useQuery({
    ...consultaLista(filtros, busca.status, busca.page, busca.size),
    enabled: listaAberta,
    placeholderData: keepPreviousData,
  });

  const mudar = (m: Partial<typeof busca>) => {
    definir({ page: 1, ...m });
  };
  const abrir = (status: StatusDeComprovante) => {
    mudar({ status });
    setListaAberta(true);
  };
  const totais = painel.data?.totais ?? { entregues: 0, digitalizados: 0, pendentes: 0, pct: null };
  const pagadores = useQuery(
    consultaPagadores({ inicio: periodo.inicio, fim: periodo.fim, filiais: busca.filiais }),
  );

  const atualizar = (
    <Button
      size="sm"
      variant="ghost"
      disabled={painel.isFetching}
      onClick={() => {
        void painel.refetch();
      }}
    >
      <RefreshCw className={painel.isFetching ? "animate-spin" : undefined} aria-hidden />
      Atualizar
    </Button>
  );

  return (
    <Pagina
      titulo="Comprovantes"
      descricao="Entre as entregas concluídas, quantas já têm comprovante digitalizado (ocorrência 88)"
      meta={<SeloDosDados className="" />}
      acoes={
        <>
          {atualizar}
          <ExportMenu
            arquivo={`comprovantes-${busca.status}`}
            titulo={`Comprovantes — ${TITULO_DO_STATUS[busca.status]}`}
            subtitulo={subtitulo}
            colunas={colunasDaExportacao(COLUNAS_DA_LISTA)}
            linhas={[]}
            carregarLinhas={async () =>
              (await carregarListaInteira(filtros, busca.status)).map(linhaDaExportacao)
            }
            desabilitado={painel.isFetching}
          />
        </>
      }
      filtros={
        <>
          <FiltrosComprovantes
            busca={busca}
            periodo={periodo}
            pagadores={pagadores.data}
            tiposContagem={painel.data?.tiposContagem}
            filtrando={temFiltro(ativos, busca.periodo, NAO_SAO_FILTRO)}
            mudar={mudar}
            aoLimpar={() => {
              limpar(busca.periodo === "custom" ? ["size"] : ["periodo", "size"]);
            }}
          />
          <FiltrandoPor
            etiquetas={etiquetasQueLimpam(
              etiquetasDaBusca(busca, nomesDosPagadores(pagadores.data ?? [], busca.pagadores)),
              mudar,
            )}
          />
        </>
      }
    >
      {painel.isError ? (
        <MensagemErro
          erro={painel.error}
          titulo="Não foi possível carregar os comprovantes"
          aoTentarDeNovo={() => {
            void painel.refetch();
          }}
        />
      ) : (
        <>
          <CardsDeComprovantes totais={totais} abrir={abrir} />

          <GraficoPorDia porDia={painel.data?.porDia ?? []} carregando={painel.isLoading} />

          <TabelasDeResumo
            porUnidade={painel.data?.porUnidade ?? []}
            porTipoDocumento={painel.data?.porTipoDocumento ?? []}
            carregando={painel.isLoading}
            subtitulo={subtitulo}
          />
        </>
      )}

      <ListaDeComprovantes
        aberto={listaAberta}
        aoFechar={() => {
          setListaAberta(false);
        }}
        titulo={TITULO_DO_STATUS[busca.status]}
        descricao={subtitulo}
        colunas={COLUNAS_DA_LISTA}
        linhas={lista.data?.linhas ?? []}
        total={lista.data?.total ?? 0}
        carregando={lista.isLoading}
        erro={lista.error}
        aoTentarDeNovo={() => {
          void lista.refetch();
        }}
        pagina={busca.page}
        porPagina={busca.size}
        aoMudarPagina={(page) => {
          definir({ page });
        }}
      />
    </Pagina>
  );
}
