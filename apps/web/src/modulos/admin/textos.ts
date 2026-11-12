import {
  type CategoriaDeTela,
  CATEGORIAS_DE_TELA,
  telasComVer,
} from "@erp/shared/acesso/permissoes";
import { type SaidaDe } from "@erp/shared/contrato";
import {
  type Cargo,
  type contratosAdmin,
  type GrupoDeConfiguracao,
  type TipoDePrazo,
} from "@erp/shared/contratos/admin";

import { type Tom } from "@/componentes/comum/SeloStatus";

/** "8 de 18 telas" das categorias do editor (cargo com tudo: "Todas"). */
export function resumoDoCargo(
  cargo: Pick<Cargo, "temTudo" | "permissoes">,
  categorias: readonly CategoriaDeTela[] = CATEGORIAS_DE_TELA,
): string {
  if (cargo.temTudo) return "Todas";
  const doEditor = categorias.flatMap((c) => c.telas);
  const telas = telasComVer(cargo.permissoes).filter((t) => doEditor.includes(t));
  return `${String(telas.length)} de ${String(doEditor.length)} telas`;
}

export const AVISO_TEM_TUDO_DA_EMPRESA =
  "Admin e Super Admin têm todas as permissões e não podem ser restringidos. Para tirar algo de uma pessoa, marque “Não” nas permissões dela.";

/** Tom do selo da situação de uma execução de integração (o texto vem livre de cada origem). */
export function tomDaSituacao(status: string | null): Tom {
  const s = (status ?? "").toLowerCase();
  if (/(erro|falh|error|fail)/.test(s)) return "erro";
  if (/(ok|sucesso|conclu|success|importado|aplicado|done)/.test(s)) return "sucesso";
  return "neutro";
}

export const ROTULO_DO_GRUPO: Record<GrupoDeConfiguracao, string> = {
  performance: "Performance",
  operacional: "Operacional",
  ranking: "Ranking",
  notificacoes: "Notificações",
};

export const DESCRICAO_DO_GRUPO: Record<GrupoDeConfiguracao, string> = {
  performance: "Metas de SLA e taxa de devolução usadas nas telas de performance e dashboard.",
  operacional: "Thresholds do dia a dia (romaneio, alertas de CT-e parado).",
  ranking: "Faixas usadas para colorir e categorizar equipes no ranking.",
  notificacoes: "Programação de envios automáticos (WhatsApp).",
};

export const ROTULO_DA_CHAVE: Record<string, string> = {
  sla_meta_pct: "Meta de SLA geral (%)",
  sla_alerta_amarelo_pct: "SLA para alerta amarelo (%)",
  sla_alerta_vermelho_pct: "SLA para alerta vermelho (%)",
  taxa_retorno_meta_pct: "Taxa máxima de devolução (%)",
  romaneio_peso_critico_kg: 'Peso mínimo para "Carga Pesada" (kg)',
  romaneio_volume_critico: 'Volumes mínimos para "Alto Volume"',
  alerta_dias_sem_movimento: "Dias sem movimento para alerta crítico",
  atrasos_excluir_responsabilidades: "Responsabilidades excluídas dos alertas de atraso (CSV)",
  ranking_threshold_positivo_pct: "Ranking · destaque positivo (%)",
  ranking_threshold_atencao_pct: "Ranking · atenção (%)",
  ranking_threshold_critico_pct: "Ranking · crítico (%)",
  whatsapp_horario_envio: "Horário de envio do WhatsApp",
  alerta_queda_sla_pp: "Alerta · queda de SLA (p.p.)",
  alerta_janela_tendencia_dias: "Alerta · janela de tendência (dias)",
  alerta_janela_vencimento_h: "Alerta · janela de vencimento (horas)",
  alerta_min_vencimento: "Alerta · volume mínimo vencendo",
  alerta_nascido_atrasado: "Alerta · volume mínimo saiu para entrega com prazo vencido",
  alerta_desvio_finsistema_pp: "Alerta · desvio finalizado em sistema (p.p.)",
  alerta_dias_sem_atualizacao: "Alerta · dias sem atualização",
  parceiros_estrategicos: "Parceiros estratégicos (UUIDs separados por vírgula)",
};

export const DICA_DE_TEXTO: Record<string, string> = {
  whatsapp_horario_envio: "HH:MM",
  atrasos_excluir_responsabilidades: "cliente,destinatario",
  parceiros_estrategicos: "uuid1,uuid2,...",
};

/** O recálculo roda no worker; sem fila (só em desenvolvimento) vale para os CT-e novos. */
export const avisoDoRecalculo = (r: SaidaDe<typeof contratosAdmin.criarPrazo>) =>
  r.recalculoAgendado
    ? "A previsão dos CT-e afetados será recalculada em instantes."
    : "O recálculo dos CT-e existentes não pôde ser agendado; avise o suporte.";

export const TITULO_DO_TIPO: Record<TipoDePrazo, string> = {
  unidade: "Regra por unidade",
  parceiro: "Regra por parceiro",
  transbordo: "Regra de transbordo",
};
