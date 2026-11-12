import { type PainelPlataforma } from "@erp/shared/contratos/painel-plataforma";
import { formatarInteiro } from "@erp/shared/formatacao";
import { Building2, FileText, Plug, TrendingUp, Users } from "lucide-react";

import { KpiCard, type StatusKpi } from "@/componentes/comum/KpiCard";

import { emOperacao } from "../regras";
import { plural, resumoDosStatus, seloDaSsw } from "../textos";

/** Os cinco cartões do topo; sem o painel, "—" e "Carregando…". */
export function KpisDoPainel({ painel }: { painel: PainelPlataforma | undefined }) {
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
