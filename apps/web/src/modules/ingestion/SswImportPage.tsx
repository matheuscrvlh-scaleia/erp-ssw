/** Admin › Importação SSW (só Plataforma): pipeline automático + importação manual + aplicação. */
import { DESCRICAO_DO_RELATORIO, type Relatorio } from "@erp/domain/ingestion/reports";
import { type CicloDaIngestao } from "@erp/shared/contracts/ingestion";
import { useIsFetching, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DatabaseZap,
  FileText,
  Loader2,
  MoreHorizontal,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { TabelaDados } from "@/components/common/DataTable";
import { Painel } from "@/components/common/Panel";
import { SeloDaSituacao } from "@/components/common/SituationBadge";
import { SeloStatus } from "@/components/common/StatusBadge";
import { Pagina, Secao } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mensagemAmigavel } from "@/lib/error-message";
import { cn } from "@/lib/utils";

import {
  chaves,
  consultaAplicacoes,
  consultaPipeline,
  mutacaoDescartarCiclo,
  mutacaoRetomarCiclo,
} from "./api";
import { AplicarStaging } from "./components/ApplyStaging";
import { ItemRecolhivel } from "./components/CollapsibleItem";
import { ConfirmarAcao } from "./components/ConfirmAction";
import { ImportadorManual } from "./components/ManualImporter";
import { num } from "./texts";

/** Ordem dos importadores manuais (como hoje). O 455 de largura fixa saiu (Q44). */
const IMPORTADORES: readonly Relatorio[] = ["038", "455csv", "930", "306", "036"];

