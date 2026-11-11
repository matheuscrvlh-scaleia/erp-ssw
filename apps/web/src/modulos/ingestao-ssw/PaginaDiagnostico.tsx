import {
  type ContagemWebhook,
  contratosIngestaoSsw as c,
  type SincronizacaoBi2,
  type StatusDoJob,
} from "@erp/shared/contratos/ingestao-ssw";
import { formatarDataHora, formatarInteiro } from "@erp/shared/formatacao";
import { useIsFetching, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCheck,
  FileClock,
  Hand,
  Inbox,
  ListChecks,
  PowerOff,
  RefreshCw,
  RotateCw,
  ServerCrash,
  ShieldX,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";

import { Aviso } from "@/componentes/comum/Aviso";
import { KpiCard } from "@/componentes/comum/KpiCard";
import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Pagina, Secao } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";
import { SeloDaSituacao } from "@/modulos/ingestao/pecas";

import { CHAVE_DA_INGESTAO, consultaDiagnostico } from "./api";
import { CartaoCredenciaisSsw } from "./CartaoCredenciaisSsw";

/**
 * Plataforma › Diagnóstico SSW (empresa ativa): situação dos jobs no BullMQ, últimas
 * sincronizações, webhook nas últimas 24 h e 7 dias, órfãos e o teste do token.
 * origem: routes/_authenticated/admin.ssw-diagnostico.tsx (sistema atual)
 */
export function PaginaDiagnostico() {
  const queryClient = useQueryClient();
  const consulta = useQuery(consultaDiagnostico);
  const atualizando = useIsFetching({ queryKey: CHAVE_DA_INGESTAO }) > 0;
  const d = consulta.data;
  return (
    <Pagina
      titulo="Diagnóstico SSW"
      descricao="Situação dos jobs de ingestão, do webhook e do token da SSW API na empresa ativa."
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
      {consulta.error && (
        <Aviso
          tom="erro"
          titulo="Não foi possível carregar o diagnóstico"
          acao={
            <Button size="sm" variant="outline" onClick={() => void consulta.refetch()}>
              <RefreshCw aria-hidden />
              Tentar novamente
            </Button>
          }
        >
          {mensagemAmigavel(consulta.error)}
        </Aviso>
      )}
      {d && <CartaoWebhook webhook={d.webhook} />}
      {d && <CartaoOrfaos orfaos={d.orfaos} />}
      <CartaoJobs
        jobs={d?.jobs ?? []}
        disponivel={d?.filasDisponiveis ?? true}
        carregando={consulta.isLoading}
      />
      <CartaoSincronizacoes linhas={d?.sincronizacoes ?? []} carregando={consulta.isLoading} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <CartaoCredenciaisSsw />
        <CartaoReprocessarToken />
      </div>
    </Pagina>
  );
}

function quando(iso: string | null): string {
  return iso ? formatarDataHora(iso) : "—";
}

