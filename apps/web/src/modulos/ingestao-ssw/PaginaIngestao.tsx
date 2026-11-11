import {
  contratosIngestaoSsw as c,
  type EventoWebhook,
  type SincronizacaoBi2,
} from "@erp/shared/contratos/ingestao-ssw";
import { formatarData, formatarDataHora, formatarInteiro } from "@erp/shared/formatacao";
import { useIsFetching, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Database, Play, RefreshCw, RotateCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";
import { SeloDaSituacao } from "@/modulos/ingestao/pecas";

import { CHAVE_DA_INGESTAO, consultaBi2, consultaEventosWebhook } from "./api";
import { CartaoCredenciaisSsw } from "./CartaoCredenciaisSsw";
import { SeloDoEvento, situacaoDoEvento } from "./eventos";

/**
 * Admin › Ingestão SSW (só a Plataforma, na empresa ativa): BI2 0017, credenciais da SSW API e
 * últimos eventos do webhook. Sem o cabeçalho explicativo nem os cards de backfill (Q41, Q45).
 * origem: routes/_authenticated/admin.ingestao.tsx (sistema atual)
 */
export function PaginaIngestao() {
  const queryClient = useQueryClient();
  const eventos = useQuery(consultaEventosWebhook);
  const atualizando = useIsFetching({ queryKey: CHAVE_DA_INGESTAO }) > 0;
  const ultima = eventos.data?.ultimaAtividade ?? null;
  return (
    <Pagina
      titulo="Ingestão SSW"
      descricao={
        <>
          Última atividade do webhook:{" "}
          {ultima ? formatarDataHora(ultima) : "nenhum evento recebido ainda"}
        </>
      }
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
      <CartaoBi2 />
      <CartaoCredenciaisSsw />
      <CartaoEventosWebhook />
    </Pagina>
  );
}

const COLUNAS_DO_BI2: ColunaTabela<SincronizacaoBi2>[] = [
  { chave: "iniciadoEm", titulo: "Início", formato: "datahora", classe: "whitespace-nowrap" },
  { chave: "dataAlvo", titulo: "Data", formato: "data" },
  { chave: "modo", titulo: "Modo" },
  {
    chave: "status",
    titulo: "Status",
    celula: (s) => <SeloDaSituacao status={s.status} />,
    valor: (s) => s.status,
  },
  { chave: "totalLinhas", titulo: "Linhas", formato: "inteiro" },
  { chave: "atualizados", titulo: "Atualizados", formato: "inteiro" },
  { chave: "erro", titulo: "Erro", classe: "max-w-[320px] truncate" },
];

function CartaoBi2() {
  const queryClient = useQueryClient();
  const consulta = useQuery(consultaBi2);
  const [data, setData] = useState("");
  const rodar = useMutation({
    mutationFn: (alvo: string) => chamar(c.rodarBi2, { entrada: { data: alvo } }),
    onSuccess: async (r) => {
      if (r.pendente) toast.info("BI2 0017 enfileirado. O resultado aparece aqui ao terminar.");
      else
        toast.success(
          `BI2 0017 concluído · ${formatarInteiro(r.resultado?.atualizados ?? 0)} CT-e atualizado(s)`,
        );
      await queryClient.invalidateQueries({ queryKey: CHAVE_DA_INGESTAO });
    },
    onError: (e) =>
      toast.error("Não foi possível rodar o BI2", { description: mensagemAmigavel(e) }),
  });
  const ultima = consulta.data?.ultima ?? null;

  return (
    <Painel
      icone={Database}
      titulo="SSW BI2 (0017)"
      descricao="cron contínuo às :12 e :42, lookback de 2 dias"
      classeDoCorpo="space-y-4 p-5"
    >
      <p className="text-[13px] text-muted-foreground">
        Atualiza entrega, previsão e prazo dos CT-e pelo relatório 0017. O BI2 nunca altera CT-e em
        andamento; depois da entrega, só o ajuste de prazo entra.
      </p>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        {consulta.error ? (
          <MensagemErro
            erro={consulta.error}
            titulo="Não foi possível carregar o BI2"
            aoTentarDeNovo={() => void consulta.refetch()}
            className="items-start py-0 text-left"
          />
        ) : ultima ? (
          <div className="min-w-0 space-y-1.5">
            <div className="label-xs">Última execução</div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] tabular-nums">
              <span className="font-semibold">{formatarDataHora(ultima.iniciadoEm)}</span>
              <SeloDaSituacao status={ultima.status} />
              <span className="text-muted-foreground">
                data {formatarData(ultima.dataAlvo)} · {formatarInteiro(ultima.totalLinhas)}{" "}
                linha(s) · {formatarInteiro(ultima.atualizados)} atualizado(s)
              </span>
            </div>
            {ultima.erro && <p className="text-[13px] text-status-bad-fg">{ultima.erro}</p>}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">Nenhuma execução registrada ainda.</p>
        )}
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (data) rodar.mutate(data);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="bi2-data" className="text-[13px]">
              Data específica
            </Label>
            <Input
              id="bi2-data"
              type="date"
              value={data}
              onChange={(e) => {
                setData(e.target.value);
              }}
              className="h-9 w-[170px]"
            />
          </div>
          <Button type="submit" disabled={!data || rodar.isPending}>
            <Play aria-hidden />
            {rodar.isPending ? "Rodando…" : "Rodar data específica"}
          </Button>
        </form>
      </div>
      <TabelaDados
        titulo="Últimas execuções"
        colunas={COLUNAS_DO_BI2}
        linhas={consulta.data?.recentes ?? []}
        chaveDaLinha={(s) => `${s.iniciadoEm}-${s.dataAlvo}-${s.modo}`}
        carregando={consulta.isLoading}
        mensagemVazia="Nenhuma execução registrada ainda."
        porPagina={0}
        embutida
      />
    </Painel>
  );
}

/** Rejeições de autenticação que um reprocesso resolve (depois de corrigir o segredo). */
const MOTIVOS_RECUPERAVEIS = new Set([
  "token_incorreto",
  "token_header_vazio",
  "autorizacao_ausente",
  "cnpj_nao_autorizado",
]);

function podeReprocessar(e: EventoWebhook): boolean {
  if (!e.temPayload) return false;
  const situacao = situacaoDoEvento(e);
  if (situacao === "erro" || situacao === "sem_vinculo") return true;
  return situacao === "rejeitado" && MOTIVOS_RECUPERAVEIS.has(e.motivoRejeicao ?? "");
}

function CartaoEventosWebhook() {
  const queryClient = useQueryClient();
  const consulta = useQuery(consultaEventosWebhook);
  const reprocessar = useMutation({
    mutationFn: (id: string) => chamar(c.reprocessarEvento, { parametros: { id } }),
    onSuccess: async () => {
      toast.success("Evento reenviado para processamento.");
      await queryClient.invalidateQueries({ queryKey: CHAVE_DA_INGESTAO });
    },
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
