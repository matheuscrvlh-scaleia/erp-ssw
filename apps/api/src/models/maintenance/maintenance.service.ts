export interface RepositorioManutencao {
  /** Apaga sessões que venceram ou foram revogadas antes de `limite`; devolve quantas. */
  apagarSessoesEncerradas(limite: Date): Promise<number>;
  /** Apaga links de senha/convite vencidos antes de `limite`; devolve quantos. */
  apagarTokensDeSenhaVencidos(limite: Date): Promise<number>;
}

type ExecutorDaManutencao = <T>(
  fn: (repositorios: { manutencao: RepositorioManutencao }) => Promise<T>,
) => Promise<T>;

/** Guarda uma semana depois do fim, para dar para investigar um reuso de refresh. */
const RETENCAO_MS = 7 * 24 * 60 * 60_000;

/** Apaga sessões e links de senha que já não valem (encerrados há mais da retenção). */
export function limparSessoesEncerradas(
  db: ExecutorDaManutencao,
  agora: Date,
): Promise<{ sessoes: number; tokens: number }> {
  const limite = new Date(agora.getTime() - RETENCAO_MS);
  return db(async ({ manutencao }) => ({
    sessoes: await manutencao.apagarSessoesEncerradas(limite),
    tokens: await manutencao.apagarTokensDeSenhaVencidos(limite),
  }));
}