function CartaoJobs({
  jobs,
  disponivel,
  carregando,
}: {
  jobs: StatusDoJob[];
  disponivel: boolean;
  carregando: boolean;
}) {
  const colunas: ColunaTabela<StatusDoJob>[] = [
    { chave: "job", titulo: "Job", classe: "font-mono whitespace-nowrap", fixa: true },
    { chave: "descricao", titulo: "Descrição", classe: "max-w-[280px] truncate" },
    {
      chave: "situacao",
      titulo: "Situação",
      valor: (j) => (!j.integracaoLigada ? "desligada" : j.agendado ? "agendado" : "parado"),
      celula: (j) =>
        !j.integracaoLigada ? (
          <SeloStatus tom="neutro" icone={PowerOff}>
            integração desligada
          </SeloStatus>
        ) : j.cron === null ? (
          <SeloStatus tom="info" icone={Hand}>
            sob demanda
          </SeloStatus>
        ) : j.agendado ? (
          <SeloStatus tom="sucesso" icone={CalendarClock}>
            agendado
          </SeloStatus>
        ) : (
          <SeloStatus tom="alerta">fora do agendador</SeloStatus>
        ),
    },
    { chave: "cron", titulo: "Cron (UTC)", classe: "font-mono whitespace-nowrap" },
    {
      chave: "proximaExecucao",
      titulo: "Próxima",
      formato: "datahora",
      classe: "whitespace-nowrap",
    },
    {
      chave: "ultimaConclusao",
      titulo: "Última conclusão",
      formato: "datahora",
      classe: "whitespace-nowrap",
    },
    { chave: "aguardando", titulo: "Na fila", formato: "inteiro" },
    { chave: "ativos", titulo: "Rodando", formato: "inteiro" },
    {
      chave: "falhos",
      titulo: "Falhas",
      formato: "inteiro",
      celula: (j) => (
        <span className={cn(j.falhos > 0 && "font-semibold text-status-bad-fg")}>
          {formatarInteiro(j.falhos)}
        </span>
      ),
    },
    {
      chave: "ultimaFalha",
      titulo: "Última falha da empresa",
      valor: (j) => j.ultimasFalhas[0]?.erro ?? null,
      celula: (j) => {
        const f = j.ultimasFalhas[0];
        return f ? (
          <span title={f.erro} className="text-status-bad-fg">
            {quando(f.quando)} · {f.tentativas} tentativa(s) · {f.erro}
          </span>
        ) : null;
      },
      classe: "max-w-[360px] truncate",
    },
  ];
  return (
    <Painel
      icone={ListChecks}
      titulo="Jobs de ingestão"
      descricao="contagens da fila inteira; falhas e conclusão da empresa ativa"
      classeDoCorpo="space-y-4 p-5"
    >
      {!disponivel && (
        <Aviso tom="alerta">
          A fila de processamento não está disponível agora: a situação dos jobs não pôde ser lida.
        </Aviso>
      )}
      <TabelaDados
        colunas={colunas}
        linhas={jobs}
        chaveDaLinha={(j) => j.job}
        carregando={carregando}
        porPagina={0}
        configurarColunas
        embutida
      />
    </Painel>
  );
}

function KpisDoWebhook({ rotulo, c: n }: { rotulo: string; c: ContagemWebhook }) {
  return (
    <div className="space-y-2.5">
      <h3 className="label-xs">{rotulo}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          rotulo="Recebidos"
          valor={formatarInteiro(n.total)}
          status="bom"
          detalhe=""
          neutro
          icone={Inbox}
        />
        <KpiCard
          rotulo="Processados"
          valor={formatarInteiro(n.processados)}
          status="bom"
          detalhe=""
          icone={CheckCheck}
        />
        <KpiCard
          rotulo="Sem vínculo"
          valor={formatarInteiro(n.semVinculo)}
          status={n.semVinculo > 0 ? "alerta" : "bom"}
          detalhe="CT-e não encontrado"
          icone={Unlink}
        />
        <KpiCard
          rotulo="Rejeitados"
          valor={formatarInteiro(n.rejeitados)}
          status={n.rejeitados > 0 ? "alerta" : "bom"}
          detalhe="token, CNPJ ou formato"
          icone={ShieldX}
        />
        <KpiCard
          rotulo="Erros"
          valor={formatarInteiro(n.erros)}
          status={n.erros > 0 ? "ruim" : "bom"}
          detalhe="falha ao gravar"
          icone={ServerCrash}
        />
      </div>
    </div>
  );
}

function CartaoWebhook({
  webhook,
}: {
  webhook: {
    ultimaAtividade: string | null;
    ultimas24h: ContagemWebhook;
    ultimos7d: ContagemWebhook;
  };
}) {
  return (
    <Secao
      titulo="Webhook SSW2181"
      descricao={`última atividade: ${webhook.ultimaAtividade ? formatarDataHora(webhook.ultimaAtividade) : "nenhuma"}`}
      className="space-y-4"
    >
      <KpisDoWebhook rotulo="Últimas 24 horas" c={webhook.ultimas24h} />
      <KpisDoWebhook rotulo="Últimos 7 dias" c={webhook.ultimos7d} />
    </Secao>
  );
}

