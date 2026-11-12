// origem: features/romaneio/Fase2Views.tsx (sistema atual)
import { formatarData, formatarDiaMes } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { Banknote, MapPin, TrendingDown, UserRound } from "lucide-react";

import { Aviso } from "@/componentes/comum/Aviso";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { GraficoBarras } from "@/componentes/comum/Graficos";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";

import { consultaPrejuizo } from "../api";
import { type Abertura, type PropsDaAba } from "../busca";
import { textoDoPrejuizo } from "../textos";
import { AtribuicaoLegenda } from "./AtribuicaoLegenda";
import { DicaDoPrejuizo } from "./DicaDoPrejuizo";
import { RankingDoPrejuizo } from "./RankingDoPrejuizo";
import { TituloDoBloco } from "./TituloDoBloco";

/** Aba Prejuízo: frete das cargas prejudicadas por dia e rankings (janela = período, Q14). */
export function AbaPrejuizo({ filtros, aoAbrir }: PropsDaAba) {
  const q = useQuery(consultaPrejuizo(filtros));
  const d = q.data;
  const porDia = d?.porDia ?? [];
  const prejuizo: Abertura = { recorte: "prejuizo" };
  const ranking = (
    linhas: readonly { nome: string; placa: string | null; ctes: number; frete: number }[],
    abertura: (nome: string) => Abertura,
  ) => linhas.map((l) => ({ ...l, abertura: abertura(l.nome) }));
  return (
    <>
      <AtribuicaoLegenda codigos={filtros.codigos} />
      <Aviso tom="info">
        Prejuízo aqui são as cargas com {textoDoPrejuizo(filtros.codigos)}. Sem filtro de código, o
        padrão é o código 13 (Entrega Prejudicada). Os totais estão no card Prejuízo do topo;
        abaixo, o frete dessas cargas por dia e onde ele se concentra.
      </Aviso>
      <Painel
        icone={TrendingDown}
        titulo={
          <TituloDoBloco dica="Valor de frete comprometido em cada dia do período. Passe o mouse para ver a quantidade de cargas.">
            Prejuízo por dia
          </TituloDoBloco>
        }
        acoes={
          <ExportMenu
            arquivo="romaneio-prejuizo-tendencia"
            titulo="Prejuízo por dia"
            colunas={[
              { chave: "dia", titulo: "Dia", formato: "data" },
              { chave: "ctes", titulo: "CTRC", formato: "inteiro" },
              { chave: "frete", titulo: "Frete", formato: "moeda" },
            ]}
            linhas={porDia}
            soIcone
          />
        }
      >
        {q.isError ? (
          <MensagemErro
            erro={q.error}
            titulo="Não foi possível carregar os dados do gráfico"
            aoTentarDeNovo={() => void q.refetch()}
          />
        ) : (
          <GraficoBarras
            dados={porDia.map((x) => ({ ...x, rotulo: formatarDiaMes(x.dia) }))}
            eixoX="rotulo"
            series={[{ chave: "frete", nome: "Frete", cor: "var(--status-bad)" }]}
            formato="inteiro"
            altura={240}
            carregando={q.isLoading}
            mensagemVazia="Nenhum prejuízo registrado no período."
            descricao="Prejuízo por dia: frete das cargas prejudicadas em cada dia do período"
            dica={(x) => (
              <DicaDoPrejuizo titulo={formatarData(x.dia)} frete={x.frete} ctes={x.ctes} />
            )}
          />
        )}
      </Painel>
      <div className="grid gap-4 lg:grid-cols-3">
        <RankingDoPrejuizo
          titulo="Cidades"
          icone={MapPin}
          dica="Cidades de destino onde o prejuízo se concentra no período."
          carregando={q.isLoading}
          linhas={ranking(d?.cidades ?? [], () => prejuizo)}
          arquivo="romaneio-prejuizo-cidade"
          aoAbrir={aoAbrir}
        />
        <RankingDoPrejuizo
          titulo="Pagadores"
          icone={Banknote}
          dica="Clientes pagadores das cargas com prejuízo no período."
          carregando={q.isLoading}
          linhas={ranking(d?.pagadores ?? [], () => prejuizo)}
          arquivo="romaneio-prejuizo-pagador"
          aoAbrir={aoAbrir}
        />
        <RankingDoPrejuizo
          titulo="Motoristas"
          icone={UserRound}
          dica="Motoristas e placas envolvidos nas cargas com prejuízo. Clique para ver as cargas do motorista."
          carregando={q.isLoading}
          linhas={ranking(d?.motoristas ?? [], (nome) => ({
            recorte: "prejuizo",
            motorista: nome,
          }))}
          arquivo="romaneio-prejuizo-motorista"
          aoAbrir={aoAbrir}
        />
      </div>
    </>
  );
}
