/** Admin › Importação SSW (só Plataforma): pipeline automático + importação manual + aplicação. */
import { DESCRICAO_DO_RELATORIO, type Relatorio } from "@erp/dominio/ingestao/relatorios";
import { type CicloDaIngestao, contratosIngestao as c } from "@erp/shared/contratos/ingestao";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
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

import { Painel } from "@/componentes/comum/Painel";
import { SeloDaSituacao } from "@/componentes/comum/SeloDaSituacao";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Pagina, Secao } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/componentes/ui/dropdown-menu";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

import { CHAVE_DA_INGESTAO, consultaPipeline } from "./api";
import { AplicarStaging } from "./AplicarStaging";
import { ImportadorManual } from "./ImportadorManual";
import { ConfirmarAcao, ItemRecolhivel } from "./pecas";

/** Ordem dos importadores manuais (como hoje). O 455 de largura fixa saiu (Q44). */
const IMPORTADORES: readonly Relatorio[] = ["038", "455csv", "930", "306", "036"];

const num = (v: unknown) => (typeof v === "number" ? v.toLocaleString("pt-BR") : "—");

function PipelineAutomatico() {
  const queryClient = useQueryClient();
  const consulta = useQuery(consultaPipeline);
  const [agindo, setAgindo] = useState<string | null>(null);
  const [descartando, setDescartando] = useState<CicloDaIngestao | null>(null);
  const dados = consulta.data;

  const agir = async (chave: string, acao: () => Promise<unknown>, sucesso: string) => {
    setAgindo(chave);
    try {
      await acao();
      toast.success(sucesso);
    } catch (e) {
      toast.error("Não foi possível concluir", { description: mensagemAmigavel(e) });
    } finally {
      setAgindo(null);
      await queryClient.invalidateQueries({ queryKey: CHAVE_DA_INGESTAO });
    }
  };

  const retomar = (ciclo: CicloDaIngestao) =>
    agir(
      ciclo.cicloChave,
      () => chamar(c.retomarCiclo, { parametros: { chave: ciclo.cicloChave } }),
      `Ciclo ${ciclo.cicloChave} enviado para aplicação`,
    );

  const descartar = (ciclo: CicloDaIngestao, motivo: string) =>
    agir(
      ciclo.cicloChave,
      () =>
        chamar(c.descartarCiclo, { parametros: { chave: ciclo.cicloChave }, entrada: { motivo } }),
      `Ciclo ${ciclo.cicloChave} descartado`,
    );

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
                    <DropdownMenuItem onSelect={() => void retomar(x)}>
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
          if (descartando) void descartar(descartando, motivo);
        }}
      />
    </Secao>
  );
}

export function PaginaImportacaoSsw() {
  const queryClient = useQueryClient();
  const atualizando = useIsFetching({ queryKey: CHAVE_DA_INGESTAO }) > 0;
  return (
    <Pagina
      titulo="Importação SSW"
      descricao="Pipeline automático dos relatórios do FTP, importação manual e aplicação à produção"
      acoes={
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void queryClient.invalidateQueries({ queryKey: CHAVE_DA_INGESTAO })}
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
            <AplicarStaging />
          </ItemRecolhivel>
        </Painel>
      </Secao>
    </Pagina>
  );
}
