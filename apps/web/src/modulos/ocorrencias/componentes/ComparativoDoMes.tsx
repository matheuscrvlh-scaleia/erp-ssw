import { type PainelDeOcorrencias } from "@erp/shared/contratos/ocorrencias";
import { formatarDiaMes, formatarInteiro } from "@erp/shared/formatacao";
import { ChartColumn } from "lucide-react";

import { GraficoBarras } from "@/componentes/comum/Graficos";
import { Painel } from "@/componentes/comum/Painel";

import { type RecortesDosBlocos } from "../busca";
import { TituloComDica } from "./TituloComDica";

/** Top 10 códigos: barra do período ao lado da barra das mesmas datas no mês anterior. */
export function ComparativoDoMes({
  painel,
  carregando,
  periodo,
  r,
}: {
  painel: PainelDeOcorrencias | undefined;
  carregando: boolean;
  periodo: { inicio: string; fim: string };
  r: RecortesDosBlocos;
}) {
  const anterior = painel?.periodoAnterior;
  const dados = (painel?.topCodigos ?? []).map((c) => ({
    rotulo: `#${String(c.codigo)}`,
    codigo: c.codigo,
    descricao: c.descricao,
    atual: c.count,
    anterior: c.countAnterior,
  }));
  return (
    <Painel
      titulo={
        <TituloComDica
          titulo="Ocorrências: mês atual × mês anterior"
          dica="Os 10 códigos com mais ocorrências no período, cada ocorrência contada (um CT-e com três 13 conta três vezes). A barra cinza são as mesmas datas um mês antes, com os mesmos filtros. Clique numa barra para filtrar a tela pelo código."
        />
      }
      descricao={carregando ? "carregando…" : "clique numa barra para filtrar pelo código"}
      icone={ChartColumn}
    >
      <GraficoBarras
        descricao="Ocorrências por código no período e nas mesmas datas do mês anterior"
        dados={dados}
        eixoX="rotulo"
        altura={300}
        formato="inteiro"
        carregando={carregando}
        mensagemVazia="Nenhuma ocorrência no recorte atual."
        series={[
          {
            chave: "atual",
            nome: `Atual (${formatarDiaMes(periodo.inicio)}–${formatarDiaMes(periodo.fim)})`,
            cor: "var(--brand)",
          },
          {
            chave: "anterior",
            nome: anterior
              ? `Mês anterior (${formatarDiaMes(anterior.inicio)}–${formatarDiaMes(anterior.fim)})`
              : "Mês anterior",
            cor: "var(--grafico-comparacao)",
          },
        ]}
        dica={(d) => (
          <div className="text-xs font-semibold">
            <p>
              {d.rotulo} {d.descricao}
            </p>
            <p>
              Atual {formatarInteiro(d.atual)} · anterior {formatarInteiro(d.anterior)}
            </p>
          </div>
        )}
        aoClicarBarra={(d) => {
          r.aoCodigo(r.codigo === d.codigo ? null : d.codigo);
        }}
      />
    </Painel>
  );
}
