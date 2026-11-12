import { tempoDecorrido } from "@erp/dominio/painel-plataforma";
import { type MotivoDaSaude } from "@erp/shared/contratos/ingestao-ssw";
import {
  type EmpresaNoPainel,
  type NivelDeSaude,
  type PainelPlataforma,
} from "@erp/shared/contratos/painel-plataforma";
import {
  formatarData,
  formatarDataHora,
  formatarInteiro,
  formatarPercentual,
} from "@erp/shared/formatacao";
import { ROTULO_DO_STATUS } from "@erp/shared/plataforma";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  AlarmClock,
  Building2,
  ChartColumnStacked,
  FileText,
  Gauge,
  HeartPulse,
  RefreshCw,
  Users,
} from "lucide-react";

import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { GraficoBarras } from "@/componentes/comum/Graficos";
import { KpiCard, type StatusKpi } from "@/componentes/comum/KpiCard";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus, type Tom } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/componentes/ui/tooltip";
import { cn } from "@/lib/utils";

import { consultaPainelDaPlataforma } from "./api";

const SAUDE: Record<NivelDeSaude, { tom: Tom; texto: string; ordem: number }> = {
  critico: { tom: "erro", texto: "Crítico", ordem: 0 },
  atencao: { tom: "alerta", texto: "Atenção", ordem: 1 },
  ok: { tom: "sucesso", texto: "Saudável", ordem: 2 },
  inativa: { tom: "neutro", texto: "Inativa", ordem: 3 },
};

const TOM_DO_SLA: Record<StatusKpi, Tom> = { bom: "sucesso", alerta: "alerta", ruim: "erro" };

const PROBLEMA_DA_SSW: Record<Exclude<MotivoDaSaude, "ok">, string> = {
  sem_credenciais: "Sem credenciais",
  sem_token: "Sem token",
  token_expirado: "Token expirado",
};

const pct = (v: number | null | undefined) => formatarPercentual(v, { separador: "." });

/** "agora", "há 25 min", "há 3 h", "há 2 dias" (a partir da hora em que o painel foi montado). */
export function haQuantoTempo(iso: string | null, referencia: string): string {
  if (!iso) return "Nunca";
  const ms = Date.parse(referencia) - Date.parse(iso);
  if (ms < 60_000) return "agora";
  if (ms < 3_600_000) return `há ${String(Math.floor(ms / 60_000))} min`;
  return `há ${tempoDecorrido(ms)}`;
}

/** SSW API: sem o worker-ssw o token não é conhecido (não é "sem token"). */
export function seloDaSsw(e: EmpresaNoPainel): { tom: Tom; texto: string } {
  const { ssw, workerSsw } = e;
  if (!ssw.configurado && ssw.motivo === "ok") return { tom: "neutro", texto: "Desligada" };
  if (ssw.saudavel || ssw.motivo === "ok") return { tom: "sucesso", texto: "Token válido" };
  const semWorker = workerSsw.situacao === "fora" || workerSsw.situacao === "nao_configurado";
  if (semWorker && ssw.motivo !== "sem_credenciais") {
    return { tom: "neutro", texto: "Token desconhecido" };
  }
  return { tom: "erro", texto: PROBLEMA_DA_SSW[ssw.motivo] };
}

function seloDoWorker(e: EmpresaNoPainel): { tom: Tom; texto: string; dica?: string } {
  const { situacao, jobsComFalha } = e.workerSsw;
  if (situacao === "ok") return { tom: "sucesso", texto: "OK" };
  if (situacao === "nao_configurado") return { tom: "neutro", texto: "Não configurado" };
  if (situacao === "fora") return { tom: "alerta", texto: "Não respondeu" };
  return {
    tom: "alerta",
    texto: `${String(jobsComFalha.length)} com falha`,
    dica: jobsComFalha.join(", "),
  };
}

/** Quando foi, por extenso na dica ("12/11/2026 10:58"). */
function Quando({ iso, referencia }: { iso: string | null; referencia: string }) {
  return (
    <span className="whitespace-nowrap" title={iso ? formatarDataHora(iso) : undefined}>
      {haQuantoTempo(iso, referencia)}
    </span>
  );
}

function SeloComDica({ selo }: { selo: { tom: Tom; texto: string; dica?: string } }) {
  return (
    <span title={selo.dica}>
      <SeloStatus tom={selo.tom}>{selo.texto}</SeloStatus>
    </span>
  );
}

/**
 * Situação e números primeiro (cabem em 1440 px); integração e acesso à direita, que a tabela rola
 * na horizontal. Entregues e Módulos começam escondidos (ligam em "Colunas").
 */
