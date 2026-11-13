import { tempoDecorrido } from "@erp/domain/platform-dashboard";
import {
  type EmpresaNoPainel,
  type NivelDeSaude,
  type PainelPlataforma,
} from "@erp/shared/contracts/platform-dashboard";
import { type MotivoDaSaude } from "@erp/shared/contracts/ssw-ingestion";
import { formatarInteiro } from "@erp/shared/formatting";
import { type StatusEmpresa } from "@erp/shared/platform";

import { type Tom } from "@/components/common/StatusBadge";

export const SAUDE: Record<NivelDeSaude, { tom: Tom; texto: string; ordem: number }> = {
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

/** Selo de uma coluna da tabela; a dica aparece ao passar o mouse. */
export interface Selo {
  tom: Tom;
  texto: string;
  dica?: string;
}

/** "2026-11" → "nov/26". */
export function rotuloDoMes(mes: string): string {
  return `${MESES[Number(mes.slice(5, 7)) - 1] ?? mes}/${mes.slice(2, 4)}`;
}

export const plural = (n: number, um: string, varios: string) =>
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

export function seloDoWorker(e: EmpresaNoPainel): Selo {
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
