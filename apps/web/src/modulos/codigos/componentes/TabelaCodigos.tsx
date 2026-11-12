import {
  type AcaoEmLote,
  ACOES_EM_LOTE,
  type CodigoDoAdmin,
  type LetraDeResponsavel,
} from "@erp/shared/contratos/codigos-ocorrencia";
import { formatarInteiro } from "@erp/shared/formatacao";

import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela } from "@/componentes/comum/tabela-dados";
import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";
import { Checkbox } from "@/componentes/ui/checkbox";

import { ehLetra } from "../regras";
import { ROTULO_DO_LOTE } from "../textos";

/** Catálogo de códigos, com seleção e ações em lote para quem edita. */
export function TabelaCodigos({
  codigos,
  carregando,
  erro,
  aoTentarDeNovo,
  rotulos,
  podeEditar,
  selecionados,
  aoAlternarSelecao,
  aoAplicarLote,
  aoAbrir,
}: {
  codigos: CodigoDoAdmin[];
  carregando: boolean;
  erro: unknown;
  aoTentarDeNovo: () => void;
  rotulos: Record<LetraDeResponsavel, string>;
  podeEditar: boolean;
  selecionados: ReadonlySet<number>;
  aoAlternarSelecao: (codigo: number) => void;
  aoAplicarLote: (acao: AcaoEmLote) => void;
  aoAbrir: (x: CodigoDoAdmin) => void;
}) {
  const colunas: ColunaTabela<CodigoDoAdmin>[] = [
    ...(podeEditar
      ? [
          {
            chave: "selecao",
            titulo: "",
            ordenavel: false,
            semExportar: true,
            fixa: true,
            celula: (x: CodigoDoAdmin) => (
              <Checkbox
                aria-label={`Selecionar código ${String(x.codigo)}`}
                checked={selecionados.has(x.codigo)}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                }}
                onCheckedChange={() => {
                  aoAlternarSelecao(x.codigo);
                }}
              />
            ),
          },
        ]
      : []),
    { chave: "codigo", titulo: "Cód.", classe: "font-mono", fixa: true },
    {
      chave: "letraResponsavel",
      titulo: "Letra",
      valor: (x) => x.letraResponsavel,
      celula: (x) =>
        x.letraResponsavel ? (
          <span
            className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-muted px-1.5 font-mono text-xs font-bold"
            title={ehLetra(x.letraResponsavel) ? rotulos[x.letraResponsavel] : undefined}
          >
            {x.letraResponsavel}
          </span>
        ) : null,
    },
    { chave: "descricao", titulo: "Descrição", classe: "max-w-[320px] truncate" },
    {
      chave: "responsavel",
      titulo: "Responsável",
      valor: (x) => (ehLetra(x.letraResponsavel) ? rotulos[x.letraResponsavel] : x.responsavel),
    },
    {
      chave: "penaliza",
      titulo: "Penaliza",
      valor: (x) => (x.penaliza ? "Sim" : "Não"),
      celula: (x) =>
        x.penaliza ? <span className="font-semibold text-status-bad-fg">Sim</span> : "Não",
    },
    { chave: "tipoSsw", titulo: "Tipo SSW" },
    { chave: "processoSsw", titulo: "Processo" },
    { chave: "frequencia30d", titulo: "Ocorr. 30d", formato: "inteiro" },
    {
      chave: "atualizadoEm",
      titulo: "Última edição",
      formato: "datahora",
      valor: (x) => x.atualizadoEm,
    },
    { chave: "atualizadoPorNome", titulo: "Editado por", oculta: true },
    {
      chave: "status",
      titulo: "Status",
      valor: (x) => (x.pendenteClassificacao ? "Pendente" : x.ativo ? "Ativo" : "Inativo"),
      celula: (x) =>
        x.pendenteClassificacao ? (
          <SeloStatus tom="alerta">pendente</SeloStatus>
        ) : x.ativo ? (
          <SeloStatus tom="sucesso">ativo</SeloStatus>
        ) : (
          <SeloStatus tom="neutro">inativo</SeloStatus>
        ),
    },
    { chave: "notas", titulo: "Notas", oculta: true },
  ];

  return (
    <TabelaDados
      colunas={colunas}
      linhas={codigos}
      chaveDaLinha={(x) => String(x.codigo)}
      carregando={carregando}
      erro={erro}
      aoTentarDeNovo={aoTentarDeNovo}
      mensagemVazia="Nenhum código com esses filtros."
      porPagina={0}
      aoClicarLinha={(x) => {
        aoAbrir(x);
      }}
      acoes={
        podeEditar &&
        selecionados.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-medium text-foreground">{selecionados.size} selecionado(s):</span>
            {ACOES_EM_LOTE.map((acao) => (
              <Button
                key={acao}
                size="sm"
                variant="outline"
                onClick={() => {
                  aoAplicarLote(acao);
                }}
              >
                {ROTULO_DO_LOTE[acao]}
              </Button>
            ))}
          </div>
        )
      }
      configurarColunas
      rotuloTotal={(n) => `${formatarInteiro(n)} código(s)`}
      exportacao={{ arquivo: "codigos-ocorrencia", titulo: "Códigos de ocorrência" }}
    />
  );
}
