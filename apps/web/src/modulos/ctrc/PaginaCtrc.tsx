import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, RefreshCw, SearchX } from "lucide-react";

import { consultaAcesso } from "@/acesso/sessao";
import { Aviso } from "@/componentes/comum/Aviso";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { Painel } from "@/componentes/comum/Painel";
import { Pagina } from "@/componentes/layout/Pagina";
import { SeloDosDados } from "@/componentes/layout/SeloDosDados";
import { Button } from "@/componentes/ui/button";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { urlCtrcNoSsw } from "@/lib/exportacao";
import { cn } from "@/lib/utils";

import { consultaCtrc } from "./api";
import { DetalheDoCtrc } from "./componentes/DetalheDoCtrc";
import { EscolhaDeSerie } from "./componentes/EscolhaDeSerie";
import { EsqueletoDoCtrc } from "./componentes/EsqueletoDoCtrc";
import { TituloDoCtrc } from "./componentes/TituloDoCtrc";
import { COLUNAS_DO_PDF, linhasDoPdf } from "./exportacao";
import { identificacao } from "./textos";

const rota = getRouteApi("/_autenticado/ctrc/$numero");

/**
 * Detalhe do CT-e pela série + número (Q02). Número repetido entre séries sem a série na URL:
 * a tela pede a escolha.
 * origem: src/routes/_authenticated/ctrc.$numero.tsx (sistema atual)
 */
export function PaginaCtrc() {
  const { numero } = rota.useParams();
  const { sigla } = rota.useSearch();
  const router = useRouter();
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const nomeCurto = acesso.empresa?.nomeCurto ?? "transportadora";
  const fuso = useFusoDaEmpresa();
  const { data, isLoading, isError, refetch, isFetching } = useQuery(consultaCtrc(numero, sigla));
  const ctrc = data?.tipo === "encontrado" ? data.ctrc : null;
  const ssw = ctrc ? urlCtrcNoSsw(ctrc.sigla, ctrc.numero, ctrc.dataEmissao) : null;
  const id = identificacao(ctrc?.numeroNf ?? null, ctrc?.numero ?? numero);

  return (
    <Pagina
      titulo={<TituloDoCtrc rotulo={id.rotulo} principal={id.principal} />}
      descricao={
        <>
          {id.secundario ? `CTRC ${ctrc?.sigla ?? ""} ${id.secundario} · ` : ""}
          Detalhes do conhecimento de transporte
        </>
      }
      meta={<SeloDosDados className="" />}
      acoes={
        <>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              router.history.back();
            }}
          >
            <ArrowLeft aria-hidden /> Voltar
          </Button>
          {ssw && (
            <Button asChild size="sm" variant="outline">
              <a
                href={ssw}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir este CTRC no SSW"
              >
                <ExternalLink aria-hidden />
                Abrir no SSW
              </a>
            </Button>
          )}
          {ctrc && (
            <ExportMenu
              arquivo={`ctrc-${ctrc.sigla}-${ctrc.numero}`}
              titulo={`CT-e ${ctrc.sigla} ${ctrc.numero}`}
              subtitulo={ctrc.destinatario ?? undefined}
              colunas={COLUNAS_DO_PDF}
              linhas={linhasDoPdf(ctrc, fuso)}
              formatos={["pdf"]}
              orientacao="retrato"
            />
          )}
          <Button size="sm" variant="ghost" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={cn(isFetching && "animate-spin")} aria-hidden /> Atualizar
          </Button>
        </>
      }
    >
      {isLoading && <EsqueletoDoCtrc />}

      {isError && (
        <Aviso
          tom="erro"
          titulo="Falha ao carregar CTRC."
          acao={
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              <RefreshCw aria-hidden /> Tentar novamente
            </Button>
          }
        />
      )}

      {data?.tipo === "nao_encontrado" && (
        <Painel>
          <EstadoVazio
            icone={SearchX}
            mensagem={`CTRC ${sigla ? `${sigla} ${numero}` : numero} não encontrado.`}
          />
        </Painel>
      )}

      {data?.tipo === "varios" && <EscolhaDeSerie numero={numero} opcoes={data.opcoes} />}

      {ctrc && <DetalheDoCtrc ctrc={ctrc} nomeCurto={nomeCurto} fuso={fuso} />}
    </Pagina>
  );
}
