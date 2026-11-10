import { z } from "@erp/shared/zod";

import { definirJob } from "../registro";

export interface RepositorioManutencao {
  /** Apaga sessões que venceram ou foram revogadas antes de `limite`; devolve quantas. */
  apagarSessoesEncerradas(limite: Date): Promise<number>;
  /** Apaga links de senha/convite vencidos antes de `limite`; devolve quantos. */
  apagarTokensDeSenhaVencidos(limite: Date): Promise<number>;
  /** Retenção da ingestão SSW/BI2 da empresa do contexto; devolve quantas linhas por tabela. */
  apagarIngestaoSswAntiga(limites: LimitesDaIngestaoSsw): Promise<Record<string, number>>;
}

export interface LimitesDaIngestaoSsw {
  /** `ssw_webhook_eventos` e `ssw_sincronizacoes`: 90 dias. */
  registrosSsw: Date;
  /** `bi2_sincronizacoes` e `bi2_bruto`: 400 dias (cobre o reprocesso do ano). */
  bi2: Date;
}

/** Guarda uma semana depois do fim, para dar para investigar um reuso de refresh. */
const RETENCAO_MS = 7 * 24 * 60 * 60_000;

/**
 * Job de exemplo (e útil): limpa sessões e links de senha que já não valem. Escopo Plataforma,
 * todo dia às 3h.
 */
export const limparSessoes = definirJob({
  nome: "limpar-sessoes",
  fila: "manutencao",
  escopo: "plataforma",
  dados: z.object({}),
  agendamento: "0 3 * * *",
  async processar({ executar, agora, log }) {
    const limite = new Date(agora().getTime() - RETENCAO_MS);
    const apagados = await executar(async ({ manutencao }) => ({
      sessoes: await manutencao.apagarSessoesEncerradas(limite),
      tokens: await manutencao.apagarTokensDeSenhaVencidos(limite),
    }));
    log.info(apagados, "sessões e links de senha vencidos apagados");
  },
});

const DIA_MS = 24 * 60 * 60_000;

/**
 * Retenção da ingestão SSW/BI2 (Q49 do dono): eventos do webhook e execuções da SSW API 90 dias;
 * execuções e bruto do BI2 400 dias. Por empresa (o RLS não deixa a Plataforma apagar dado de
 * empresa), todo dia às 03:50.
 */
export const limparIngestaoSsw = definirJob({
  nome: "limpar-ingestao-ssw",
  fila: "manutencao",
  escopo: "empresa",
  dados: z.object({ empresaId: z.uuid() }),
  agendamento: "50 3 * * *",
  async processar({ executar, agora, log }) {
    const hoje = agora().getTime();
    const apagados = await executar(({ manutencao }) =>
      manutencao.apagarIngestaoSswAntiga({
        registrosSsw: new Date(hoje - 90 * DIA_MS),
        bi2: new Date(hoje - 400 * DIA_MS),
      }),
    );
    log.info(apagados, "retenção da ingestão SSW");
    return apagados;
  },
});
