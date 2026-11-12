import { type StatusDoJob } from "@erp/shared/contratos/ingestao-ssw";
import { formatarDataHora, formatarInteiro } from "@erp/shared/formatacao";
import { CalendarClock, Hand, ListChecks, PowerOff } from "lucide-react";

import { Aviso } from "@/componentes/comum/Aviso";
import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { cn } from "@/lib/utils";

function quando(iso: string | null): string {
  return iso ? formatarDataHora(iso) : "—";
}

export function CartaoJobs({
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
