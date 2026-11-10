import {
  type ContagemWebhook,
  contratosIngestaoSsw as c,
  type SincronizacaoBi2,
  type StatusDoJob,
} from "@erp/shared/contratos/ingestao-ssw";
import { formatarDataHora, formatarInteiro } from "@erp/shared/formatacao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Inbox, ListChecks, RotateCw, Webhook } from "lucide-react";
import { toast } from "sonner";

import { KpiCard } from "@/componentes/comum/KpiCard";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Badge } from "@/componentes/ui/badge";
import { Button } from "@/componentes/ui/button";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { CHAVE_DA_INGESTAO, consultaDiagnostico } from "./api";
import { Cartao } from "./Cartao";
import { CartaoCredenciaisSsw } from "./CartaoCredenciaisSsw";

/**
 * Plataforma › Diagnóstico SSW (empresa ativa): situação dos jobs no BullMQ, últimas
 * sincronizações, webhook nas últimas 24 h e 7 dias, órfãos e o teste do token.
 * origem: routes/_authenticated/admin.ssw-diagnostico.tsx (sistema atual)
 */
export function PaginaDiagnostico() {
  const consulta = useQuery(consultaDiagnostico);
  const d = consulta.data;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-medium tracking-tight">Diagnóstico SSW</h1>
        <p className="text-[12px] text-muted-foreground">
          Situação dos jobs de ingestão, do webhook e do token da SSW API na empresa ativa.
        </p>
      </div>
      {consulta.error && (
        <MensagemErro
          erro={consulta.error}
          titulo="Não foi possível carregar o diagnóstico"
          aoTentarDeNovo={() => void consulta.refetch()}
        />
      )}
      <CartaoJobs
        jobs={d?.jobs ?? []}
        disponivel={d?.filasDisponiveis ?? true}
        carregando={consulta.isLoading}
      />
      {d && <CartaoWebhook webhook={d.webhook} />}
      {d && <CartaoOrfaos orfaos={d.orfaos} />}
      <CartaoSincronizacoes linhas={d?.sincronizacoes ?? []} carregando={consulta.isLoading} />
      <CartaoCredenciaisSsw />
      <CartaoReprocessarToken />
    </div>
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
          <Badge variant="outline">integração desligada</Badge>
        ) : j.cron === null ? (
          <Badge variant="secondary">sob demanda</Badge>
        ) : j.agendado ? (
          <Badge variant="default">agendado</Badge>
        ) : (
          <Badge variant="secondary">fora do agendador</Badge>
        ),
    },
    { chave: "cron", titulo: "Cron (UTC)", classe: "font-mono whitespace-nowrap" },
    { chave: "proximaExecucao", titulo: "Próxima", formato: "datahora" },
    { chave: "ultimaConclusao", titulo: "Última conclusão", formato: "datahora" },
    { chave: "aguardando", titulo: "Na fila", formato: "inteiro" },
    { chave: "ativos", titulo: "Rodando", formato: "inteiro" },
    {
      chave: "falhos",
      titulo: "Falhas",
      formato: "inteiro",
      celula: (j) => (
        <span className={j.falhos > 0 ? "font-medium text-destructive" : ""}>
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
          <span title={f.erro} className="text-destructive">
            {quando(f.quando)} · {f.tentativas} tentativa(s) · {f.erro}
          </span>
        ) : null;
      },
      classe: "max-w-[360px] truncate",
    },
  ];
  return (
    <Cartao
      titulo="Jobs de ingestão"
      icone={<ListChecks className="h-4 w-4" aria-hidden />}
      direita="contagens da fila inteira; falhas e conclusão da empresa ativa"
    >
      {!disponivel && (
        <p className="text-[12px] text-amber-700 dark:text-amber-400">
          A fila de processamento não está disponível agora: a situação dos jobs não pôde ser lida.
        </p>
      )}
      <TabelaDados
        colunas={colunas}
        linhas={jobs}
        chaveDaLinha={(j) => j.job}
        carregando={carregando}
        porPagina={0}
        configurarColunas
      />
    </Cartao>
  );
}

