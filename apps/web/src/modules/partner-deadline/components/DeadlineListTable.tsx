import {
  FILTROS_DA_LISTA,
  type LinhaPrazo,
  TAMANHOS_DA_LISTA,
} from "@erp/shared/contracts/partner-deadline";
import { formatarData, formatarInteiro } from "@erp/shared/formatting";

import { type ColunaTabela } from "@/components/common/data-table";
import { TabelaDados } from "@/components/common/DataTable";
import { ExportMenu } from "@/components/common/ExportMenu";
import { Alternador } from "@/components/common/Toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { COLUNAS_DA_LISTA, type linhaDaLista } from "../export";
import { type BuscaPrazo, tamanhoDaLista } from "../search";
import { ROTULO_FILTRO, ROTULO_PERIODO } from "../texts";
import { NumeroDoCtrc } from "./CtrcNumber";
import { EtiquetaDeOrigem } from "./OriginTag";

/** Lista paginada de CT-e da visão geral, com o filtro da lista, o tamanho da página e a exportação. */
export function TabelaListaDoPrazo({
  busca: b,
  linhas,
  total,
  carregando,
  erro,
  aoTentarDeNovo,
  aoAbrir,
  mudar,
  aoMudarPagina,
  carregarParaExportar,
}: {
  busca: BuscaPrazo;
  linhas: readonly LinhaPrazo[];
  total: number;
  carregando: boolean;
  erro: unknown;
  aoTentarDeNovo: () => void;
  aoAbrir: (l: LinhaPrazo) => void;
  mudar: (m: Partial<BuscaPrazo>) => void;
  aoMudarPagina: (page: number) => void;
  carregarParaExportar: () => Promise<readonly ReturnType<typeof linhaDaLista>[]>;
}) {
  const colunasDaLista = (
    [
      { chave: "numero", titulo: "CTRC", celula: (l) => <NumeroDoCtrc numero={l.numero} /> },
      {
        chave: "parceiroNome",
        titulo: "Parceiro",
        classe: "max-w-[180px] truncate",
        celula: (l) => l.parceiroNome ?? "—",
      },
      { chave: "dataEmbarque", titulo: "Embarque", celula: (l) => formatarData(l.dataEmbarque) },
      {
        chave: "dataPrevista",
        titulo: "Prazo entrega",
        celula: (l) => formatarData(l.dataPrevista),
      },
      {
        chave: "prazoPadraoData",
        titulo: "Mínimo 48h",
        classe: "text-muted-foreground",
        celula: (l) => formatarData(l.prazoPadraoData),
      },
      {
        chave: "diasAbaixoDoPadrao",
        titulo: "Abaixo do padrão (dias)",
        alinhamento: "direita",
        classe: "whitespace-nowrap",
        celula: (l) => (
          <span className={cn(l.nasceuAtrasado && "font-semibold text-status-bad-fg")}>
            {l.diasAbaixoDoPadrao ?? "—"}
          </span>
        ),
      },
      {
        chave: "origem",
        titulo: "Origem",
        celula: (l) => <EtiquetaDeOrigem origem={l.prazoOrigem} />,
      },
      {
        chave: "statusAtual",
        titulo: "Status",
        classe: "max-w-[160px] truncate text-muted-foreground",
        celula: (l) => l.statusAtual ?? "—",
      },
      { chave: "setor", titulo: "Setor", classe: "font-mono", celula: (l) => l.setor ?? "—" },
      {
        chave: "unidadeNome",
        titulo: "Unidade",
        classe: "max-w-[160px] truncate",
        celula: (l) => l.unidadeNome ?? "—",
      },
    ] satisfies ColunaTabela<LinhaPrazo>[]
  ).map((c): ColunaTabela<LinhaPrazo> => ({ ...c, ordenavel: false }));

  return (
    <TabelaDados
      colunas={colunasDaLista}
      linhas={linhas}
      chaveDaLinha={(l) => l.id}
      aoClicarLinha={aoAbrir}
      carregando={carregando}
      erro={erro}
      aoTentarDeNovo={aoTentarDeNovo}
      mensagemVazia="Não há CTRCs com prazo do parceiro no período filtrado. Tente ampliar o período."
      paginacaoServidor={{
        pagina: b.page,
        porPagina: b.size,
        total,
        aoMudarPagina,
      }}
      rotuloTotal={(n) => `${formatarInteiro(n)} CTRC(s)`}
      acoes={
        <>
          <Alternador
            rotulo="Filtro da lista"
            tamanho="pequeno"
            opcoes={FILTROS_DA_LISTA.map((f) => ({ valor: f, rotulo: ROTULO_FILTRO[f] }))}
            valor={b.filtro}
            aoMudar={(filtro) => {
              mudar({ filtro });
            }}
          />
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <span>Linhas por página:</span>
              <Select
                value={String(b.size)}
                onValueChange={(v) => {
                  mudar({ size: tamanhoDaLista(Number(v)) });
                }}
              >
                <SelectTrigger
                  aria-label="Linhas por página"
                  className="h-8 w-[76px] text-[13px] font-medium text-foreground"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAMANHOS_DA_LISTA.map((s) => (
                    <SelectItem key={s} value={String(s)} className="text-[13px]">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <ExportMenu
              arquivo={`prazo-parceiro-${b.periodo}`}
              titulo="Prazo do parceiro"
              subtitulo={ROTULO_PERIODO[b.periodo]}
              colunas={COLUNAS_DA_LISTA}
              linhas={[]}
              carregarLinhas={carregarParaExportar}
              formatos={["csv", "excel"]}
              desabilitado={carregando}
            />
          </div>
        </>
      }
    />
  );
}
