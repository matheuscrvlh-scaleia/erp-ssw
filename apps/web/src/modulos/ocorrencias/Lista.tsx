import {
  type LinhaDeOcorrencia,
  type OrdemDaLista,
  ORDENS_DA_LISTA,
  type ResponsavelDoEvento,
  TAMANHOS_DE_PAGINA,
} from "@erp/shared/contratos/ocorrencias";
import { formatarInteiro } from "@erp/shared/formatacao";
import { AlertTriangle, Clock } from "lucide-react";
import { type ReactNode } from "react";

import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela } from "@/componentes/comum/tabela-dados";
import { TabelaDados } from "@/componentes/comum/TabelaDados";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/componentes/ui/select";
import { COLUNA_LINK_SSW, urlCtrcNoSsw } from "@/lib/exportacao";

import { type BuscaOcorrencias } from "./busca";
import { identificacaoDoCte, rotulosDoResponsavel, tomDoResponsavel } from "./rotulos";

/** Responsável do código em pílula (transportador em vermelho, pendente em alerta). */
export function SeloDoResponsavel({
  responsavel,
  children,
}: {
  responsavel: ResponsavelDoEvento;
  children: ReactNode;
}) {
  const tom = tomDoResponsavel(responsavel);
  return (
    <SeloStatus tom={tom} semIcone={tom === "neutro"} className="shrink-0">
      {children}
    </SeloStatus>
  );
}

const ehOrdem = (chave: string): chave is OrdemDaLista => ORDENS_DA_LISTA.some((o) => o === chave);

/** Colunas da lista; as ordenáveis no servidor têm a chave da ordem do contrato. */
export function colunasDaLista(nomeCurto: string): ColunaTabela<LinhaDeOcorrencia>[] {
  const rotulos = rotulosDoResponsavel(nomeCurto);
  return [
    {
      chave: "data_hora",
      titulo: "Data/hora",
      valor: (l) => l.dataHora,
      formato: "datahora",
      fixa: true,
    },
    { chave: "dataEmissao", titulo: "Emissão", formato: "data", ordenavel: false },
    {
      chave: "codigo",
      titulo: "Código",
      valor: (l) => l.codigo,
      celula: (l) => <span className="font-mono text-xs">#{l.codigo}</span>,
    },
    { chave: "descricao", titulo: "Descrição", classe: "max-w-[280px] truncate", ordenavel: false },
    {
      chave: "responsavel",
      titulo: "Responsável",
      valor: (l) => rotulos[l.responsavel],
      celula: (l) => (
        <SeloDoResponsavel responsavel={l.responsavel}>{rotulos[l.responsavel]}</SeloDoResponsavel>
      ),
    },
    {
      chave: "penaliza",
      titulo: "Penaliza",
      alinhamento: "centro",
      ordenavel: false,
      valor: (l) => (l.pendente ? "Pendente" : l.penaliza ? "Sim" : "Não"),
      celula: (l) =>
        l.pendente ? (
          <Clock
            aria-label="Pendente de classificação"
            className="inline h-3.5 w-3.5 text-status-warn"
          />
        ) : l.penaliza ? (
          <AlertTriangle aria-label="Penaliza" className="inline h-3.5 w-3.5 text-status-bad" />
        ) : null,
    },
    {
      chave: "numero_ctrc",
      titulo: "NF / CTRC",
      valor: (l) => l.numeroCtrc,
      celula: (l) => {
        const id = identificacaoDoCte(l.numeroNf, l.numeroCtrc);
        return (
          <span className="leading-tight whitespace-nowrap">
            <span className="font-mono text-xs font-medium text-brand">
              <span className="mr-1 font-sans text-muted-foreground">{id.rotulo}</span>
              {id.principal}
            </span>
            {id.secundario && (
              <span className="block font-mono text-xs text-muted-foreground">
                CTRC {id.secundario}
              </span>
            )}
          </span>
        );
      },
    },
    { chave: "numeroNf", titulo: "NF", oculta: true, ordenavel: false },
    {
      chave: "conferente",
      titulo: "Conferente / Romaneio",
      ordenavel: false,
      classe: "max-w-[200px]",
      celula: (l) => (
        <>
          <span className="block truncate" title={l.conferente ?? undefined}>
            {l.conferente ?? "Não informado"}
          </span>
          {l.romaneio && (
            <span className="block truncate text-xs text-muted-foreground">
              Romaneio {l.romaneio}
            </span>
          )}
        </>
      ),
    },
    { chave: "romaneio", titulo: "Romaneio", oculta: true, ordenavel: false },
    {
      chave: "destinatario",
      titulo: "Destinatário",
      classe: "max-w-[180px] truncate",
      ordenavel: false,
    },
    {
      chave: "cidadeDestino",
      titulo: "Cidade entrega",
      ordenavel: false,
      valor: (l) =>
        l.cidadeDestino ? `${l.cidadeDestino}${l.ufDestino ? `/${l.ufDestino}` : ""}` : null,
    },
    { chave: "setor", titulo: "Setor", classe: "font-mono", ordenavel: false },
    {
      chave: "unidadeResp",
      titulo: "Unidade resp.",
      classe: "font-mono text-xs",
      ordenavel: false,
    },
    { chave: "dataPrevistaEntrega", titulo: "Prev. entrega", formato: "data", ordenavel: false },
    {
      chave: "atraso_dias",
      titulo: "Atraso",
      formato: "inteiro",
      valor: (l) => l.atrasoDias,
      celula: (l) =>
        l.atrasoDias !== null && l.atrasoDias > 0 ? (
          <span className="font-semibold text-status-bad-fg">{l.atrasoDias}d</span>
        ) : null,
    },
    { chave: "pagador", titulo: "Pagador", classe: "max-w-[160px] truncate", ordenavel: false },
    { chave: "peso", titulo: "Peso (kg)", formato: "decimal", ordenavel: false },
    { chave: "volumes", titulo: "Vol.", formato: "inteiro", ordenavel: false },
    { chave: "valorFrete", titulo: "Frete", formato: "moeda", ordenavel: false },
    {
      chave: "linkSsw",
      titulo: COLUNA_LINK_SSW,
      oculta: true,
      ordenavel: false,
      valor: (l) => urlCtrcNoSsw(l.siglaCtrc, l.numeroCtrc, l.dataEmissao),
    },
  ];
}

