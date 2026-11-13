/**
 * "Aplicar importações à produção": simulação (não grava) ou aplicação em blocos de 4000 CT-e,
 * com o resumo de cada lista (até 500 itens) e o histórico das aplicações.
 */
import { type AplicacaoDaIngestao } from "@erp/shared/contracts/ingestion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { TabelaDados } from "@/components/common/DataTable";
import { SeloDaSituacao } from "@/components/common/SituationBadge";
import { Abas } from "@/components/common/Tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { mensagemAmigavel } from "@/lib/error-message";

import { mutacaoAplicarStaging } from "../api";
import { type Acumulado, somar } from "../rules";

const LOTE = 4000;

type Aba = "inserir" | "atualizar" | "ocorrencias" | "ignorados" | "romaneio_036";

export function AplicarStaging({
  aplicacoes,
  carregando,
  erro,
  aoTentarDeNovo,
}: {
  /** Histórico das aplicações. */
  aplicacoes: AplicacaoDaIngestao[];
  carregando: boolean;
  erro: Error | null;
  aoTentarDeNovo: () => void;
}) {
  const queryClient = useQueryClient();
  const aplicar = useMutation(mutacaoAplicarStaging(queryClient));
  const [confirmado, setConfirmado] = useState(false);
  const [rodando, setRodando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Acumulado | null>(null);
  const [aba, setAba] = useState<Aba>("inserir");

  const executar = (dryRun: boolean) => {
    setResultado(null);
    let acumulado: Acumulado | null = null;
    aplicar.mutate({
      dryRun,
      lote: LOTE,
      aoIniciarBloco: (bloco) => {
        setRodando(`${dryRun ? "Simulando" : "Aplicando"} bloco ${bloco}…`);
      },
      aoConcluirBloco: (r) => {
        acumulado = somar(acumulado, r);
        setResultado(acumulado);
      },
      aoTerminar: (_, e) => {
        if (e) toast.error("Não foi possível concluir", { description: mensagemAmigavel(e) });
        else
          toast.success(dryRun ? "Simulação concluída (nada foi gravado)" : "Aplicação concluída");
        setRodando(null);
        setConfirmado(false);
      },
    });
  };

  const abas: { valor: Aba; rotulo: string }[] = resultado
    ? [
        { valor: "inserir", rotulo: `Inserir (${resultado.totais.inserir})` },
        { valor: "atualizar", rotulo: `Atualizar (${resultado.totais.atualizar})` },
        { valor: "ocorrencias", rotulo: `Ocorrências (${resultado.totais.ocorrencias})` },
        { valor: "ignorados", rotulo: `Ignorados (${resultado.totais.ignorados})` },
        { valor: "romaneio_036", rotulo: `Romaneio 036 (${resultado.romaneio036 ?? 0})` },
      ]
    : [];

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted-foreground">
        Aplica as linhas da staging nos CT-e e nas ocorrências, em blocos de{" "}
        {LOTE.toLocaleString("pt-BR")} CT-e. A simulação mostra o que mudaria sem gravar nada.
      </p>
      <div className="flex flex-wrap items-stretch gap-3">
        <Button
          size="sm"
          variant="outline"
          className="self-center"
          disabled={rodando !== null}
          onClick={() => {
            executar(true);
          }}
        >
          Simular (não grava)
        </Button>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-status-bad/30 bg-status-bad-bg px-3 py-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-status-bad-fg" aria-hidden />
          <label className="flex items-center gap-2 text-[13px] font-medium text-status-bad-fg">
            <Checkbox
              checked={confirmado}
              onCheckedChange={(v) => {
                setConfirmado(v === true);
              }}
              disabled={rodando !== null}
            />
            Confirmo a aplicação à produção
          </label>
          <Button
            size="sm"
            variant="destructive"
            disabled={!confirmado || rodando !== null}
            onClick={() => {
              executar(false);
            }}
          >
            Aplicar à produção
          </Button>
        </div>
        {rodando && (
          <span
            role="status"
            className="flex items-center gap-1.5 self-center text-[13px] text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> {rodando}
          </span>
        )}
      </div>

      {resultado && (
        <div className="space-y-3">
          <p className="text-[13px] text-muted-foreground">
            {resultado.dryRun ? "Simulação" : "Aplicação"} em {resultado.blocos} bloco(s)
            {!resultado.dryRun && ` · ${resultado.pendentes} CT-e ainda na fila`}
          </p>
          <Abas abas={abas} valor={aba} aoMudar={setAba} className="h-auto flex-wrap" />
          {aba === "inserir" && (
            <TabelaDados
              colunas={[
                { chave: "chave", titulo: "CT-e", classe: "font-mono" },
                { chave: "dataEmissao", titulo: "Emissão", formato: "data" },
                { chave: "previsao", titulo: "Previsão", formato: "data" },
              ]}
              linhas={resultado.inserir}
              chaveDaLinha={(l) => l.chave}
              porPagina={25}
              mensagemVazia="Nenhum CT-e novo."
            />
          )}
          {aba === "atualizar" && (
            <TabelaDados
              colunas={[
                { chave: "chave", titulo: "CT-e", classe: "font-mono" },
                { chave: "campos", titulo: "Campos", valor: (l) => l.campos.join(", ") },
              ]}
              linhas={resultado.atualizar}
              chaveDaLinha={(l) => l.chave}
              porPagina={25}
              mensagemVazia="Nenhum CT-e para atualizar."
            />
          )}
          {aba === "ocorrencias" && (
            <TabelaDados
              colunas={[
                { chave: "chave", titulo: "CT-e", classe: "font-mono" },
                { chave: "codigo", titulo: "Código", formato: "inteiro" },
                {
                  chave: "dataHora",
                  titulo: "Data/hora",
                  formato: "datahora",
                  classe: "whitespace-nowrap",
                },
              ]}
              linhas={resultado.ocorrencias}
              chaveDaLinha={(l) => `${l.chave}-${l.codigo}-${l.dataHora}`}
              porPagina={25}
              mensagemVazia="Nenhuma ocorrência nova."
            />
          )}
          {aba === "ignorados" && (
            <TabelaDados
              colunas={[
                { chave: "motivo", titulo: "Motivo" },
                { chave: "chave", titulo: "CT-e", classe: "font-mono" },
              ]}
              linhas={resultado.ignorados}
              chaveDaLinha={(l) => `${l.motivo}-${l.chave}`}
              porPagina={25}
              mensagemVazia="Nenhum CT-e ignorado."
            />
          )}
          {aba === "romaneio_036" && (
            <p className="rounded-xl border border-border bg-card px-4 py-3 text-[13px]">
              {resultado.romaneio036 === null
                ? "O romaneio pelo 036 roda no último bloco."
                : `${resultado.romaneio036} CT-e com romaneio/ocorrência do 036 ${resultado.dryRun ? "a atualizar" : "atualizados"}.`}
            </p>
          )}
        </div>
      )}

      <TabelaDados
        titulo="Histórico das aplicações"
        colunas={[
          {
            chave: "iniciadoEm",
            titulo: "Início",
            formato: "datahora",
            classe: "whitespace-nowrap",
          },
          {
            chave: "simulacao",
            titulo: "Tipo",
            valor: (a) => (a.simulacao ? "Simulação" : "Aplicação"),
          },
          {
            chave: "status",
            titulo: "Situação",
            celula: (a) => <SeloDaSituacao status={a.status} />,
            valor: (a) => a.status,
          },
          { chave: "totalInseridos", titulo: "Inseridos", formato: "inteiro" },
          { chave: "totalAtualizados", titulo: "Atualizados", formato: "inteiro" },
          { chave: "totalOcorrencias", titulo: "Ocorrências", formato: "inteiro" },
          { chave: "totalIgnorados", titulo: "Ignorados", formato: "inteiro" },
          { chave: "erro", titulo: "Erro", classe: "max-w-[280px] truncate" },
        ]}
        linhas={aplicacoes}
        chaveDaLinha={(a) => a.id}
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={aoTentarDeNovo}
        mensagemVazia="Nenhuma aplicação registrada."
        porPagina={10}
      />
    </div>
  );
}
