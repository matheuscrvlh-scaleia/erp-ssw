import {
  type LinhaDeComprovante,
  type PainelDeComprovantes,
  type StatusDeComprovante,
} from "@erp/shared/contratos/comprovantes";
import { SEM_TIPO_DOCUMENTO } from "@erp/shared/contratos/ocorrencias";
import { hojeNoFuso } from "@erp/shared/datas";
import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { consultaAcesso } from "@/acesso/sessao";
import { DrawerDetalhe } from "@/componentes/comum/Detalhe";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import { FiltrandoPor, FiltrosAvancados } from "@/componentes/comum/FiltrosAvancados";
import { FiltroTexto } from "@/componentes/comum/FiltroTexto";
import { GraficoBarras } from "@/componentes/comum/Graficos";
import { KpiCard } from "@/componentes/comum/KpiCard";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { resolverPeriodo } from "@/componentes/comum/periodo";
import { type ColunaTabela } from "@/componentes/comum/tabela-dados";
import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";
import { useFiltrosNaUrl } from "@/hooks/use-filtros-na-url";
import { COLUNA_LINK_SSW, urlCtrcNoSsw } from "@/lib/exportacao";
import { CampoDeTexto, listaDoTexto } from "@/modulos/compartilhado/CampoDeTexto";
import { data, diaMes, inteiro, percentual } from "@/modulos/compartilhado/formatos";
import { InfoTip } from "@/modulos/compartilhado/InfoTip";
import { SeloDosDados } from "@/modulos/ingestao-ssw/SeloDosDados";

import { carregarListaInteira, consultaLista, consultaPainel } from "./api";
import { esquemaDaBusca, etiquetasDaBusca, filtrosDaBusca, temFiltro } from "./busca";

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
        <span className="text-emerald-700">Digitalizado</span>
      ) : (
        <span className="text-[var(--status-bad)]">Pendente</span>
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

const pct = (p: number | null) => (p === null ? "—" : percentual(p));

export function PaginaComprovantes() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const fuso = acesso.empresa?.fuso ?? "America/Sao_Paulo";
  const { filtros: busca, definir, limpar, ativos } = useFiltrosNaUrl(esquemaDaBusca);
  const periodo = resolverPeriodo(busca.periodo, busca.de, busca.ate, hojeNoFuso(fuso));
  const filtros = filtrosDaBusca(busca, periodo);
  const subtitulo = `Entrega de ${data(periodo.inicio)} a ${data(periodo.fim)}`;

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
  const tipos = painel.data?.tiposContagem.map((t) => ({
    valor: t.tipo,
    rotulo: t.tipo === SEM_TIPO_DOCUMENTO ? "Sem tipo" : t.tipo,
    detalhe: inteiro(t.qtd),
  }));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-medium tracking-tight">Comprovantes</h1>
          <SeloDosDados />
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Entre as entregas concluídas, quantas já têm comprovante digitalizado (ocorrência 88)
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button
            size="sm"
            variant="ghost"
            disabled={painel.isFetching}
            onClick={() => {
              void painel.refetch();
            }}
          >
            <RefreshCw className={`mr-1.5 h-3 w-3 ${painel.isFetching ? "animate-spin" : ""}`} />{" "}
            Atualizar
          </Button>
        </div>
      </header>

      <FiltrosAvancados
        ativos={temFiltro(ativos, busca)}
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
        <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
          por data de entrega
          <InfoTip texto="O período filtra pelo dia da entrega concluída em Brasília (data de entrega realizada ou, na falta dela, a data da ocorrência de conclusão)." />
        </span>
        <CampoDeTexto
          rotulo="Unidade responsável"
          placeholder="Unidade (RIO, SPO)"
          valor={busca.filiais.join(", ")}
          aoConfirmar={(texto) => {
            mudar({ filiais: listaDoTexto(texto) });
          }}
        />
        <FiltroTexto
          rotulo="Remetente"
          valor={busca.remetente}
          aoMudar={(remetente) => {
            mudar({ remetente });
          }}
        />
        <FiltroTexto
          rotulo="Destino"
          valor={busca.destino}
          aoMudar={(destino) => {
            mudar({ destino });
          }}
        />
        <FiltroMultiplo
          rotulo="Tipo documento"
          opcoes={tipos}
          selecionados={busca.tipos}
          aoMudar={(t) => {
            mudar({ tipos: t });
          }}
        />
        <CampoDeTexto
          rotulo="CTRC"
          placeholder="CTRC..."
          valor={busca.ctrc}
          aoConfirmar={(ctrc) => {
            mudar({ ctrc });
          }}
        />
        <CampoDeTexto
          rotulo="Nota fiscal"
          placeholder="Nota fiscal..."
          valor={busca.nf}
          aoConfirmar={(nf) => {
            mudar({ nf });
          }}
        />
      </FiltrosAvancados>
      <FiltrandoPor
        etiquetas={etiquetasDaBusca(busca).map((e) => ({
          ...e,
          limpar: () => {
            mudar(e.limpar);
          },
        }))}
      />

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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              rotulo="CT-e entregue"
              valor={inteiro(totais.entregues)}
              status="bom"
              detalhe="Período completo"
              aoClicar={() => {
                abrir("todos");
              }}
            />
            <KpiCard
              rotulo="Digitalizados"
              valor={inteiro(totais.digitalizados)}
              status="bom"
              detalhe="Com ocorrência 88"
              aoClicar={() => {
                abrir("digitalizados");
              }}
            />
            <KpiCard
              rotulo="% digitalizados"
              valor={pct(totais.pct)}
              status="bom"
              detalhe="Digitalizados ÷ entregues (dias com o 930 importado)"
              aoClicar={() => {
                abrir("digitalizados");
              }}
            />
            <KpiCard
              rotulo="Pendentes"
              valor={inteiro(totais.pendentes)}
              status="ruim"
              detalhe="Sem ocorrência 88"
              aoClicar={() => {
                abrir("pendentes");
              }}
            />
          </div>

          <section className="rounded-[10px] border border-border/70 bg-card p-4">
            <h2 className="label-xs mb-2">Tendência por dia de entrega</h2>
            <GraficoBarras
              descricao="Entregues e digitalizados por dia de entrega"
              dados={(painel.data?.porDia ?? []).map((d) => ({ ...d, rotulo: diaMes(d.dia) }))}
              eixoX="rotulo"
              formato="inteiro"
              carregando={painel.isLoading}
              series={[
                { chave: "entregues", nome: "Entregues", cor: "var(--muted-foreground)" },
                { chave: "digitalizados", nome: "Digitalizados", cor: "var(--brand)" },
              ]}
              dica={(d) => (
                <div className="text-[12px]">
                  <p className="font-semibold">{data(d.dia)}</p>
                  <p>
                    {inteiro(d.digitalizados)} de {inteiro(d.entregues)} · {pct(d.pct)}
                  </p>
                  {!d.coberto && <p className="text-muted-foreground">Sem o 930 deste dia</p>}
                </div>
              )}
            />
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
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
          rotuloTotal={(n) => `${inteiro(n)} CT-e`}
        />
      </DrawerDetalhe>
    </div>
  );
}
