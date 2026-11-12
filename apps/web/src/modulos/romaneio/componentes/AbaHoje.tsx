import { hojeNoFuso } from "@erp/shared/datas";
import {
  formatarData,
  formatarInteiro,
  formatarMoeda,
  formatarPercentual,
} from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, FileText, PackageCheck, TrendingDown, Truck } from "lucide-react";
import { useState } from "react";

import { Aviso } from "@/componentes/comum/Aviso";
import { KpiCard } from "@/componentes/comum/KpiCard";
import { Painel } from "@/componentes/comum/Painel";

import { consultaHoje } from "../api";
import { type Abertura } from "../busca";
import { entradaDaHoje, type FiltrosHoje } from "../regras";
import { type Faixa, textoDoPrejuizo } from "../textos";
import { FaixasDePrazo } from "./FaixasDePrazo";
import { GavetaDaFaixa } from "./GavetaDaFaixa";
import { GradeDeIndicadores } from "./GradeDeIndicadores";
import { TabelaRomaneiosDeHoje } from "./TabelaRomaneiosDeHoje";

/**
 * Aba "Hoje" — romaneios emitidos no dia corrente (dia de Brasília), ao vivo. O recorte é pela
 * data de emissão DO ROMANEIO (relatório 036), não do CT-e. Prejuízo pelo código 13.
 */
export function AbaHoje({
  fuso,
  filtros,
  aoAbrir,
}: {
  fuso: string;
  filtros: FiltrosHoje;
  aoAbrir: (a: Abertura) => void;
}) {
  const [gaveta, setGaveta] = useState<{ faixa: Faixa; somenteEmRota: boolean } | null>(null);
  const q = useQuery(consultaHoje(entradaDaHoje(filtros)));
  const d = q.data;
  const dia = d?.dia ?? hojeNoFuso(fuso);
  const linhas = d?.linhas ?? [];
  const r = d?.resumo;
  const perf = r && r.ctes > 0 ? (r.entregues / r.ctes) * 100 : null;
  const emRota = r ? Math.max(0, r.ctes - r.entregues) : 0;
  const abrir = (faixa: Faixa, somenteEmRota: boolean) => {
    setGaveta({ faixa, somenteEmRota });
  };

  return (
    <>
      <Aviso tom="info">
        Romaneios emitidos hoje{d ? ` (${formatarData(d.dia)})` : ""} — o recorte usa a{" "}
        <strong>data de emissão do romaneio</strong> (campo DATA EMISSAO do relatório 036), não a
        data de emissão de cada CT-e. Visão ao vivo: atualiza sozinha a cada minuto e inclui viagens
        ainda em andamento. Esta aba não usa os filtros gerais da tela (período, parceiro): é sempre
        o dia de hoje, por romaneio. Para outros dias, use a aba “Performance por romaneio”.
      </Aviso>

      <GradeDeIndicadores max={5}>
        <KpiCard
          rotulo="Romaneios de hoje"
          icone={ClipboardList}
          neutro
          status="bom"
          valor={r ? formatarInteiro(r.romaneios) : "—"}
          detalhe=""
          dica="Quantidade de romaneios de entrega emitidos hoje."
        />
        <KpiCard
          rotulo="CT-e nos romaneios"
          icone={FileText}
          neutro
          status="bom"
          valor={r ? formatarInteiro(r.ctes) : "—"}
          detalhe={r ? `${formatarMoeda(r.frete, { centavos: false })} de frete` : ""}
        />
        <KpiCard
          rotulo="Já entregues"
          icone={PackageCheck}
          neutro={!(perf !== null && perf >= 90)}
          status="bom"
          valor={r ? formatarInteiro(r.entregues) : "—"}
          detalhe={
            perf !== null ? `${formatarPercentual(perf, { escala: "cem" })} de performance` : ""
          }
        />
        <KpiCard
          rotulo="Em rota de entrega"
          icone={Truck}
          neutro
          status="alerta"
          valor={r ? formatarInteiro(emRota) : "—"}
          detalhe={
            r ? `${formatarInteiro(r.ctes)} CT-e − ${formatarInteiro(r.entregues)} entregues` : ""
          }
          dica="CT-e nos romaneios − Já entregues: o que saiu hoje e ainda não foi entregue, inclusive o que recebeu ocorrência depois da saída. As faixas de “Em rota agora” somam este número."
        />
        <KpiCard
          rotulo="Prejuízo"
          icone={TrendingDown}
          neutro={!(r && r.prejuizoFrete > 0)}
          status="ruim"
          valor={r ? formatarMoeda(r.prejuizoFrete, { centavos: false }) : "—"}
          detalhe={[textoDoPrejuizo(undefined), r ? `${formatarInteiro(r.prejuizoCtes)} CT-e` : ""]
            .filter(Boolean)
            .join(" · ")}
        />
      </GradeDeIndicadores>

      <Painel classeDoCorpo="grid gap-6 px-5 py-4 lg:grid-cols-2">
        {/* Fotografia: o que nasceu em cada faixa (não diminui com a entrega). */}
        <FaixasDePrazo
          rotulo={`Total no romaneio${r ? ` (${formatarInteiro(r.ctes)} CT-e)` : ""}`}
          dica="Fotografia: TODOS os CT-e dos romaneios emitidos hoje, em qualquer status (em rota, entregue, devolvido, travado). Compara a data prevista com o dia de hoje, por isso a soma das faixas é igual ao total de CT-e. Este número NÃO diminui quando a carga é entregue — é o retrato do que nasceu em cada faixa. Clique para ver a lista."
          faixas={r?.prazo}
          aoAbrir={(faixa) => {
            abrir(faixa, false);
          }}
        />
        {/* Quebra do card "Em rota de entrega" por prazo. */}
        <FaixasDePrazo
          rotulo={`Em rota agora${r ? ` (${formatarInteiro(emRota)} CT-e)` : ""}`}
          dica="Os mesmos CT-e do card “Em rota de entrega” (CT-e nos romaneios − Já entregues), separados pelo prazo: a soma das faixas é igual ao card. Inclui quem recebeu ocorrência depois da saída (ausente, recusa, pendência…) e ainda não foi entregue. Clique para ver a lista."
          faixas={r?.prazoNaoEntregue}
          aoAbrir={(faixa) => {
            abrir(faixa, true);
          }}
        />
      </Painel>

      <GavetaDaFaixa
        faixa={gaveta?.faixa ?? null}
        somenteEmRota={gaveta?.somenteEmRota ?? false}
        filtros={filtros}
        aoFechar={() => {
          setGaveta(null);
        }}
      />

      <TabelaRomaneiosDeHoje
        linhas={linhas}
        dia={dia}
        carregando={q.isLoading}
        erro={q.error}
        aoTentarDeNovo={() => void q.refetch()}
        aoAbrir={aoAbrir}
      />
    </>
  );
}
