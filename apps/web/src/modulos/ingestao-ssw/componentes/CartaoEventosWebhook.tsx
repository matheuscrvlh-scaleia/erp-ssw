import { type EventoWebhook } from "@erp/shared/contratos/ingestao-ssw";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";

import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { consultaEventosWebhook, mutacaoReprocessarEvento } from "../api";
import { podeReprocessar, situacaoDoEvento } from "../regras";
import { SeloDoEvento } from "./SeloDoEvento";

/** Últimos eventos do webhook (atualiza a cada 15s), com o reprocesso de cada um. */
export function CartaoEventosWebhook() {
  const queryClient = useQueryClient();
  const consulta = useQuery(consultaEventosWebhook);
  const reprocessar = useMutation({
    ...mutacaoReprocessarEvento(queryClient, () => {
      toast.success("Evento reenviado para processamento.");
    }),
    onError: (e) =>
      toast.error("Não foi possível reprocessar", { description: mensagemAmigavel(e) }),
  });
  const eventos = consulta.data?.eventos ?? [];

  const colunas: ColunaTabela<EventoWebhook>[] = [
    { chave: "recebidoEm", titulo: "Quando", formato: "datahora", classe: "whitespace-nowrap" },
    {
      chave: "situacao",
      titulo: "Status",
      valor: (e) => situacaoDoEvento(e),
      celula: (e) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <SeloDoEvento situacao={situacaoDoEvento(e)} />
          <span className="font-mono text-xs text-muted-foreground">HTTP {e.statusHttp}</span>
        </span>
      ),
    },
    {
      chave: "numeroCte",
      titulo: "CTRC",
      celula: (e) =>
        e.numeroCte ? (
          <Link
            to="/ctrc/$numero"
            params={{ numero: e.numeroCte }}
            className="font-mono font-semibold text-brand hover:underline"
          >
            {e.numeroCte}
          </Link>
        ) : null,
    },
    {
      chave: "motivo",
      titulo: "Motivo / erro",
      valor: (e) => e.motivoRejeicao ?? e.erroProcessamento,
      classe: "max-w-[420px] truncate",
    },
    {
      chave: "acao",
      titulo: "Ação",
      ordenavel: false,
      semExportar: true,
      alinhamento: "direita",
      celula: (e) =>
        podeReprocessar(e) ? (
          <Button
            size="sm"
            variant="outline"
            disabled={reprocessar.isPending && reprocessar.variables === e.id}
            onClick={() => {
              reprocessar.mutate(e.id);
            }}
          >
            <RotateCw aria-hidden />
            Reprocessar
          </Button>
        ) : null,
    },
  ];

  return (
    <TabelaDados
      titulo="Últimos eventos do webhook"
      acoes={
        <span className="text-[13px] text-muted-foreground tabular-nums">
          {eventos.length} evento(s) · atualiza a cada 15s
        </span>
      }
      colunas={colunas}
      linhas={eventos}
      chaveDaLinha={(e) => e.id}
      carregando={consulta.isLoading}
      erro={consulta.error}
      aoTentarDeNovo={() => void consulta.refetch()}
      mensagemVazia="Nenhum evento recebido ainda."
      porPagina={0}
    />
  );
}
