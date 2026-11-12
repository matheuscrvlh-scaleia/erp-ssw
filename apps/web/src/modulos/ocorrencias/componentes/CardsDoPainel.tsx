import { type FiltrosDeCte, type PainelDeOcorrencias } from "@erp/shared/contratos/ocorrencias";
import { formatarInteiro, formatarParticipacao } from "@erp/shared/formatacao";
import { CircleHelp, ClipboardList, ShieldAlert, ShieldCheck } from "lucide-react";

import { KpiCard } from "@/componentes/comum/KpiCard";

import { type BuscaOcorrencias } from "../busca";
import { CodigosDoCard } from "./CodigosDoCard";

/** Os quatro cards do topo; clicar recorta a tela pelo responsável. */
export function CardsDoPainel({
  metricas: m,
  busca,
  filtros,
  nomeCurto,
  mudar,
}: {
  metricas: PainelDeOcorrencias["metricas"];
  busca: BuscaOcorrencias;
  filtros: FiltrosDeCte;
  nomeCurto: string;
  mudar: (m: Partial<BuscaOcorrencias>) => void;
}) {
  const alternarCard = (resp: BuscaOcorrencias["resp"]) => {
    mudar({ resp: busca.resp === resp ? "todas" : resp });
  };
  const escolherCodigo = (codigo: number) => {
    mudar({ codigos: [codigo] });
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        rotulo="Total de ocorrências"
        valor={formatarInteiro(m.total)}
        status="bom"
        neutro
        icone={ClipboardList}
        detalhe={`${formatarInteiro(m.ctrcs)} CT-e distintos`}
        dica={
          busca.campoData === "emissao"
            ? "Ocorrências dos CT-e com emissão dentro do período selecionado."
            : "Ocorrências dos CT-e com previsão de entrega dentro do período selecionado."
        }
        ativo={busca.resp === "todas"}
        aoClicar={() => {
          mudar({ resp: "todas" });
        }}
        extra={
          <CodigosDoCard
            card="todas"
            filtros={filtros}
            titulo="Todos os códigos do período"
            aoEscolher={escolherCodigo}
          />
        }
      />
      <KpiCard
        rotulo="Penalizantes"
        selo="CT-e distintos"
        status="ruim"
        icone={ShieldAlert}
        valor={formatarInteiro(m.penalizantes)}
        detalhe={`${formatarParticipacao(m.penalizantes, m.ctrcs)} dos CT-e`}
        dica={`CT-e com pelo menos uma ocorrência penalizante de responsabilidade da ${nomeCurto} (exclui responsável cliente) E que estão em atraso: não entregues, sem código finalizador e com prazo de entrega já vencido. Clique para filtrar a tela por eles.`}
        ativo={busca.resp === "penalizantes"}
        aoClicar={() => {
          alternarCard("penalizantes");
        }}
        extra={
          <CodigosDoCard
            card="penalizantes"
            filtros={filtros}
            titulo="Códigos dos CT-e penalizantes"
            aoEscolher={escolherCodigo}
          />
        }
      />
      <KpiCard
        rotulo="Não penalizantes"
        selo="CT-e distintos"
        status="bom"
        icone={ShieldCheck}
        valor={formatarInteiro(m.naoPenalizantes)}
        detalhe={`${formatarParticipacao(m.naoPenalizantes, m.ctrcs)} dos CT-e`}
        dica={`CT-e que não atendem às duas condições juntas: ou não tiveram ocorrência de responsabilidade da ${nomeCurto}, ou ainda estão dentro do prazo, ou já foram entregues ou baixados sem entrega. Clique para filtrar a tela por eles.`}
        ativo={busca.resp === "externas"}
        aoClicar={() => {
          alternarCard("externas");
        }}
        extra={
          <CodigosDoCard
            card="externas"
            filtros={filtros}
            titulo="Códigos dos CT-e não penalizantes"
            aoEscolher={escolherCodigo}
          />
        }
      />
      <KpiCard
        rotulo="Pendentes de classificação"
        valor={formatarInteiro(m.pendentes)}
        status="alerta"
        neutro={m.pendentes === 0}
        icone={CircleHelp}
        detalhe={`${formatarParticipacao(m.pendentes, m.total)} das ocorrências`}
        dica="Códigos sem cadastro, ou marcados como pendentes de classificação. Não entram em penalizantes nem em não penalizantes. Clique para filtrar a tela por eles."
        ativo={busca.resp === "pendentes"}
        aoClicar={() => {
          alternarCard("pendentes");
        }}
        extra={
          <CodigosDoCard
            card="pendentes"
            filtros={filtros}
            titulo="Códigos pendentes de classificação"
            aoEscolher={escolherCodigo}
          />
        }
      />
    </div>
  );
}
