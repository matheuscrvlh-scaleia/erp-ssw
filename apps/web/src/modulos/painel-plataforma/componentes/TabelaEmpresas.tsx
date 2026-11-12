import {
  type EmpresaNoPainel,
  type PainelPlataforma,
} from "@erp/shared/contratos/painel-plataforma";
import { formatarDataHora, formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";
import { INFO_DA_INTEGRACAO, ROTULO_DO_STATUS } from "@erp/shared/plataforma";

import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";

import { ctesNoMes, variacao } from "../regras";
import {
  haQuantoTempo,
  plural,
  rotuloDoMes,
  SAUDE,
  type Selo,
  seloDaSsw,
  seloDoWorker,
} from "../textos";

function SeloComDica({ selo }: { selo: Selo }) {
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

/** Saúde, integração, uso e CT-e de cada empresa; clicar abre o cadastro. */
export function TabelaEmpresas({
  painel,
  carregando,
  aoAbrir,
}: {
  painel: PainelPlataforma | undefined;
  carregando: boolean;
  aoAbrir: (id: string) => void;
}) {
  return (
    <TabelaDados
      embutida
      colunas={painel ? colunas(painel) : []}
      linhas={painel?.empresas ?? []}
      chaveDaLinha={(e) => e.id}
      aoClicarLinha={(e) => {
        aoAbrir(e.id);
      }}
      carregando={carregando}
      porPagina={0}
      configurarColunas
      rotuloTotal={(n) => plural(n, "empresa", "empresas")}
    />
  );
}
