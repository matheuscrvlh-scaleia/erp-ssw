import { tempoDecorrido, variacaoDoMes } from "@erp/dominio/painel-plataforma";
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
import { INFO_DA_INTEGRACAO, ROTULO_DO_STATUS, type StatusEmpresa } from "@erp/shared/plataforma";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  ChartColumnBig,
  FileText,
  HeartPulse,
  Plug,
  RefreshCw,
  TrendingUp,
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

import { consultaPainelDaPlataforma } from "./api";

const SAUDE: Record<NivelDeSaude, { tom: Tom; texto: string; ordem: number }> = {
  critico: { tom: "erro", texto: "Crítico", ordem: 0 },
  atencao: { tom: "alerta", texto: "Atenção", ordem: 1 },
  ok: { tom: "sucesso", texto: "Saudável", ordem: 2 },
  inativa: { tom: "neutro", texto: "Inativa", ordem: 3 },
};

const PROBLEMA_DA_SSW: Record<Exclude<MotivoDaSaude, "ok">, string> = {
  sem_credenciais: "Sem credenciais",
  sem_token: "Sem token",
  token_expirado: "Token expirado",
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-11" → "nov/26". */
export function rotuloDoMes(mes: string): string {
  return `${MESES[Number(mes.slice(5, 7)) - 1] ?? mes}/${mes.slice(2, 4)}`;
}

const plural = (n: number, um: string, varios: string) =>
  `${formatarInteiro(n)} ${n === 1 ? um : varios}`;

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
    .map(([qtd, um, varios]) => plural(qtd, um, varios))
    .join(" · ");
}

const STATUS_NO_RESUMO: [StatusEmpresa, string, string][] = [
  ["ativa", "ativa", "ativas"],
  ["implantacao", "em implantação", "em implantação"],
  ["suspensa", "suspensa", "suspensas"],
  ["encerrada", "encerrada", "encerradas"],
];

/** "3 ativas · 1 em implantação" (só as situações que têm empresa). */
export function resumoDosStatus(n: PainelPlataforma["totais"]["porStatus"]): string {
  return STATUS_NO_RESUMO.filter(([s]) => n[s] > 0)
    .map(([s, um, varios]) => plural(n[s], um, varios))
    .join(" · ");
}

/** Empresas em operação (as inativas não contam para integração). */
const emOperacao = (e: EmpresaNoPainel) => e.status === "ativa" || e.status === "implantacao";

function SeloComDica({ selo }: { selo: { tom: Tom; texto: string; dica?: string } }) {
  return (
    <span title={selo.dica}>
      <SeloStatus tom={selo.tom}>{selo.texto}</SeloStatus>
    </span>
  );
}

function Quando({ iso, referencia }: { iso: string | null; referencia: string }) {
  return (
    <span className="whitespace-nowrap" title={iso ? formatarDataHora(iso) : undefined}>
      {haQuantoTempo(iso, referencia)}
    </span>
  );
}

