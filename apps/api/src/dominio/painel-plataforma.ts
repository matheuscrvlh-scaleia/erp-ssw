import { type MotivoDaSaude } from "@erp/shared/contratos/ingestao-ssw";
import { type NivelDeSaude, type SituacaoDoWorker } from "@erp/shared/contratos/painel-plataforma";
import { ROTULO_DO_STATUS, type StatusEmpresa } from "@erp/shared/plataforma";

/*
 * Plataforma › Dashboard: quando uma empresa está bem, pede atenção ou está crítica. Puro: o caso
 * de uso junta o que leu do banco e do worker-ssw e a tela só desenha.
 */

const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;

/** O ciclo dos arquivos do SSW roda de 30 em 30 min: 2 h sem aplicar já é atraso (o sino usa o mesmo). */
export const ATRASO_DOS_DADOS_MS = 2 * HORA_MS;
/** Um dia inteiro sem dado novo numa empresa ativa: as telas estão mostrando dado velho. */
export const DADOS_PARADOS_MS = DIA_MS;
/** Uma semana sem ninguém entrar numa empresa ativa: vale uma conversa com o cliente. */
export const SEM_ACESSO_MS = 7 * DIA_MS;

const PROBLEMA_DA_SSW_API: Record<Exclude<MotivoDaSaude, "ok">, string> = {
  sem_credenciais: "SSW API sem credenciais",
  sem_token: "SSW API sem token gerado",
  token_expirado: "SSW API com token expirado",
};

const PROBLEMA_DO_WORKER: Record<Exclude<SituacaoDoWorker, "ok" | "com_falha">, string> = {
  fora: "worker-ssw não respondeu",
  nao_configurado: "worker-ssw não configurado",
};

export interface EntradaDaSaude {
  status: StatusEmpresa;
  motivoDaSswApi: MotivoDaSaude;
  workerSsw: SituacaoDoWorker;
  jobsComFalha: readonly string[];
  ultimoDadoEm: Date | null;
  xmlExpirados: number;
  ultimoLoginEm: Date | null;
  /** A consulta dos números do mês falhou. */
  semNumeros: boolean;
  agora: Date;
}

export interface SaudeDaEmpresa {
  nivel: NivelDeSaude;
  motivos: string[];
}

/** "3 h", "2 dias" (arredonda para baixo; menos de 1 h vira "1 h"). */
export function tempoDecorrido(ms: number): string {
  if (ms < 2 * DIA_MS) return `${String(Math.max(1, Math.floor(ms / HORA_MS)))} h`;
  return `${String(Math.floor(ms / DIA_MS))} dias`;
}

/**
 * Crítico: a SSW API da empresa está quebrada ou os dados pararam (ativa sem dado nenhum ou há mais
 * de um dia). Atenção: dados com mais de 2 h, worker-ssw fora ou com job falhando, XML expirado,
 * ninguém entra há uma semana ou os números do mês não saíram. Em implantação nada é crítico (a
 * integração ainda está sendo montada) e o acesso não conta. Suspensa ou encerrada = inativa.
 */
export function saudeDaEmpresa(e: EntradaDaSaude): SaudeDaEmpresa {
  if (e.status === "suspensa" || e.status === "encerrada") {
    return { nivel: "inativa", motivos: [ROTULO_DO_STATUS[e.status]] };
  }
  const ativa = e.status === "ativa";
  const criticos: string[] = [];
  const atencao: string[] = [];
  const grave = (motivo: string) => (ativa ? criticos : atencao).push(motivo);

  // Sem o worker-ssw o token é desconhecido (não "sem token"): só a falta de credencial conta.
  const tokenDesconhecido = e.workerSsw === "fora" || e.workerSsw === "nao_configurado";
  const motivo = e.motivoDaSswApi;
  if (motivo === "sem_credenciais" || (motivo !== "ok" && !tokenDesconhecido)) {
    grave(PROBLEMA_DA_SSW_API[motivo]);
  }

  if (e.ultimoDadoEm === null) {
    grave("Nenhum dado recebido do SSW");
  } else {
    const parado = e.agora.getTime() - e.ultimoDadoEm.getTime();
    const texto = `Sem dados novos há ${tempoDecorrido(parado)}`;
    if (parado > DADOS_PARADOS_MS) grave(texto);
    else if (parado > ATRASO_DOS_DADOS_MS) atencao.push(texto);
  }

  if (e.workerSsw === "com_falha") atencao.push(`Falha recente: ${e.jobsComFalha.join(", ")}`);
  else if (e.workerSsw !== "ok") atencao.push(PROBLEMA_DO_WORKER[e.workerSsw]);

  if (e.xmlExpirados > 0) {
    atencao.push(`${String(e.xmlExpirados)} XML expirado${e.xmlExpirados > 1 ? "s" : ""}`);
  }

  if (ativa) {
    if (e.ultimoLoginEm === null) atencao.push("Ninguém entrou ainda");
    else {
      const semAcesso = e.agora.getTime() - e.ultimoLoginEm.getTime();
      if (semAcesso > SEM_ACESSO_MS) atencao.push(`Ninguém entra há ${tempoDecorrido(semAcesso)}`);
    }
  }

  if (e.semNumeros) atencao.push("Números do mês indisponíveis");

  const nivel: NivelDeSaude =
    criticos.length > 0 ? "critico" : atencao.length > 0 ? "atencao" : "ok";
  return { nivel, motivos: [...criticos, ...atencao] };
}
