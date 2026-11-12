import { type LinhaDeColeta, type PainelDeColetas } from "@erp/shared/contratos/coletas";
import { hojeNoFuso } from "@erp/shared/datas";
import { formatarData, formatarDataHora } from "@erp/shared/formatacao";
import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { FileUp, RefreshCw } from "lucide-react";
import { useState } from "react";

import { pode } from "@/acesso/permissao";
import { consultaAcesso } from "@/acesso/sessao";
import { Aviso } from "@/componentes/comum/Aviso";
import { DrawerDetalhe } from "@/componentes/comum/Detalhe";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { resolverPeriodo } from "@/componentes/comum/periodo";
import { SeloAtualizacao } from "@/componentes/comum/SeloAtualizacao";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { useFiltrosNaUrl } from "@/hooks/use-filtros-na-url";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";

import { carregarListaInteira, consultaLista, consultaPainel } from "./api";
import { type BuscaColetas, esquemaDaBusca, filtrosDaBusca } from "./busca";
import { CartoesColetas } from "./componentes/CartoesColetas";
import { DetalheDaColeta } from "./componentes/DetalheDaColeta";
import { FiltrosColetas } from "./componentes/FiltrosColetas";
import { GraficoColetasPorDia } from "./componentes/GraficoColetasPorDia";
import { ModalDeImportacao050 } from "./componentes/ModalDeImportacao050";
import { TabelaColetas } from "./componentes/TabelaColetas";
import { TabelaPorSolicitante } from "./componentes/TabelaPorSolicitante";
import { TabelaPorTipoDeCte } from "./componentes/TabelaPorTipoDeCte";
import { TabelaPorUnidade } from "./componentes/TabelaPorUnidade";

const TAMANHO_DA_PAGINA = 50;

export function PaginaColetas() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const fuso = useFusoDaEmpresa();
  const podeImportar = pode(acesso, "coletas", "editar");
  const { filtros: busca, definir, limpar, ativos } = useFiltrosNaUrl(esquemaDaBusca);
  const periodo = resolverPeriodo(busca.periodo, busca.de, busca.ate, hojeNoFuso(fuso), "30d");
  const filtros = filtrosDaBusca(busca, periodo);
  const subtitulo = `Cadastro de ${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}`;

  const [importando, setImportando] = useState(false);
  const [aberta, setAberta] = useState<LinhaDeColeta | null>(null);
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(1);
  const painel = useQuery(consultaPainel(filtros));
  const lista = useQuery({
    ...consultaLista(filtros, {
      status: busca.status,
      busca: termo,
      pagina,
      tamanho: TAMANHO_DA_PAGINA,
    }),
    placeholderData: keepPreviousData,
  });
  const mudar = (m: Partial<BuscaColetas>) => {
    setPagina(1);
    definir(m);
  };
  const d: PainelDeColetas | undefined = painel.data;

  const atualizando = painel.isFetching;
  const unidades = d?.opcoes.unidades ?? [];

  return (
    <Pagina
      titulo="Coletas"
      descricao={
        <>
          Ordens de coleta do SSW (relatório 050)
          {d?.cobertura.inicio && d.cobertura.fim && (
            <>
              {" "}
              · coletas importadas de {formatarData(d.cobertura.inicio)} a{" "}
              {formatarData(d.cobertura.fim)}
            </>
          )}
        </>
      }
      meta={d && <SeloAtualizacao atualizadoEm={d.posicaoEm} fuso={fuso} />}
      acoes={
        <>
          <Button
            size="sm"
            variant="ghost"
            disabled={atualizando}
            onClick={() => {
              void painel.refetch();
              void lista.refetch();
            }}
          >
            <RefreshCw className={atualizando ? "animate-spin" : undefined} aria-hidden />
            Atualizar
          </Button>
          {podeImportar && (
            <Button
              size="sm"
              onClick={() => {
                setImportando(true);
              }}
            >
              <FileUp aria-hidden />
              Importar 050
            </Button>
          )}
        </>
      }
      filtros={
        <FiltrosColetas
          busca={busca}
          ativos={ativos}
          unidades={unidades}
          aoMudar={mudar}
          aoLimpar={() => {
            setPagina(1);
            limpar(busca.periodo === "custom" ? [] : ["periodo"]);
          }}
        />
      }
    >
      {painel.isError && (
        <MensagemErro
          erro={painel.error}
          titulo="Não foi possível carregar as coletas"
          aoTentarDeNovo={() => {
            void painel.refetch();
          }}
        />
      )}
      {d && d.posicaoEm === null && (
        <Aviso tom="info" titulo="Nenhuma coleta importada ainda.">
          {podeImportar
            ? "Importe o relatório 050 pelo botão “Importar 050”."
            : "Peça a um administrador para importar o relatório 050."}
        </Aviso>
      )}

      {!painel.isError && (
        <>
          <CartoesColetas totais={d?.totais} status={busca.status} aoMudar={mudar} />

          <GraficoColetasPorDia porDia={d?.porDia} carregando={painel.isLoading} />

          <div className="grid items-start gap-4 xl:grid-cols-3">
            <TabelaPorSolicitante
              linhas={d?.porSolicitante ?? []}
              carregando={painel.isLoading}
              solicitantes={busca.solicitantes}
              subtitulo={subtitulo}
              aoMudar={mudar}
            />
            <TabelaPorTipoDeCte linhas={d?.porTipoCtrc ?? []} carregando={painel.isLoading} />
          </div>
          <TabelaPorUnidade
            linhas={d?.porUnidade ?? []}
            carregando={painel.isLoading}
            subtitulo={subtitulo}
          />
        </>
      )}

      <TabelaColetas
        fuso={fuso}
        linhas={lista.data?.linhas ?? []}
        total={lista.data?.total ?? 0}
        carregando={lista.isLoading}
        erro={lista.error}
        aoTentarDeNovo={() => {
          void lista.refetch();
        }}
        aberta={aberta}
        aoAbrir={setAberta}
        pagina={pagina}
        porPagina={TAMANHO_DA_PAGINA}
        aoMudarPagina={setPagina}
        status={busca.status}
        termo={termo}
        aoMudarTermo={(t) => {
          setPagina(1);
          setTermo(t);
        }}
        subtitulo={subtitulo}
        carregarLinhas={() => carregarListaInteira(filtros, busca.status, termo)}
        aoMudar={mudar}
      />

      <DrawerDetalhe
        aberto={aberta !== null}
        aoFechar={() => {
          setAberta(null);
        }}
        titulo={aberta ? `Coleta ${aberta.unidade} ${String(aberta.numero)}` : ""}
        descricao={
          aberta?.cadastradaEm
            ? `Cadastro ${formatarDataHora(aberta.cadastradaEm, fuso)}`
            : undefined
        }
      >
        {aberta && <DetalheDaColeta coleta={aberta} fuso={fuso} />}
      </DrawerDetalhe>

      {podeImportar && (
        <ModalDeImportacao050 aberto={importando} aoMudarAberto={setImportando} fuso={fuso} />
      )}
    </Pagina>
  );
}
