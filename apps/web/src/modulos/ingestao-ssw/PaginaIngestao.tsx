import {
  contratosIngestaoSsw as c,
  type EventoWebhook,
  type SincronizacaoBi2,
} from "@erp/shared/contratos/ingestao-ssw";
import { formatarData, formatarDataHora, formatarInteiro } from "@erp/shared/formatacao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, History, Play, RotateCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Badge } from "@/componentes/ui/badge";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { CHAVE_DA_INGESTAO, consultaBi2, consultaEventosWebhook } from "./api";
import { Cartao, SeloDoEvento, situacaoDoEvento } from "./Cartao";
import { CartaoCredenciaisSsw } from "./CartaoCredenciaisSsw";

/**
 * Admin › Ingestão SSW (só a Plataforma, na empresa ativa): BI2 0017, credenciais da SSW API e
 * últimos eventos do webhook. Sem o cabeçalho explicativo nem os cards de backfill (Q41, Q45).
 * origem: routes/_authenticated/admin.ingestao.tsx (sistema atual)
 */
export function PaginaIngestao() {
  const eventos = useQuery(consultaEventosWebhook);
  const ultima = eventos.data?.ultimaAtividade ?? null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-medium tracking-tight">Ingestão SSW</h1>
        <p className="text-[12px] text-muted-foreground">
          Última atividade do webhook:{" "}
          {ultima ? formatarDataHora(ultima) : "nenhum evento recebido ainda"}
        </p>
      </div>
      <CartaoBi2 />
      <CartaoCredenciaisSsw />
      <CartaoEventosWebhook />
    </div>
  );
}

const COLUNAS_DO_BI2: ColunaTabela<SincronizacaoBi2>[] = [
  { chave: "iniciadoEm", titulo: "Início", formato: "datahora" },
  { chave: "dataAlvo", titulo: "Data", formato: "data" },
  { chave: "modo", titulo: "Modo" },
  { chave: "status", titulo: "Status", celula: (s) => <SeloDoStatus status={s.status} /> },
  { chave: "totalLinhas", titulo: "Linhas", formato: "inteiro" },
  { chave: "atualizados", titulo: "Atualizados", formato: "inteiro" },
  { chave: "erro", titulo: "Erro", classe: "max-w-[320px] truncate" },
];

function SeloDoStatus({ status }: { status: string }) {
  const variante = status === "erro" ? "destructive" : status === "ok" ? "default" : "secondary";
  return <Badge variant={variante}>{status}</Badge>;
}

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
    <Cartao
      titulo="SSW BI2 (0017)"
      icone={<Database className="h-4 w-4" aria-hidden />}
      direita="cron contínuo às :12 e :42, lookback de 2 dias"
    >
      <p className="text-[12px] text-muted-foreground">
        Atualiza entrega, previsão e prazo dos CT-e pelo relatório 0017. O BI2 nunca altera CT-e em
        andamento; depois da entrega, só o ajuste de prazo entra.
      </p>
      {consulta.error ? (
        <MensagemErro
          erro={consulta.error}
          titulo="Não foi possível carregar o BI2"
          aoTentarDeNovo={() => void consulta.refetch()}
        />
      ) : (
        <div className="text-[12px]">
          {ultima ? (
            <span>
              Última execução: {formatarDataHora(ultima.iniciadoEm)} · data{" "}
              {formatarData(ultima.dataAlvo)} · <SeloDoStatus status={ultima.status} /> ·{" "}
              {formatarInteiro(ultima.totalLinhas)} linha(s) · {formatarInteiro(ultima.atualizados)}{" "}
              atualizado(s)
              {ultima.erro && <span className="text-destructive"> · {ultima.erro}</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">Nenhuma execução registrada ainda.</span>
          )}
        </div>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (data) rodar.mutate(data);
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="bi2-data" className="text-[12px]">
            Data específica
          </Label>
          <Input
            id="bi2-data"
            type="date"
            value={data}
            onChange={(e) => {
              setData(e.target.value);
            }}
            className="h-8 w-[160px]"
          />
        </div>
        <Button type="submit" size="sm" disabled={!data || rodar.isPending}>
          <Play className="mr-1.5 h-3 w-3" aria-hidden />
          {rodar.isPending ? "Rodando…" : "Rodar data específica"}
        </Button>
      </form>
      <TabelaDados
        titulo="Últimas execuções"
        colunas={COLUNAS_DO_BI2}
        linhas={consulta.data?.recentes ?? []}
        chaveDaLinha={(s) => `${s.iniciadoEm}-${s.dataAlvo}-${s.modo}`}
        carregando={consulta.isLoading}
        mensagemVazia="Nenhuma execução registrada ainda."
        porPagina={0}
      />
    </Cartao>
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
        <span className="whitespace-nowrap">
          <SeloDoEvento situacao={situacaoDoEvento(e)} />
          <span className="ml-1 text-[10px] text-muted-foreground">HTTP {e.statusHttp}</span>
        </span>
      ),
    },
    {
      chave: "numeroCte",
      titulo: "CTRC",
      celula: (e) =>
        e.numeroCte ? (
          <a
            href={`/ctrc/${encodeURIComponent(e.numeroCte)}`}
            className="font-mono text-[var(--marca-primaria,inherit)] hover:underline"
          >
            {e.numeroCte}
          </a>
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
            className="h-7"
            disabled={reprocessar.isPending && reprocessar.variables === e.id}
            onClick={() => {
              reprocessar.mutate(e.id);
            }}
          >
            <RotateCw className="mr-1.5 h-3 w-3" aria-hidden />
            Reprocessar
          </Button>
        ) : null,
    },
  ];

  return (
    <Cartao
      titulo="Últimos eventos do webhook"
      icone={<History className="h-4 w-4" aria-hidden />}
      direita={`${eventos.length} evento(s) · atualiza a cada 15s`}
    >
      <TabelaDados
        colunas={colunas}
        linhas={eventos}
        chaveDaLinha={(e) => e.id}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        mensagemVazia="Nenhum evento recebido ainda."
        porPagina={0}
      />
    </Cartao>
  );
}