function colunas(geradoEm: string): ColunaTabela<EmpresaNoPainel>[] {
  const numero =
    (campo: (e: NonNullable<EmpresaNoPainel["numeros"]>) => number) => (e: EmpresaNoPainel) =>
      e.numeros ? campo(e.numeros) : null;
  return [
    {
      chave: "nome",
      titulo: "Empresa",
      fixa: true,
      celula: (e) => (
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-full border border-border"
            style={{ background: e.corPrimaria }}
          />
          <div className="min-w-0">
            <div className="font-semibold whitespace-nowrap text-foreground">{e.nome}</div>
            <div className="text-xs text-muted-foreground">{ROTULO_DO_STATUS[e.status]}</div>
          </div>
        </div>
      ),
    },
    {
      chave: "saude",
      titulo: "Saúde",
      valor: (e) => SAUDE[e.saude.nivel].ordem,
      celula: (e) => {
        const [primeiro, ...resto] = e.saude.motivos;
        return (
          <div className="min-w-40 space-y-1" title={e.saude.motivos.join("\n") || undefined}>
            <SeloStatus tom={SAUDE[e.saude.nivel].tom}>{SAUDE[e.saude.nivel].texto}</SeloStatus>
            {primeiro && (
              <div className="text-xs text-muted-foreground">
                {primeiro}
                {resto.length > 0 && ` · +${String(resto.length)}`}
              </div>
            )}
          </div>
        );
      },
    },
    {
      chave: "ctesNoMes",
      titulo: "CT-e no mês",
      formato: "inteiro",
      valor: numero((n) => n.ctesNoMes),
    },
    {
      chave: "entreguesNoMes",
      titulo: "Entregues",
      formato: "inteiro",
      oculta: true,
      valor: numero((n) => n.entreguesNoMes),
    },
    {
      chave: "sla",
      titulo: "SLA Op.",
      formato: "percentual",
      valor: (e) => e.numeros?.slaOperacional ?? null,
      celula: (e) => {
        const n = e.numeros;
        if (!n?.situacaoDoSla) return <span className="text-muted-foreground">—</span>;
        return (
          <SeloComDica
            selo={{
              tom: TOM_DO_SLA[n.situacaoDoSla],
              texto: pct(n.slaOperacional),
              dica: `Meta ${pct(n.slaMeta)}`,
            }}
          />
        );
      },
    },
    {
      chave: "emAtraso",
      titulo: "Em atraso",
      formato: "inteiro",
      valor: numero((n) => n.emAtraso),
    },
    {
      chave: "ultimoDadoEm",
      titulo: "Último dado",
      celula: (e) => (
        <div className="space-y-0.5">
          <Quando iso={e.ultimoDadoEm} referencia={geradoEm} />
          {(e.xml.pendentes > 0 || e.xml.expirados > 0) && (
            <div className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
              {formatarInteiro(e.xml.pendentes)} XML aguardando
              {e.xml.expirados > 0 && ` · ${formatarInteiro(e.xml.expirados)} expirados`}
            </div>
          )}
        </div>
      ),
    },
    {
      chave: "ssw",
      titulo: "SSW API",
      valor: (e) => seloDaSsw(e).texto,
      celula: (e) => <SeloComDica selo={seloDaSsw(e)} />,
    },
    {
      chave: "worker",
      titulo: "worker-ssw",
      valor: (e) => seloDoWorker(e).texto,
      celula: (e) => <SeloComDica selo={seloDoWorker(e)} />,
    },
    {
      chave: "ultimoLoginEm",
      titulo: "Último acesso",
      celula: (e) => <Quando iso={e.ultimoLoginEm} referencia={geradoEm} />,
    },
    { chave: "usuariosAtivos", titulo: "Usuários", formato: "inteiro" },
    { chave: "modulosLiberados", titulo: "Módulos", formato: "inteiro", oculta: true },
  ];
}

function statusDasEmpresas(t: PainelPlataforma["totais"]): StatusKpi {
  if (t.porNivel.critico > 0) return "ruim";
  return t.porNivel.atencao > 0 ? "alerta" : "bom";
}

/** "2 saudáveis · 1 em atenção · 1 crítica" (só os níveis que têm empresa). */
export function resumoDosNiveis(n: PainelPlataforma["totais"]["porNivel"]): string {
  const partes: [number, string, string][] = [
    [n.ok, "saudável", "saudáveis"],
    [n.atencao, "em atenção", "em atenção"],
    [n.critico, "crítica", "críticas"],
    [n.inativa, "inativa", "inativas"],
  ];
  return partes
    .filter(([qtd]) => qtd > 0)
    .map(([qtd, um, varios]) => `${formatarInteiro(qtd)} ${qtd === 1 ? um : varios}`)
    .join(" · ");
}