function KpisDoWebhook({ rotulo, c: n }: { rotulo: string; c: ContagemWebhook }) {
  return (
    <div className="space-y-2">
      <div className="text-[12px] font-medium text-muted-foreground">{rotulo}</div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <KpiCard
          rotulo="Recebidos"
          valor={formatarInteiro(n.total)}
          status="bom"
          detalhe=""
          neutro
        />
        <KpiCard
          rotulo="Processados"
          valor={formatarInteiro(n.processados)}
          status="bom"
          detalhe=""
        />
        <KpiCard
          rotulo="Sem vínculo"
          valor={formatarInteiro(n.semVinculo)}
          status={n.semVinculo > 0 ? "alerta" : "bom"}
          detalhe="CT-e não encontrado"
        />
        <KpiCard
          rotulo="Rejeitados"
          valor={formatarInteiro(n.rejeitados)}
          status={n.rejeitados > 0 ? "alerta" : "bom"}
          detalhe="token, CNPJ ou formato"
        />
        <KpiCard
          rotulo="Erros"
          valor={formatarInteiro(n.erros)}
          status={n.erros > 0 ? "ruim" : "bom"}
          detalhe="falha ao gravar"
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
    <Cartao
      titulo="Webhook SSW2181"
      icone={<Webhook className="h-4 w-4" aria-hidden />}
      direita={`última atividade: ${webhook.ultimaAtividade ? formatarDataHora(webhook.ultimaAtividade) : "nenhuma"}`}
    >
      <KpisDoWebhook rotulo="Últimas 24 horas" c={webhook.ultimas24h} />
      <KpisDoWebhook rotulo="Últimos 7 dias" c={webhook.ultimos7d} />
    </Cartao>
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
    <Cartao titulo="Órfãos" icone={<Inbox className="h-4 w-4" aria-hidden />}>
      <div className="grid gap-2 md:grid-cols-2">
        <KpiCard
          rotulo="Webhook sem CT-e (7 dias)"
          valor={formatarInteiro(orfaos.webhookSemVinculo7d)}
          status={orfaos.webhookSemVinculo7d > 0 ? "alerta" : "bom"}
          detalhe="ocorrência recebida para número que não existe"
        />
        <KpiCard
          rotulo="XML de CT-e aguardando"
          valor={formatarInteiro(orfaos.xmlPendentes)}
          status={orfaos.xmlPendentes > 0 ? "alerta" : "bom"}
          detalhe="XML do FTP sem o CT-e correspondente"
        />
      </div>
      {orfaos.recentes.length > 0 && (
        <ul className="space-y-0.5 text-[12px]">
          {orfaos.recentes.map((o) => (
            <li key={o.id} className="flex gap-2">
              <span className="text-muted-foreground">{formatarDataHora(o.recebidoEm)}</span>
              <span className="font-mono">{o.numero ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

const COLUNAS_DAS_SINCRONIZACOES: ColunaTabela<SincronizacaoBi2>[] = [
  { chave: "relatorio", titulo: "Relatório", classe: "font-mono" },
  { chave: "iniciadoEm", titulo: "Início", formato: "datahora" },
  { chave: "finalizadoEm", titulo: "Fim", formato: "datahora" },
  { chave: "dataAlvo", titulo: "Data", formato: "data" },
  { chave: "modo", titulo: "Modo" },
  { chave: "status", titulo: "Status" },
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
    <Cartao
      titulo="Últimas sincronizações do BI2"
      icone={<Activity className="h-4 w-4" aria-hidden />}
    >
      <TabelaDados
        colunas={COLUNAS_DAS_SINCRONIZACOES}
        linhas={linhas}
        chaveDaLinha={(s) => `${s.relatorio}-${s.iniciadoEm}-${s.dataAlvo}`}
        carregando={carregando}
        mensagemVazia="Nenhuma sincronização registrada ainda."
        porPagina={0}
      />
    </Cartao>
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
    <Cartao
      titulo="Reprocessar webhooks rejeitados por token"
      icone={<RotateCw className="h-4 w-4" aria-hidden />}
    >
      <p className="text-[12px] text-muted-foreground">
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
        {reprocessar.isPending ? "Reenviando…" : "Reprocessar agora"}
      </Button>
      {reprocessar.data && (
        <p className="text-[12px]">
          Total: {formatarInteiro(reprocessar.data.total)} · Reenviados:{" "}
          {formatarInteiro(reprocessar.data.enfileirados)}
        </p>
      )}
    </Cartao>
  );
}
