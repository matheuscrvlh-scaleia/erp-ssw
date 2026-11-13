import { type ResumoPessoa } from "@erp/domain/delivery-bonus";
import { formatarDiaMes, formatarMoeda } from "@erp/shared/formatting";
import { ChevronDown, ChevronRight } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

import { EstadoVazio } from "@/components/common/EmptyState";
import { SeloStatus } from "@/components/common/StatusBadge";
import {
  CLASSE_CABECALHO,
  CLASSE_LINHA,
  CLASSE_TABELA,
  CLASSE_TD,
  CLASSE_TH,
} from "@/components/common/table-classes";
import { cn } from "@/lib/utils";

import { NIVEL, pct } from "../texts";

/** Verde = sem hora extra (vale Turbo). Vermelho = fez. Cinza = sem ponto. */
function BolinhaHoraExtra({ valor }: { valor: boolean | null }) {
  const cor =
    valor === null ? "bg-muted-foreground/40" : valor ? "bg-status-bad" : "bg-status-good";
  const titulo =
    valor === null ? "Sem registro de ponto" : valor ? "Fez hora extra" : "Sem hora extra";
  return (
    <span
      role="img"
      className={`inline-block h-2.5 w-2.5 rounded-full ${cor}`}
      title={titulo}
      aria-label={titulo}
    />
  );
}

const TH_DO_DIA = "py-1.5 pr-3 label-xs";