function CartaoOrfaos({
  orfaos,
}: {
  orfaos: {
    webhookSemVinculo7d: number;
    recentes: { id: string; recebidoEm: string; numero: string | null }[];
    xmlPendentes: number;
  };
}) {
  return (
    <Secao titulo="Órfãos">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          rotulo="Webhook sem CT-e (7 dias)"
          valor={formatarInteiro(orfaos.webhookSemVinculo7d)}
          status={orfaos.webhookSemVinculo7d > 0 ? "alerta" : "bom"}
          detalhe="ocorrência recebida para número que não existe"
          icone={Unlink}
        />
        <KpiCard
          rotulo="XML de CT-e aguardando"
          valor={formatarInteiro(orfaos.xmlPendentes)}
          status={orfaos.xmlPendentes > 0 ? "alerta" : "bom"}
          detalhe="XML do FTP sem o CT-e correspondente"
          icone={FileClock}
        />
        {orfaos.recentes.length > 0 && (
          <Painel className="md:col-span-2 xl:col-span-1">
            <ul className="rolagem-fina max-h-[168px] divide-y divide-border overflow-y-auto text-[13px]">
              {orfaos.recentes.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="text-muted-foreground tabular-nums">
                    {formatarDataHora(o.recebidoEm)}
                  </span>
                  <span className="font-mono font-semibold">{o.numero ?? "—"}</span>
                </li>
              ))}
            </ul>
          </Painel>
        )}
      </div>
    </Secao>
  );
}

const COLUNAS_DAS_SINCRONIZACOES: ColunaTabela<SincronizacaoBi2>[] = [
  { chave: "relatorio", titulo: "Relatório", classe: "font-mono" },
  { chave: "iniciadoEm", titulo: "Início", formato: "datahora", classe: "whitespace-nowrap" },
  { chave: "finalizadoEm", titulo: "Fim", formato: "datahora", classe: "whitespace-nowrap" },
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

function CartaoSincronizacoes({
  linhas,
  carregando,
}: {
  linhas: SincronizacaoBi2[];
  carregando: boolean;
}) {
  return (
    <TabelaDados
      titulo="Últimas sincronizações do BI2"
      colunas={COLUNAS_DAS_SINCRONIZACOES}
      linhas={linhas}
      chaveDaLinha={(s) => `${s.relatorio}-${s.iniciadoEm}-${s.dataAlvo}`}
      carregando={carregando}
      mensagemVazia="Nenhuma sincronização registrada ainda."
      porPagina={0}
    />
  );
}

function CartaoReprocessarToken() {
  const queryClient = useQueryClient();
  const reprocessar = useMutation({
    mutationFn: () => chamar(c.reprocessarTokenIncorreto),
    onSuccess: async (r) => {
      if (r.total === 0) toast.info("Nenhum evento rejeitado por token com conteúdo guardado.");
      else
        toast.success(
          `${formatarInteiro(r.enfileirados)} evento(s) reenviado(s) para processamento.`,
        );
      await queryClient.invalidateQueries({ queryKey: CHAVE_DA_INGESTAO });
    },
    onError: (e) =>
      toast.error("Não foi possível reprocessar", { description: mensagemAmigavel(e) }),
  });
  return (
    <Painel
      icone={RotateCw}
      titulo="Reprocessar webhooks rejeitados por token"
      classeDoCorpo="space-y-4 p-5"
    >
      <p className="text-[13px] text-muted-foreground">
        Reenvia ao processamento os eventos recusados com &quot;token incorreto&quot; que guardaram
        o conteúdo recebido e cujo token é o segredo atual ou o anterior. Use depois de corrigir o
        segredo do webhook.
      </p>
      <Button
        size="sm"
        onClick={() => {
          reprocessar.mutate();
        }}
        disabled={reprocessar.isPending}
      >
        <RotateCw className={cn(reprocessar.isPending && "motion-safe:animate-spin")} aria-hidden />
        {reprocessar.isPending ? "Reenviando…" : "Reprocessar agora"}
      </Button>
      {reprocessar.data && (
        <p className="text-[13px] tabular-nums">
          Total: {formatarInteiro(reprocessar.data.total)} · Reenviados:{" "}
          {formatarInteiro(reprocessar.data.enfileirados)}
        </p>
      )}
    </Painel>
  );
}
