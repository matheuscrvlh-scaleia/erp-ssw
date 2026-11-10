/**
 * Registro de alteração de cadastro na trilha de auditoria: guarda só o que mudou, sem as colunas
 * de controle, e mascara o que parece segredo. Antes era o gatilho `auditar()`; agora o caso de
 * uso chama na mesma transação da mudança.
 * origem: auditar (função SQL, sistema atual)
 */

export type Registro = Record<string, unknown>;
export type AcaoDeCadastro = "criar" | "alterar" | "excluir";

/** Colunas de controle: mudar só elas não gera linha; nunca aparecem no antes/depois. */
const IGNORADAS: ReadonlySet<string> = new Set([
  "updated_at",
  "atualizado_em",
  "created_at",
  "criado_em",
  "token_atualizado_em",
  "ultima_verificacao_em",
  "ultima_verificacao_ok",
  "ultima_verificacao_mensagem",
  "ultima_verificacao_origem",
  "ultimo_teste_em",
  "ultimo_teste_ok",
  "ultimo_teste_msg",
  "updated_by",
  "atualizado_por",
  "empresa_ativa_id",
]);

/** Nome de coluna (ou chave de configuração) com cara de segredo: o valor vira `***`. */
const PARECE_SEGREDO = /(senha|token|secret|segredo|apikey|password)/i;

export const MASCARA = "***";

/** Configurações que só guardam estado de job: mudam o tempo todo e não são decisão de ninguém. */
export function ehConfiguracaoDeEstado(chave: string): boolean {
  return (
    /^(bi2_|enriq_periodo_|backfill_(?!cron_token))/.test(chave) ||
    chave === "ftp_sync_rodando" ||
    chave === "ssw_relatorios_rodando"
  );
}

function iguais(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function semIgnoradas(registro: Registro): Registro {
  return Object.fromEntries(Object.entries(registro).filter(([k]) => !IGNORADAS.has(k)));
}

function mascarar(registro: Registro | null, valorEhSegredo: boolean): Registro | null {
  if (!registro) return null;
  return Object.fromEntries(
    Object.entries(registro).map(([k, v]) => {
      const segredo = PARECE_SEGREDO.test(k) || (k === "valor" && valorEhSegredo);
      return [k, segredo && v !== null && v !== undefined ? MASCARA : v];
    }),
  );
}

export interface MudancaAuditada {
  antes: Registro | null;
  depois: Registro | null;
}

/**
 * Antes/depois para a auditoria; nulo quando não há o que registrar (alteração só de coluna de
 * controle, ou configuração de estado de job). Em `configuracao`, o valor é mascarado quando a
 * chave tem cara de segredo.
 */
export function mudancaParaAuditoria(entrada: {
  acao: AcaoDeCadastro;
  antes: Registro | null;
  depois: Registro | null;
  /** Só para configuração: a chave decide se é estado de job e se o valor é segredo. */
  chaveDeConfiguracao?: string;
}): MudancaAuditada | null {
  const chave = entrada.chaveDeConfiguracao;
  if (chave !== undefined && ehConfiguracaoDeEstado(chave)) return null;
  const valorEhSegredo = chave !== undefined && PARECE_SEGREDO.test(chave);

  if (entrada.acao === "alterar") {
    const antes = entrada.antes ?? {};
    const depois = entrada.depois ?? {};
    const a: Registro = {};
    const d: Registro = {};
    for (const k of Object.keys(depois)) {
      if (IGNORADAS.has(k) || iguais(antes[k], depois[k])) continue;
      a[k] = antes[k] ?? null;
      d[k] = depois[k] ?? null;
    }
    if (Object.keys(d).length === 0) return null;
    return { antes: mascarar(a, valorEhSegredo), depois: mascarar(d, valorEhSegredo) };
  }
  return {
    antes: mascarar(entrada.antes && semIgnoradas(entrada.antes), valorEhSegredo),
    depois: mascarar(entrada.depois && semIgnoradas(entrada.depois), valorEhSegredo),
  };
}
