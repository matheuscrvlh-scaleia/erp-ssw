import {
  type LinhaDeComprovante,
  type PainelDeComprovantes,
  type StatusDeComprovante,
} from "@erp/shared/contratos/comprovantes";
import { hojeNoFuso } from "@erp/shared/datas";
import {
  formatarData,
  formatarDiaMes,
  formatarInteiro,
  formatarPercentual,
} from "@erp/shared/formatacao";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChartColumn, FileCheck2, FileClock, PackageCheck, Percent, RefreshCw } from "lucide-react";
import { useState } from "react";

import { DrawerDetalhe } from "@/componentes/comum/Detalhe";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import {
  etiquetasQueLimpam,
  FiltrandoPor,
  FiltrosAvancados,
} from "@/componentes/comum/FiltrosAvancados";
import { GraficoBarras } from "@/componentes/comum/Graficos";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { KpiCard } from "@/componentes/comum/KpiCard";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { resolverPeriodo } from "@/componentes/comum/periodo";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela } from "@/componentes/comum/tabela-dados";
import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Pagina } from "@/componentes/layout/Pagina";
import { SeloDosDados } from "@/componentes/layout/SeloDosDados";
import { Button } from "@/componentes/ui/button";
import { temFiltro } from "@/hooks/filtros-na-url";
import { useFiltrosNaUrl } from "@/hooks/use-filtros-na-url";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { COLUNA_LINK_SSW, urlCtrcNoSsw } from "@/lib/exportacao";
import { consultaPagadores } from "@/modulos/filtros/api";
import {
  BuscaDocumento,
  type ContextoDosFiltros,
  SeletorDeFilial,
  SeletorDePagador,
  SeletorDeTexto,
  SeletorDeTipoDocumento,
} from "@/modulos/filtros/componentes";
import { nomesDosPagadores } from "@/modulos/filtros/regras";

import { carregarListaInteira, consultaLista, consultaPainel } from "./api";
import { esquemaDaBusca, etiquetasDaBusca, filtrosDaBusca, NAO_SAO_FILTRO } from "./busca";

const TITULO_DO_STATUS: Record<StatusDeComprovante, string> = {
  todos: "CT-e entregues",
  digitalizados: "Comprovantes digitalizados",
  pendentes: "Comprovantes pendentes",
};

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

type LinhaResumo = Omit<PainelDeComprovantes["porUnidade"][number], "unidade"> & {
  chave: string;
};

const colunasDoResumo = (coluna: string): ColunaTabela<LinhaResumo>[] => [
  { chave: "chave", titulo: coluna, classe: "font-mono" },
  { chave: "entregues", titulo: "Entregues", formato: "inteiro" },
  { chave: "digitalizados", titulo: "Digitalizados", formato: "inteiro" },
  { chave: "pendentes", titulo: "Pendentes", formato: "inteiro" },
  { chave: "pct", titulo: "%", formato: "percentual" },
];