function LinhaPessoa({ p }: { p: ResumoPessoa }) {
  const [aberto, setAberto] = useState(false);
  const alternar = () => {
    setAberto((v) => !v);
  };
  const tecla = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    alternar();
  };
  return (
    <>
      <tr
        tabIndex={0}
        aria-expanded={aberto}
        className={cn(
          CLASSE_LINHA,
          "cursor-pointer focus-visible:bg-accent focus-visible:outline-none",
          aberto && "bg-muted/40",
        )}
        onClick={alternar}
        onKeyDown={tecla}
      >
        <td className={CLASSE_TD}>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            {aberto ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            )}
            <span className="font-semibold">{p.colaborador}</span>
            <SeloStatus tom="neutro" semIcone>
              {p.funcao}
            </SeloStatus>
            {p.zerados > 0 && (
              <SeloStatus tom="erro">
                {p.zerados} zerado{p.zerados > 1 ? "s" : ""} por falta
              </SeloStatus>
            )}
          </div>
        </td>
        <td className={cn(CLASSE_TD, "text-right")}>{p.dias}</td>
        <td className={cn(CLASSE_TD, "text-right")}>{p.entregues}</td>
        <td className={cn(CLASSE_TD, "text-right")}>{p.retornos}</td>
        <td className={cn(CLASSE_TD, "text-right")}>{pct(p.exitoMedio)}</td>
        <td className={cn(CLASSE_TD, "text-right")}>{p.diasTurbo}</td>
        <td className={cn(CLASSE_TD, "text-right")}>{p.diasSemBonus}</td>
        <td className={CLASSE_TD}>
          {/* No resumo a pessoa tem vários dias: a bolinha mostra se houve hora extra em algum
              deles, e o número diz em quantos. */}
          <div className="flex items-center justify-end gap-1.5">
            <BolinhaHoraExtra valor={p.diasHoraExtra > 0} />
            <span className="text-muted-foreground">
              {p.diasHoraExtra}/{p.dias}
            </span>
          </div>
        </td>
        <td className={cn(CLASSE_TD, "text-right")}>
          {p.semPonto > 0 ? (
            <span className="font-semibold text-status-warn-fg">{p.semPonto}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className={cn(CLASSE_TD, "text-right font-semibold")}>{formatarMoeda(p.total)}</td>
      </tr>
      {aberto && (
        <tr className="border-b border-border">
          <td colSpan={10} className="bg-superficie px-4 py-2">
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px] tabular-nums">
                <thead>
                  <tr className="text-left">
                    <th className={TH_DO_DIA}>Dia</th>
                    <th className={TH_DO_DIA}>Romaneio</th>
                    <th className={TH_DO_DIA}>Função</th>
                    <th className={cn(TH_DO_DIA, "text-right")}>NFs</th>
                    <th className={cn(TH_DO_DIA, "text-right")}>SAC</th>
                    <th className={cn(TH_DO_DIA, "text-right")}>Retornos</th>
                    <th className={cn(TH_DO_DIA, "text-right")}>Pend.</th>
                    <th className={cn(TH_DO_DIA, "text-right")}>Êxito</th>
                    <th className={cn(TH_DO_DIA, "text-center")}>HE</th>
                    <th className={TH_DO_DIA}>Nível</th>
                    <th className={cn(TH_DO_DIA, "pr-0 text-right")}>Bônus</th>
                  </tr>
                </thead>
                <tbody>
                  {p.linhas.map((l) => (
                    <tr
                      key={`${l.dataRomaneio}-${l.romaneio}-${l.funcao}`}
                      className="border-t border-border"
                    >
                      <td className="py-1.5 pr-3">{formatarDiaMes(l.dataRomaneio)}</td>
                      <td className="py-1.5 pr-3 font-mono text-muted-foreground">{l.romaneio}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{l.funcao}</td>
                      <td className="py-1.5 pr-3 text-right">{l.nfsCarregadas}</td>
                      <td className="py-1.5 pr-3 text-right">{l.sac}</td>
                      <td className="py-1.5 pr-3 text-right">{l.retornos}</td>
                      <td className="py-1.5 pr-3 text-right">
                        {l.pendentes > 0 ? (
                          <span className="font-semibold text-status-warn-fg">{l.pendentes}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-right">{pct(l.exito)}</td>
                      <td className="py-1.5 pr-3 text-center">
                        <BolinhaHoraExtra valor={l.horaExtra} />
                      </td>
                      <td className="py-1.5 pr-3">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <SeloStatus tom={NIVEL[l.nivel].tom} icone={NIVEL[l.nivel].icone}>
                            {NIVEL[l.nivel].rotulo}
                          </SeloStatus>
                          {l.semRegistroPonto && (
                            <span
                              className="text-xs font-semibold text-status-warn-fg"
                              title="Sem registro de ponto no Ahgora"
                            >
                              sem ponto
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">
                        {l.zeradoPorFalta ? (
                          <span className="text-status-bad-fg line-through">
                            {formatarMoeda(l.bonus)}
                          </span>
                        ) : (
                          formatarMoeda(l.bonus)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Visão "Por colaborador": uma linha por pessoa, que abre os dias dela. */
export function TabelaPorColaborador({
  pessoas,
  total,
}: {
  pessoas: readonly ResumoPessoa[];
  total: number;
}) {
  return (
    <table className={CLASSE_TABELA}>
      <thead>
        <tr className={CLASSE_CABECALHO}>
          <th scope="col" className={CLASSE_TH}>
            Colaborador
          </th>
          {[
            "Dias",
            "NFs entregues",
            "Retornos",
            "Êxito médio",
            "Dias Turbo",
            "Sem bônus",
            "Hora extra",
            "Sem ponto",
            "Bônus",
          ].map((t) => (
            <th key={t} scope="col" className={cn(CLASSE_TH, "text-right")}>
              {t}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {pessoas.map((p) => (
          <LinhaPessoa key={p.colaborador} p={p} />
        ))}
        {pessoas.length === 0 && (
          <tr>
            <td colSpan={10}>
              <EstadoVazio
                mensagem="Nenhum lançamento no recorte."
                detalhe="Troque o mês, a unidade ou tire os filtros de função e hora extra."
              />
            </td>
          </tr>
        )}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-border bg-muted/70 font-semibold">
          <td className={CLASSE_TD}>Total do período</td>
          <td colSpan={8} />
          <td className={cn(CLASSE_TD, "text-right")}>{formatarMoeda(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