export function ListaDeOcorrencias({
  busca,
  linhas,
  total,
  carregando,
  erro,
  nomeCurto,
  subtitulo,
  carregarTodas,
  aoTentarDeNovo,
  aoOrdenar,
  aoMudarPagina,
  aoMudarTamanho,
  aoAbrirCte,
}: {
  busca: BuscaOcorrencias;
  linhas: readonly LinhaDeOcorrencia[];
  total: number;
  carregando: boolean;
  erro: unknown;
  nomeCurto: string;
  subtitulo: string;
  carregarTodas: () => Promise<readonly LinhaDeOcorrencia[]>;
  aoTentarDeNovo: () => void;
  aoOrdenar: (ordem: OrdemDaLista, dir: "asc" | "desc") => void;
  aoMudarPagina: (pagina: number) => void;
  aoMudarTamanho: (tamanho: number) => void;
  aoAbrirCte: (numero: string) => void;
}) {
  return (
    <TabelaDados
      titulo="Lista detalhada"
      colunas={colunasDaLista(nomeCurto)}
      linhas={linhas}
      chaveDaLinha={(l) => l.id}
      carregando={carregando}
      erro={erro}
      aoTentarDeNovo={aoTentarDeNovo}
      mensagemVazia="Nenhuma ocorrência no período filtrado. Tente ampliar o período ou ajustar os filtros."
      aoClicarLinha={(l) => {
        aoAbrirCte(l.numeroCtrc);
      }}
      ordenacao={{ chave: busca.ordem, direcao: busca.dir }}
      aoOrdenar={(o) => {
        if (ehOrdem(o.chave)) aoOrdenar(o.chave, o.direcao);
      }}
      paginacaoServidor={{ pagina: busca.page, porPagina: busca.size, total, aoMudarPagina }}
      configurarColunas
      rotuloTotal={(n) => `${formatarInteiro(n)} ocorrência(s)`}
      exportacao={{
        arquivo: "ocorrencias",
        titulo: "Ocorrências",
        subtitulo,
        carregarLinhas: carregarTodas,
      }}
      acoes={
        <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
          Linhas por página
          <Select
            value={String(busca.size)}
            onValueChange={(v) => {
              aoMudarTamanho(Number(v));
            }}
          >
            <SelectTrigger className="h-9 w-[76px] text-[13px]" aria-label="Linhas por página">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAMANHOS_DE_PAGINA.map((t) => (
                <SelectItem key={t} value={String(t)} className="text-[13px]">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
      }
    />
  );
}