/** "+12%" verde, "−8%" vermelho; sem base, "—". */
function Variacao({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-muted-foreground">—</span>;
  const sinal = valor > 0 ? "+" : valor < 0 ? "−" : "";
  const cor = valor > 0 ? "text-status-good-fg" : valor < 0 ? "text-status-bad-fg" : "";
  return (
    <span className={`tabular-nums ${cor}`}>
      {sinal}
      {formatarPercentual(Math.abs(valor), { separador: "." })}
    </span>
  );
}

/** Mini gráfico dos CT-e dos 12 meses (o último ponto é o mês corrente, pela metade). */
function Tendencia({ valores, meses }: { valores: readonly number[]; meses: readonly string[] }) {
  const max = Math.max(1, ...valores);
  const largura = 96;
  const altura = 24;
  const passo = largura / Math.max(1, valores.length - 1);
  const pontos = valores
    .map(
      (v, i) => `${(i * passo).toFixed(1)},${(altura - 2 - (v / max) * (altura - 4)).toFixed(1)}`,
    )
    .join(" ");
  const dica = valores
    .map((v, i) => `${rotuloDoMes(meses[i] ?? "")}: ${formatarInteiro(v)}`)
    .join("\n");
  return (
    <svg
      width={largura}
      height={altura}
      viewBox={`0 0 ${String(largura)} ${String(altura)}`}
      className="text-primary"
      role="img"
      aria-label={`CT-e por mês. ${dica}`}
    >
      <title>{dica}</title>
      <polyline
        points={pontos}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function colunas(painel: PainelPlataforma): ColunaTabela<EmpresaNoPainel>[] {
  const { geradoEm, meses } = painel;
  const ctesNoMes = (e: EmpresaNoPainel) => e.ctesPorMes?.at(-1) ?? null;
  const variacao = (e: EmpresaNoPainel) => (e.ctesPorMes ? variacaoDoMes(e.ctesPorMes) : null);
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
    { chave: "criadaEm", titulo: "Na Plataforma desde", formato: "data" },
    {
      chave: "usuariosAtivos",
      titulo: "Usuários",
      valor: (e) => e.usuariosAtivos,
      celula: (e) => (
        <div className="whitespace-nowrap tabular-nums">
          {formatarInteiro(e.usuariosAtivos)}
          <div className="text-xs text-muted-foreground">
            {formatarInteiro(e.usuariosNoMes)} em 30 dias
          </div>
        </div>
      ),
    },
    {
      chave: "ultimoLoginEm",
      titulo: "Último acesso",
      celula: (e) => <Quando iso={e.ultimoLoginEm} referencia={geradoEm} />,
    },
    {
      chave: "integracoes",
      titulo: "Integrações",
      valor: (e) => e.integracoes.length,
      celula: (e) =>
        e.integracoes.length === 0 ? (
          <span className="text-muted-foreground">Nenhuma</span>
        ) : (
          <span
            className="whitespace-nowrap"
            title={e.integracoes.map((t) => INFO_DA_INTEGRACAO[t].nome).join("\n")}
          >
            {plural(e.integracoes.length, "ligada", "ligadas")}
          </span>
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
    { chave: "ctesNoMes", titulo: "CT-e no mês", formato: "inteiro", valor: ctesNoMes },
    {
      chave: "crescimento",
      titulo: "Crescimento (mês fechado)",
      valor: variacao,
      celula: (e) => <Variacao valor={variacao(e)} />,
    },
    {
      chave: "tendencia",
      titulo: "12 meses",
      ordenavel: false,
      semExportar: true,
      celula: (e) =>
        e.ctesPorMes ? (
          <Tendencia valores={e.ctesPorMes} meses={meses} />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { chave: "modulosLiberados", titulo: "Módulos", formato: "inteiro", oculta: true },
  ];
}

function Kpis({ painel }: { painel: PainelPlataforma | undefined }) {
  const t = painel?.totais;
  const operando = painel?.empresas.filter(emOperacao) ?? [];
  const sswOk = operando.filter((e) => seloDaSsw(e).tom === "sucesso").length;
  const sswComProblema = operando.filter((e) => seloDaSsw(e).tom === "erro").length;
  const ctes = t?.ctesPorMes ?? [];
  const statusDasEmpresas: StatusKpi =
    t && t.porNivel.critico > 0 ? "ruim" : t && t.porNivel.atencao > 0 ? "alerta" : "bom";
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <KpiCard
        rotulo="Empresas"
        icone={Building2}
        valor={t ? formatarInteiro(t.empresas) : "—"}
        status={statusDasEmpresas}
        neutro={!t || statusDasEmpresas === "bom"}
        selo={
          t && t.porNivel.critico > 0
            ? plural(t.porNivel.critico, "crítica", "críticas")
            : t && t.porNivel.atencao > 0
              ? `${formatarInteiro(t.porNivel.atencao)} em atenção`
              : undefined
        }
        detalhe={t ? resumoDosStatus(t.porStatus) : "Carregando…"}
      />
      <KpiCard
        rotulo="Novas em 12 meses"
        icone={TrendingUp}
        valor={t ? formatarInteiro(t.novasNoAno) : "—"}
        status="bom"
        neutro
        detalhe={t ? `${plural(t.novasNoMes, "nova", "novas")} neste mês` : "Carregando…"}
      />
      <KpiCard
        rotulo="Integração SSW"
        icone={Plug}
        dica="Empresas ativas ou em implantação com a SSW API funcionando (token válido)."
        valor={painel ? `${formatarInteiro(sswOk)} de ${formatarInteiro(operando.length)}` : "—"}
        status="alerta"
        neutro={!painel || sswComProblema === 0}
        selo={
          sswComProblema > 0 ? plural(sswComProblema, "com problema", "com problema") : undefined
        }
        detalhe="empresas com a SSW API funcionando"
      />
      <KpiCard
        rotulo="Usuários"
        icone={Users}
        valor={t ? formatarInteiro(t.usuariosAtivos) : "—"}
        status="bom"
        neutro
        detalhe={
          t ? `${formatarInteiro(t.usuariosNoMes)} entraram nos últimos 30 dias` : "Carregando…"
        }
      />
      <KpiCard
        rotulo="CT-e no mês"
        icone={FileText}
        dica="CT-e emitidos no mês corrente, todas as empresas (mesmo universo das telas)."
        valor={t ? formatarInteiro(ctes.at(-1) ?? 0) : "—"}
        status="bom"
        neutro
        detalhe={t ? `${formatarInteiro(ctes.at(-2) ?? 0)} no mês passado` : "Carregando…"}
      />
    </div>
  );
}

/** Quantas empresas em operação têm cada integração ligada (barra = parte das empresas). */
function Integracoes({ painel }: { painel: PainelPlataforma }) {
  const base = painel.empresas.filter(emOperacao).length;
  return (
    <ul className="space-y-3 px-5 py-4" aria-label="Integrações ligadas por empresa">
      {painel.integracoes.map((i) => {
        const fracao = base > 0 ? i.empresas / base : 0;
        return (
          <li key={i.tipo} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate">{INFO_DA_INTEGRACAO[i.tipo].nome}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {formatarInteiro(i.empresas)} de {formatarInteiro(base)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${String(Math.min(100, fracao * 100))}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function PaginaPainel() {
  const navigate = useNavigate();
  const consulta = useQuery(consultaPainelDaPlataforma);
  const painel = consulta.data;
  const abrir = (id: string) => void navigate({ to: "/plataforma/empresas/$id", params: { id } });
  const vazio = painel !== undefined && painel.empresas.length === 0;
  const crescimento = (painel?.crescimento ?? []).map((m) => ({
    rotulo: rotuloDoMes(m.mes),
    existentes: m.total - m.novas,
    novas: m.novas,
  }));
  const ctesPorMes = (painel?.meses ?? []).map((mes, i) => ({
    rotulo: rotuloDoMes(mes),
    ctes: painel?.totais.ctesPorMes[i] ?? 0,
  }));

  return (
    <Pagina
      titulo="Dashboard"
      descricao="Empresas, crescimento, integrações e uso da Plataforma."
      meta={
        painel && (
          <p className="text-[12.5px] text-muted-foreground">
            Montado em {formatarDataHora(painel.geradoEm)}
            {painel.meses[0] && ` · 12 meses desde ${formatarData(`${painel.meses[0]}-01`)}`}
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

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Painel
              titulo="Crescimento da Plataforma"
              descricao="Empresas cadastradas até o fim de cada mês; em destaque, as que entraram no mês."
              icone={TrendingUp}
            >
              <GraficoBarras
                descricao="Empresas na Plataforma por mês, separando as que entraram no mês"
                dados={crescimento}
                eixoX="rotulo"
                formato="inteiro"
                carregando={consulta.isLoading}
                mensagemVazia="Nenhuma empresa nos últimos 12 meses."
                series={[
                  {
                    chave: "existentes",
                    nome: "Já na Plataforma",
                    cor: "var(--grafico-comparacao)",
                    pilha: "a",
                  },
                  { chave: "novas", nome: "Novas no mês", pilha: "a" },
                ]}
              />
            </Painel>
            <Painel
              titulo="CT-e processados por mês"
              descricao="Todas as empresas, pela data de emissão. O último mês está em andamento."
              icone={ChartColumnBig}
            >
              <GraficoBarras
                descricao="CT-e emitidos por mês, somando todas as empresas"
                dados={ctesPorMes}
                eixoX="rotulo"
                formato="inteiro"
                carregando={consulta.isLoading}
                mensagemVazia="Nenhum CT-e nos últimos 12 meses."
                series={[{ chave: "ctes", nome: "CT-e" }]}
              />
            </Painel>
            <Painel
              titulo="Integrações"
              descricao="Empresas ativas ou em implantação com cada integração ligada."
              icone={Plug}
            >
              {painel ? (
                <Integracoes painel={painel} />
              ) : (
                <EstadoVazio mensagem="Carregando…" className="min-h-[220px]" />
              )}
            </Painel>
          </div>

          <Painel
            titulo="Empresas"
            descricao="Saúde, integração com o SSW, uso e CT-e de cada empresa. Clique numa empresa para abrir o cadastro."
            icone={HeartPulse}
          >
            <TabelaDados
              embutida
              colunas={painel ? colunas(painel) : []}
              linhas={painel?.empresas ?? []}
              chaveDaLinha={(e) => e.id}
              aoClicarLinha={(e) => {
                abrir(e.id);
              }}
              carregando={consulta.isLoading}
              porPagina={0}
              configurarColunas
              rotuloTotal={(n) => plural(n, "empresa", "empresas")}
            />
          </Painel>
        </>
      )}
    </Pagina>
  );
}