function PipelineAutomatico() {
  const queryClient = useQueryClient();
  const consulta = useQuery(consultaPipeline);
  const retomarCiclo = useMutation(mutacaoRetomarCiclo(queryClient));
  const descartarCiclo = useMutation(mutacaoDescartarCiclo(queryClient));
  const [agindo, setAgindo] = useState<string | null>(null);
  const [descartando, setDescartando] = useState<CicloDaIngestao | null>(null);
  const dados = consulta.data;

  /** Marca o ciclo em andamento; o toast sai e os botões voltam antes de o cache ser invalidado (como hoje). */
  const agir = (chave: string, sucesso: string) => {
    setAgindo(chave);
    return {
      chave,
      aoTerminar: (_: unknown, e: Error | null) => {
        if (e) toast.error("Não foi possível concluir", { description: mensagemAmigavel(e) });
        else toast.success(sucesso);
        setAgindo(null);
      },
    };
  };

  const retomar = (ciclo: CicloDaIngestao) => {
    retomarCiclo.mutate(agir(ciclo.cicloChave, `Ciclo ${ciclo.cicloChave} enviado para aplicação`));
  };

  const descartar = (ciclo: CicloDaIngestao, motivo: string) => {
    descartarCiclo.mutate({
      ...agir(ciclo.cicloChave, `Ciclo ${ciclo.cicloChave} descartado`),
      motivo,
    });
  };

  const podeAgir = (s: string) => s !== "aplicado" && s !== "descartado";

  return (
    <Secao
      titulo="Importação automática de relatórios SSW"
      descricao="Arquivos do FTP agrupados por ciclo (carimbo do nome). O ciclo é aplicado sozinho a cada minuto."
      acoes={
        dados && (
          <>
            <span className="text-[13px] text-muted-foreground tabular-nums">
              {dados.filaPendente.toLocaleString("pt-BR")} CT-e na fila de aplicação
            </span>
            {dados.aplicacaoRodando && (
              <SeloStatus tom="info" icone={RefreshCw}>
                aplicação em andamento
              </SeloStatus>
            )}
          </>
        )
      }
    >
      <TabelaDados
        titulo="Últimos ciclos"
        colunas={[
          { chave: "cicloChave", titulo: "Ciclo", classe: "font-mono whitespace-nowrap" },
          {
            chave: "status",
            titulo: "Situação",
            celula: (x) => <SeloDaSituacao status={x.status} />,
            valor: (x) => x.status,
          },
          {
            chave: "acoes",
            titulo: "",
            semExportar: true,
            ordenavel: false,
            celula: (x) =>
              podeAgir(x.status) ? (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={agindo !== null}
                      aria-label={`Ações do ciclo ${x.cicloChave}`}
                    >
                      {agindo === x.cicloChave ? (
                        <Loader2 className="motion-safe:animate-spin" aria-hidden />
                      ) : (
                        <MoreHorizontal aria-hidden />
                      )}
                      Ações
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-48">
                    <DropdownMenuItem
                      onSelect={() => {
                        retomar(x);
                      }}
                    >
                      <Play aria-hidden />
                      Aplicar mesmo assim
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-status-bad-fg focus:bg-status-bad-bg focus:text-status-bad-fg"
                      onSelect={() => {
                        setDescartando(x);
                      }}
                    >
                      <Trash2 aria-hidden />
                      Descartar ciclo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null,
          },
          { chave: "arquivosImportados", titulo: "Arquivos", formato: "inteiro" },
          { chave: "linhasImportadas", titulo: "Linhas", formato: "inteiro" },
          {
            chave: "inseridos",
            titulo: "Inseridos",
            valor: (x) => num(x.totais.inserir),
            ordenavel: false,
            alinhamento: "direita",
          },
          {
            chave: "atualizados",
            titulo: "Atualizados",
            valor: (x) => num(x.totais.atualizar),
            ordenavel: false,
            alinhamento: "direita",
          },
          { chave: "faltantes", titulo: "Faltantes", valor: (x) => x.faltantes.join(", ") },
          { chave: "motivo", titulo: "Motivo", classe: "max-w-[260px] truncate" },
          {
            chave: "aplicadoEm",
            titulo: "Aplicado em",
            formato: "datahora",
            classe: "whitespace-nowrap",
          },
        ]}
        linhas={dados?.ciclos ?? []}
        chaveDaLinha={(x) => x.cicloChave}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        mensagemVazia="Nenhum ciclo recebido ainda."
        porPagina={0}
      />
      <TabelaDados
        titulo="Últimos arquivos"
        colunas={[
          { chave: "nomeArquivo", titulo: "Arquivo", classe: "font-mono max-w-[320px] truncate" },
          { chave: "cicloChave", titulo: "Ciclo", classe: "font-mono whitespace-nowrap" },
          { chave: "relatorio", titulo: "Relatório" },
          { chave: "unidade", titulo: "Unidade" },
          {
            chave: "status",
            titulo: "Situação",
            celula: (a) => <SeloDaSituacao status={a.status} />,
            valor: (a) => a.status,
          },
          { chave: "linhas", titulo: "Linhas", formato: "inteiro" },
          { chave: "mensagem", titulo: "Mensagem", classe: "max-w-[280px] truncate" },
          {
            chave: "vistoEm",
            titulo: "Visto em",
            formato: "datahora",
            classe: "whitespace-nowrap",
          },
          {
            chave: "importadoEm",
            titulo: "Importado em",
            formato: "datahora",
            classe: "whitespace-nowrap",
          },
        ]}
        linhas={dados?.arquivos ?? []}
        chaveDaLinha={(a) => a.nomeArquivo}
        carregando={consulta.isLoading}
        mensagemVazia="Nenhum arquivo recebido ainda."
        porPagina={0}
      />
      <ConfirmarAcao
        aberto={descartando !== null}
        aoMudarAberto={(aberto) => {
          if (!aberto) setDescartando(null);
        }}
        titulo={`Descartar o ciclo ${descartando?.cicloChave ?? ""}?`}
        descricao="As linhas importadas dele (inclusive o 455 CSV) serão apagadas da staging."
        motivo="Informe o motivo:"
        rotuloDoBotao="Descartar ciclo"
        aoConfirmar={(motivo) => {
          if (descartando) descartar(descartando, motivo);
        }}
      />
    </Secao>
  );
}

export function PaginaImportacaoSsw() {
  const queryClient = useQueryClient();
  const atualizando = useIsFetching({ queryKey: chaves.tudo }) > 0;
  const aplicacoes = useQuery(consultaAplicacoes);
  return (
    <Pagina
      titulo="Importação SSW"
      descricao="Pipeline automático dos relatórios do FTP, importação manual e aplicação à produção"
      acoes={
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void queryClient.invalidateQueries({ queryKey: chaves.tudo })}
          disabled={atualizando}
        >
          <RefreshCw className={cn(atualizando && "motion-safe:animate-spin")} aria-hidden />
          Atualizar
        </Button>
      }
    >
      <PipelineAutomatico />
      <Secao
        titulo="Importação manual de relatórios SSW"
        descricao="Envie um relatório exportado do SSW: confira a prévia e grave na staging. Depois aplique à produção."
      >
        <Painel classeDoCorpo="divide-y divide-border overflow-hidden rounded-xl">
          {IMPORTADORES.map((r) => (
            <ItemRecolhivel key={r} titulo={DESCRICAO_DO_RELATORIO[r]} icone={FileText}>
              <ImportadorManual relatorio={r} />
            </ItemRecolhivel>
          ))}
          <ItemRecolhivel titulo="Aplicar importações à produção" icone={DatabaseZap}>
            <AplicarStaging
              aplicacoes={aplicacoes.data?.aplicacoes ?? []}
              carregando={aplicacoes.isLoading}
              erro={aplicacoes.error}
              aoTentarDeNovo={() => void aplicacoes.refetch()}
            />
          </ItemRecolhivel>
        </Painel>
      </Secao>
    </Pagina>
  );
}
