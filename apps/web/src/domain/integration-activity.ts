import { type SituacaoDaIntegracao } from "@erp/shared/platform";

/*
 * Plataforma › Empresa › Sistemas integrados: se cada integração está funcionando. Puro: o caso de
 * uso junta a última conexão (job do worker-ssw ou teste manual) e o último dado gravado.
 */

/** Conexão ou dado nas últimas 24 h = ativa (o BI2 e o token rodam ao menos uma vez por dia). */
const JANELA_ATIVA_MS = 24 * 3_600_000;

export interface Conexao {
  em: Date;
  ok: boolean;
  mensagem: string | null;
}

/** A mais recente das conexões conhecidas (ex.: a do job e a do teste manual). */
export function conexaoMaisRecente(...conexoes: readonly (Conexao | null)[]): Conexao | null {
  return conexoes.reduce<Conexao | null>(
    (maior, c) => (c !== null && (maior === null || c.em > maior.em) ? c : maior),
    null,
  );
}

/**
 * Desligada: o interruptor está desligado. Com falha: a última conexão falhou e nenhum dado chegou
 * depois dela. Ativa: conexão ok ou dado novo nas últimas 24 h. Sem sinal: o resto.
 */
export function situacaoDaIntegracao(entrada: {
  ativo: boolean;
  ultimaConexao: Conexao | null;
  ultimoDadoEm: Date | null;
  agora: Date;
}): SituacaoDaIntegracao {
  const { ativo, ultimaConexao, ultimoDadoEm, agora } = entrada;
  if (!ativo) return "desligada";
  const dadoEm = ultimoDadoEm?.getTime() ?? 0;
  if (ultimaConexao && !ultimaConexao.ok && ultimaConexao.em.getTime() >= dadoEm) {
    return "com_falha";
  }
  const sinal = Math.max(dadoEm, ultimaConexao?.ok ? ultimaConexao.em.getTime() : 0);
  return sinal > 0 && agora.getTime() - sinal <= JANELA_ATIVA_MS ? "ativa" : "sem_sinal";
}