function Kpis({ painel }: { painel: PainelPlataforma | undefined }) {
  const t = painel?.totais;
  const plural = (n: number, um: string, varios: string) =>
    `${formatarInteiro(n)} ${n === 1 ? um : varios}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <KpiCard
        rotulo="Empresas"
        icone={Building2}
        valor={t ? formatarInteiro(t.empresas) : "—"}
        status={t ? statusDasEmpresas(t) : "bom"}
        neutro={!t}
        selo={
          t && t.porNivel.critico > 0
            ? plural(t.porNivel.critico, "crítica", "críticas")
            : t && t.porNivel.atencao > 0
              ? `${formatarInteiro(t.porNivel.atencao)} em atenção`
              : undefined
        }
        detalhe={t ? resumoDosNiveis(t.porNivel) : "Carregando…"}
      />
      <KpiCard
        rotulo="CT-e no mês"
        icone={FileText}
        valor={t ? formatarInteiro(t.ctesNoMes) : "—"}
        status="bom"
        neutro
        detalhe={t ? `${formatarInteiro(t.entreguesNoMes)} entregues` : "Carregando…"}
      />
      <KpiCard
        rotulo="SLA Operacional"
        icone={Gauge}
        dica="Todas as empresas juntas, pela mesma conta da Performance: CT-e emitidos no mês menos os entregues fora do prazo (sem os de responsabilidade do cliente), sobre os emitidos."
        valor={t?.slaOperacional != null ? pct(t.slaOperacional) : "—"}
        status="bom"
        neutro
        progresso={t?.slaOperacional ?? undefined}
        detalhe={t?.slaOperacional != null ? "todas as empresas no mês" : "Sem CT-e no mês"}
      />
      <KpiCard
        rotulo="Em atraso"
        icone={AlarmClock}
        valor={t ? formatarInteiro(t.emAtraso) : "—"}
        status="alerta"
        neutro={!t || t.emAtraso === 0}
        detalhe="CT-e do mês em aberto com prazo vencido"
      />
      <KpiCard
        rotulo="Usuários ativos"
        icone={Users}
        valor={t ? formatarInteiro(t.usuariosAtivos) : "—"}
        status="bom"
        neutro
        detalhe="vínculos ativos nas empresas"
      />
    </div>
  );
}

interface PontoDeCtes {
  id: string;
  rotulo: string;
  entregues: number;
  emAberto: number;
  semEntrega: number;
}

/** Empresas com CT-e no mês, da que mais emite para a que menos (a mesma ordem nos dois blocos). */
function comNumeros(empresas: readonly EmpresaNoPainel[]) {
  return empresas
    .flatMap((e) => (e.numeros && e.numeros.ctesNoMes > 0 ? [{ e, n: e.numeros }] : []))
    .sort((a, b) => b.n.ctesNoMes - a.n.ctesNoMes);
}

function pontosDeCtes(empresas: readonly EmpresaNoPainel[]): PontoDeCtes[] {
  return comNumeros(empresas).map(({ e, n }) => ({
    id: e.id,
    rotulo: e.nomeCurto,
    entregues: n.entreguesNoMes,
    emAberto: n.emAberto,
    semEntrega: Math.max(0, n.ctesNoMes - n.entreguesNoMes - n.emAberto),
  }));
}

const ROTULO_DO_SLA: Record<StatusKpi, string> = {
  bom: "na meta",
  alerta: "abaixo da meta",
  ruim: "crítico",
};

const COR_DO_SLA: Record<StatusKpi, string> = {
  bom: "bg-status-good",
  alerta: "bg-status-warn",
  ruim: "bg-status-bad",
};

/**
 * SLA de cada empresa contra a meta dela: barra de 0 a 100% na cor da situação, traço na meta e
 * o valor com ícone ao lado (nunca só a cor). Feito em HTML para marcar a meta de cada uma; cada
 * linha é um botão (teclado e dica) que abre a empresa.
 */
function SlaPorEmpresa({
  empresas,
  aoAbrir,
}: {
  empresas: readonly EmpresaNoPainel[];
  aoAbrir: (id: string) => void;
}) {
  const linhas = comNumeros(empresas).flatMap(({ e, n }) =>
    n.slaOperacional !== null && n.situacaoDoSla !== null
      ? [{ e, sla: n.slaOperacional, meta: n.slaMeta, situacao: n.situacaoDoSla }]
      : [],
  );
  if (linhas.length === 0) {
    return (
      <EstadoVazio
        mensagem="Nenhuma empresa com SLA no mês."
        detalhe="O SLA aparece quando a empresa tem CT-e emitidos no mês."
        className="min-h-[220px]"
      />
    );
  }
  return (
    <TooltipProvider delayDuration={100}>
      <ul className="space-y-1 px-3 py-4" aria-label="SLA Operacional do mês por empresa">
        {linhas.map(({ e, sla, meta, situacao }) => {
          const texto = `${e.nome}: SLA ${pct(sla)}, meta ${pct(meta)} (${ROTULO_DO_SLA[situacao]})`;
          return (
            <li key={e.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={texto}
                    onClick={() => {
                      aoAbrir(e.id);
                    }}
                    className="flex min-h-9 w-full items-center gap-3 rounded-md px-2 text-left text-[13px] transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="w-24 shrink-0 truncate text-muted-foreground sm:w-28">
                      {e.nomeCurto}
                    </span>
                    <span className="relative h-2.5 min-w-0 flex-1 rounded-full bg-muted">
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-full",
                          COR_DO_SLA[situacao],
                        )}
                        style={{ width: `${String(Math.max(1, sla * 100))}%` }}
                      />
                      <span
                        aria-hidden
                        className="absolute -inset-y-1 w-0.5 rounded-full bg-foreground"
                        style={{ left: `${String(meta * 100)}%` }}
                      />
                    </span>
                    <SeloStatus tom={TOM_DO_SLA[situacao]} className="w-[84px] justify-center">
                      {pct(sla)}
                    </SeloStatus>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[12px]">
                  {texto}
                  <span className="block opacity-75">Clique para abrir a empresa</span>
                </TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </TooltipProvider>
  );
}

export function PaginaPainel() {
  const navigate = useNavigate();
  const consulta = useQuery(consultaPainelDaPlataforma);
  const painel = consulta.data;
  const abrir = (id: string) => void navigate({ to: "/plataforma/empresas/$id", params: { id } });
  const pontos = pontosDeCtes(painel?.empresas ?? []);
  const vazio = painel !== undefined && painel.empresas.length === 0;

  return (
    <Pagina
      titulo="Dashboard"
      descricao="Saúde, uso e números do mês de todas as empresas."
      meta={
        painel && (
          <p className="text-[12.5px] text-muted-foreground">
            Mês de {formatarData(painel.periodo.inicio)} a {formatarData(painel.periodo.fim)} ·
            montado em {formatarDataHora(painel.geradoEm)}
          </p>
        )
      }
      acoes={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void consulta.refetch()}
          disabled={consulta.isFetching}
        >
          <RefreshCw
            aria-hidden
            className={consulta.isFetching ? "motion-safe:animate-spin" : ""}
          />
          Atualizar
        </Button>
      }
    >
      {consulta.isError ? (
        <MensagemErro
          erro={consulta.error}
          titulo="Não foi possível montar o Dashboard"
          aoTentarDeNovo={() => void consulta.refetch()}
        />
      ) : vazio ? (
        <EstadoVazio
          icone={Building2}
          mensagem="Nenhuma empresa cadastrada."
          detalhe="Cadastre a primeira em Plataforma › Empresas."
        />
      ) : (
        <>
          <Kpis painel={painel} />

          <Painel
            titulo="Saúde por empresa"
            descricao="Integração com o SSW, dados, acesso e números do mês. Clique numa empresa para abrir o cadastro."
            icone={HeartPulse}
          >
            <TabelaDados
              embutida
              colunas={colunas(painel?.geradoEm ?? new Date(0).toISOString())}
              linhas={painel?.empresas ?? []}
              chaveDaLinha={(e) => e.id}
              aoClicarLinha={(e) => {
                abrir(e.id);
              }}
              carregando={consulta.isLoading}
              porPagina={0}
              configurarColunas
              rotuloTotal={(n) => `${formatarInteiro(n)} empresa${n === 1 ? "" : "s"}`}
            />
          </Painel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Painel
              titulo="CT-e emitidos no mês"
              descricao="Por situação hoje. Clique numa barra para abrir a empresa."
              icone={ChartColumnStacked}
            >
              <GraficoBarras
                descricao="CT-e emitidos no mês por empresa, divididos em entregues, em aberto e baixados sem entrega"
                dados={pontos}
                eixoX="rotulo"
                formato="inteiro"
                carregando={consulta.isLoading}
                mensagemVazia="Nenhuma empresa com números no mês."
                aoClicarBarra={(p) => {
                  abrir(p.id);
                }}
                series={[
                  { chave: "entregues", nome: "Entregues", pilha: "a" },
                  { chave: "emAberto", nome: "Em aberto", cor: "var(--serie-2)", pilha: "a" },
                  {
                    chave: "semEntrega",
                    nome: "Baixados sem entrega",
                    cor: "var(--grafico-comparacao)",
                    pilha: "a",
                  },
                ]}
              />
            </Painel>
            <Painel
              titulo="SLA Operacional do mês"
              descricao="Mesma conta da Performance; o traço marca a meta de cada empresa."
              icone={Gauge}
            >
              <SlaPorEmpresa empresas={painel?.empresas ?? []} aoAbrir={abrir} />
            </Painel>
          </div>
        </>
      )}
    </Pagina>
  );
}