const pct = (p: number | null) => (p === null ? "—" : formatarPercentual(p));

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
  const contexto: ContextoDosFiltros = {
    inicio: periodo.inicio,
    fim: periodo.fim,
    parceiros: busca.pagadores,
    remetente: busca.remetente,
    destino: busca.destino,
  };

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
            colunas={COLUNAS_DA_LISTA.map(({ chave, titulo, formato }) => ({
              chave,
              titulo,
              formato,
            }))}
            linhas={[]}
            carregarLinhas={async () =>
              (await carregarListaInteira(filtros, busca.status)).map((l) => ({
                ...l,
                digitalizado: l.digitalizado ? "Digitalizado" : "Pendente",
                linkSsw: urlCtrcNoSsw(l.siglaCtrc, l.numeroCtrc, l.dataEmissao),
              }))
            }
            desabilitado={painel.isFetching}
          />
        </>
      }
      filtros={
        <>
          <FiltrosAvancados
            ativos={temFiltro(ativos, busca.periodo, NAO_SAO_FILTRO)}
            aoLimpar={() => {
              limpar(busca.periodo === "custom" ? ["size"] : ["periodo", "size"]);
            }}
          >
            <FiltroPeriodo
              periodo={busca.periodo}
              de={busca.de}
              ate={busca.ate}
              rotulo="Entrega"
              aoMudar={mudar}
            />
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              por data de entrega
              <InfoTip texto="O período filtra pelo dia da entrega concluída em Brasília (data de entrega realizada ou, na falta dela, a data da ocorrência de conclusão)." />
            </span>
            <SeletorDeFilial
              selecionadas={busca.filiais}
              contexto={contexto}
              aoMudar={(filiais) => {
                mudar({ filiais });
              }}
            />
            <SeletorDePagador
              rotulo="Pagador"
              opcoes={pagadores.data}
              selecionados={busca.pagadores}
              aoMudar={(pagadores) => {
                mudar({ pagadores });
              }}
            />
            <SeletorDeTexto
              rotulo="Remetente"
              campo="remetente"
              valor={busca.remetente}
              contexto={contexto}
              aoMudar={(remetente) => {
                mudar({ remetente });
              }}
            />
            <SeletorDeTexto
              rotulo="Destino"
              campo="cidade_destino"
              valor={busca.destino}
              contexto={contexto}
              aoMudar={(destino) => {
                mudar({ destino });
              }}
            />
            <SeletorDeTipoDocumento
              selecionados={busca.tipos}
              contagens={painel.data?.tiposContagem}
              aoMudar={(tipos) => {
                mudar({ tipos });
              }}
            />
            <BuscaDocumento
              valor={busca.ctrc}
              placeholder="CTRC..."
              className="w-[150px]"
              aoMudar={(ctrc) => {
                mudar({ ctrc });
              }}
            />
            <BuscaDocumento
              valor={busca.nf}
              placeholder="Nota fiscal..."
              className="w-[150px]"
              aoMudar={(nf) => {
                mudar({ nf });
              }}
            />
          </FiltrosAvancados>
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              rotulo="CT-e entregue"
              valor={formatarInteiro(totais.entregues)}
              status="bom"
              neutro
              icone={PackageCheck}
              detalhe="Período completo"
              aoClicar={() => {
                abrir("todos");
              }}
            />
            <KpiCard
              rotulo="Digitalizados"
              valor={formatarInteiro(totais.digitalizados)}
              status="bom"
              icone={FileCheck2}
              detalhe="Com ocorrência 88"
              aoClicar={() => {
                abrir("digitalizados");
              }}
            />
            <KpiCard
              rotulo="% digitalizados"
              valor={pct(totais.pct)}
              status="bom"
              icone={Percent}
              progresso={totais.pct ?? undefined}
              detalhe="Digitalizados ÷ entregues (dias com o 930 importado)"
              aoClicar={() => {
                abrir("digitalizados");
              }}
            />
            <KpiCard
              rotulo="Pendentes"
              valor={formatarInteiro(totais.pendentes)}
              status="ruim"
              icone={FileClock}
              detalhe="Sem ocorrência 88"
              aoClicar={() => {
                abrir("pendentes");
              }}
            />
          </div>

          <Painel titulo="Tendência por dia de entrega" icone={ChartColumn}>
            <GraficoBarras
              descricao="Entregues e digitalizados por dia de entrega"
              dados={(painel.data?.porDia ?? []).map((d) => ({
                ...d,
                rotulo: formatarDiaMes(d.dia),
              }))}
              eixoX="rotulo"
              formato="inteiro"
              carregando={painel.isLoading}
              series={[
                { chave: "entregues", nome: "Entregues", cor: "var(--grafico-comparacao)" },
                { chave: "digitalizados", nome: "Digitalizados", cor: "var(--brand)" },
              ]}
              dica={(d) => (
                <div className="text-xs">
                  <p className="font-semibold">{formatarData(d.dia)}</p>
                  <p>
                    {formatarInteiro(d.digitalizados)} de {formatarInteiro(d.entregues)} ·{" "}
                    {pct(d.pct)}
                  </p>
                  {!d.coberto && <p className="text-muted-foreground">Sem o 930 deste dia</p>}
                </div>
              )}
            />
          </Painel>

          <div className="grid gap-4 2xl:grid-cols-2">
            <TabelaDados
              titulo="Por unidade"
              colunas={colunasDoResumo("Unidade")}
              linhas={(painel.data?.porUnidade ?? []).map((u) => ({ ...u, chave: u.unidade }))}
              chaveDaLinha={(l) => l.chave}
              carregando={painel.isLoading}
              porPagina={0}
              exportacao={{
                arquivo: "comprovantes-por-unidade",
                titulo: "Comprovantes por unidade",
                subtitulo,
              }}
            />
            <TabelaDados
              titulo="Por tipo de documento"
              colunas={colunasDoResumo("Tipo")}
              linhas={(painel.data?.porTipoDocumento ?? []).map((t) => ({
                ...t,
                chave: t.tipoDocumento,
              }))}
              chaveDaLinha={(l) => l.chave}
              carregando={painel.isLoading}
              porPagina={0}
              exportacao={{
                arquivo: "comprovantes-por-tipo",
                titulo: "Comprovantes por tipo de documento",
                subtitulo,
              }}
            />
          </div>
        </>
      )}

      <DrawerDetalhe
        aberto={listaAberta}
        aoFechar={() => {
          setListaAberta(false);
        }}
        titulo={TITULO_DO_STATUS[busca.status]}
        descricao={subtitulo}
        largura="larga"
      >
        <TabelaDados
          colunas={COLUNAS_DA_LISTA}
          linhas={lista.data?.linhas ?? []}
          chaveDaLinha={(l) => l.id}
          carregando={lista.isLoading}
          erro={lista.error}
          aoTentarDeNovo={() => {
            void lista.refetch();
          }}
          mensagemVazia="Nenhum CT-e neste recorte."
          paginacaoServidor={{
            pagina: busca.page,
            porPagina: busca.size,
            total: lista.data?.total ?? 0,
            aoMudarPagina: (page) => {
              definir({ page });
            },
          }}
          rotuloTotal={(n) => `${formatarInteiro(n)} CT-e`}
        />
      </DrawerDetalhe>
    </Pagina>
  );
}
