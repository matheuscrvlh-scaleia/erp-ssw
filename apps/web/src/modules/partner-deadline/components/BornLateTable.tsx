import { type NascidoAtrasado } from "@erp/shared/contracts/partner-deadline";
import { formatarData, formatarInteiro } from "@erp/shared/formatting";

import { type ColunaTabela } from "@/components/common/data-table";
import { TabelaDados } from "@/components/common/DataTable";
import { ExportMenu } from "@/components/common/ExportMenu";

import { COLUNAS_DOS_NASCIDOS, linhaDoNascido, slug } from "../export";
import { type Periodo } from "../search";
import { destinoDe, ROTULO_PERIODO } from "../texts";
import { NumeroDoCtrc } from "./CtrcNumber";

/** CT-e do parceiro nascidos em atraso, com a exportação para a reunião comercial. */
export function TabelaNascidosEmAtraso({
  nascidos,
  nomeDoParceiro,
  periodo,
  carregando,
  aoAbrir,
}: {
  nascidos: readonly NascidoAtrasado[];
  nomeDoParceiro: string | undefined;
  periodo: Periodo;
  carregando: boolean;
  aoAbrir: (n: NascidoAtrasado) => void;
}) {
  const colunas = (
    [
      { chave: "numero", titulo: "CTRC", celula: (n) => <NumeroDoCtrc numero={n.numero} /> },
      { chave: "dataEmbarque", titulo: "Embarque", celula: (n) => formatarData(n.dataEmbarque) },
      {
        chave: "dataPrevista",
        titulo: "Prazo entrega",
        celula: (n) => formatarData(n.dataPrevista),
      },
      {
        chave: "prazoPadraoData",
        titulo: "Mínimo 48h",
        classe: "text-muted-foreground",
        celula: (n) => formatarData(n.prazoPadraoData),
      },
      {
        chave: "diasAbaixoDoPadrao",
        titulo: "Abaixo das 48h (dias)",
        alinhamento: "direita",
        classe: "whitespace-nowrap font-semibold text-status-bad-fg",
        celula: (n) => n.diasAbaixoDoPadrao ?? "—",
      },
      {
        chave: "statusAtual",
        titulo: "Status",
        classe: "max-w-[160px] truncate text-muted-foreground",
        celula: (n) => n.statusAtual ?? "—",
      },
      { chave: "setor", titulo: "Setor", classe: "font-mono", celula: (n) => n.setor ?? "—" },
      { chave: "destino", titulo: "Destino", celula: (n) => destinoDe(n) ?? "—" },
      {
        chave: "unidadeNome",
        titulo: "Unidade",
        classe: "max-w-[160px] truncate",
        celula: (n) => n.unidadeNome ?? "—",
      },
    ] satisfies ColunaTabela<NascidoAtrasado>[]
  ).map((c): ColunaTabela<NascidoAtrasado> => ({ ...c, ordenavel: false }));

  return (
    <TabelaDados
      titulo="CTRCs nascidos em atraso"
      colunas={colunas}
      linhas={nascidos}
      chaveDaLinha={(n) => n.id}
      aoClicarLinha={aoAbrir}
      carregando={carregando}
      mensagemVazia="Nenhum CTRC nasceu atrasado deste parceiro no período."
      porPagina={0}
      rotuloTotal={(n) =>
        `${formatarInteiro(n)} CTRC(s) · Use esta lista na reunião comercial com o parceiro`
      }
      acoes={
        <div className="flex flex-1 justify-end">
          <ExportMenu
            arquivo={`prazo-parceiro-${slug(nomeDoParceiro ?? "parceiro")}`}
            titulo={`Nascidos em atraso — ${nomeDoParceiro ?? "parceiro"}`}
            subtitulo={ROTULO_PERIODO[periodo]}
            colunas={COLUNAS_DOS_NASCIDOS}
            linhas={nascidos.map(linhaDoNascido)}
            formatos={["csv", "excel"]}
            desabilitado={carregando || nascidos.length === 0}
          />
        </div>
      }
    />
  );
}
