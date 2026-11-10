/** Admin › Importação SSW (só Plataforma): pipeline automático + importação manual + aplicação. */
import { DESCRICAO_DO_RELATORIO, type Relatorio } from "@erp/ingestao/relatorios";
import { type CicloDaIngestao, contratosIngestao as c } from "@erp/shared/contratos/ingestao";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { CHAVE_DA_INGESTAO, consultaPipeline } from "./api";
import { AplicarStaging } from "./AplicarStaging";
import { ImportadorManual } from "./ImportadorManual";
import { Cartao, Secao, SeloStatus } from "./pecas";

/** Ordem dos importadores manuais (como hoje). O 455 de largura fixa saiu (Q44). */
const IMPORTADORES: readonly Relatorio[] = ["038", "455csv", "930", "306", "036"];

const num = (v: unknown) => (typeof v === "number" ? v.toLocaleString("pt-BR") : "—");

function PipelineAutomatico() {
  const queryClient = useQueryClient();
  const consulta = useQuery(consultaPipeline);
  const [agindo, setAgindo] = useState<string | null>(null);
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

  const descartar = (ciclo: CicloDaIngestao) => {
    const motivo = window.prompt(
      `Descartar o ciclo ${ciclo.cicloChave}? As linhas importadas dele (inclusive o 455 CSV) serão apagadas da staging. Informe o motivo:`,
    );
    if (!motivo) return;
    void agir(
      ciclo.cicloChave,
      () =>
        chamar(c.descartarCiclo, { parametros: { chave: ciclo.cicloChave }, entrada: { motivo } }),
      `Ciclo ${ciclo.cicloChave} descartado`,
    );
  };

  const podeAgir = (s: string) => s !== "aplicado" && s !== "descartado";

  return (
    <Cartao
      titulo="Importação automática de relatórios SSW"
      descricao="Arquivos do FTP agrupados por ciclo (carimbo do nome). O ciclo é aplicado sozinho a cada minuto."
      acoes={
        <Button
          size="sm"
          variant="outline"
          onClick={() => void consulta.refetch()}
          disabled={consulta.isFetching}
        >
          <RefreshCw
            className={`mr-1 h-4 w-4 ${consulta.isFetching ? "animate-spin" : ""}`}
            aria-hidden
          />{" "}
          Atualizar
        </Button>
      }
    >
      {dados && (
        <p className="text-[12px] text-muted-foreground">
          {dados.filaPendente.toLocaleString("pt-BR")} CT-e na fila de aplicação
          {dados.aplicacaoRodando && " · aplicação em andamento"}
        </p>
      )}
      <TabelaDados
        titulo="Últimos ciclos"
        colunas={[
          { chave: "cicloChave", titulo: "Ciclo", classe: "font-mono whitespace-nowrap" },
          {
            chave: "status",
            titulo: "Situação",
            celula: (x) => <SeloStatus status={x.status} />,
            valor: (x) => x.status,
          },
          { chave: "arquivosImportados", titulo: "Arquivos", formato: "inteiro" },
          { chave: "linhasImportadas", titulo: "Linhas", formato: "inteiro" },
          {
            chave: "inseridos",
            titulo: "Inseridos",
            valor: (x) => num(x.totais.inserir),
            ordenavel: false,
          },
          {
            chave: "atualizados",
            titulo: "Atualizados",
            valor: (x) => num(x.totais.atualizar),
            ordenavel: false,
          },
          { chave: "faltantes", titulo: "Faltantes", valor: (x) => x.faltantes.join(", ") },
          { chave: "motivo", titulo: "Motivo", classe: "max-w-[260px] truncate" },
          { chave: "aplicadoEm", titulo: "Aplicado em", formato: "datahora" },
          {
            chave: "acoes",
            titulo: "",
            semExportar: true,
            ordenavel: false,
            celula: (x) =>
              podeAgir(x.status) ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[12px]"
                    disabled={agindo !== null}
                    onClick={() => void retomar(x)}
                  >
                    Aplicar mesmo assim
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[12px] text-destructive"
                    disabled={agindo !== null}
                    onClick={() => {
                      descartar(x);
                    }}
                  >
                    Descartar ciclo
                  </Button>
                </div>
              ) : null,
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
            celula: (a) => <SeloStatus status={a.status} />,
            valor: (a) => a.status,
          },
          { chave: "linhas", titulo: "Linhas", formato: "inteiro" },
          { chave: "mensagem", titulo: "Mensagem", classe: "max-w-[280px] truncate" },
          { chave: "vistoEm", titulo: "Visto em", formato: "datahora" },
          { chave: "importadoEm", titulo: "Importado em", formato: "datahora" },
        ]}
        linhas={dados?.arquivos ?? []}
        chaveDaLinha={(a) => a.nomeArquivo}
        carregando={consulta.isLoading}
        mensagemVazia="Nenhum arquivo recebido ainda."
        porPagina={0}
      />
    </Cartao>
  );
}

export function PaginaImportacaoSsw() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-[24px] font-semibold">Importação SSW</h1>
      <PipelineAutomatico />
      <Cartao
        titulo="Importação manual de relatórios SSW"
        descricao="Envie um relatório exportado do SSW: confira a prévia e grave na staging. Depois aplique à produção."
      >
        <div className="space-y-2">
          {IMPORTADORES.map((r) => (
            <Secao key={r} titulo={DESCRICAO_DO_RELATORIO[r]}>
              <ImportadorManual relatorio={r} />
            </Secao>
          ))}
          <Secao titulo="Aplicar importações à produção">
            <AplicarStaging />
          </Secao>
        </div>
      </Cartao>
    </div>
  );
}
