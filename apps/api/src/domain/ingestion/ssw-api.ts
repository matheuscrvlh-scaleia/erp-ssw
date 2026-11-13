/**
 * Validade do token de sessão da SSW API (`generateToken`) e a faixa "Integração SSW indisponível"
 * do layout. Quem gera e renova o token é o worker-ssw (ADR 0012). Especificação:
 * docs/regras/06-ingestao.md §3.18.
 */

/** Endereço da SSW API quando a integração não informa outro. */
export const URL_PADRAO_DA_SSW_API = "https://ssw.inf.br/api";

/**
 * Base da SSW API a partir do endereço digitado na integração (`url`): vazio = o padrão; sem
 * protocolo vira https; só o servidor ganha `/api`; a barra final sai. Nulo = endereço inválido.
 * Ex.: "tms.ssw.inf.br" → "https://tms.ssw.inf.br/api".
 */
export function baseDaSswApi(digitado: string): string | null {
  const texto = digitado.trim();
  if (!texto) return URL_PADRAO_DA_SSW_API;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(texto) && !/^https?:\/\//i.test(texto)) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`);
  } catch {
    return null;
  }
  if (url.search || url.hash || url.username || url.password || !url.hostname.includes(".")) {
    return null;
  }
  const caminho = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${caminho || "/api"}`;
}

/** O SSW não informa a validade: hoje vale 4 h a partir da geração. */
export const TTL_DO_TOKEN_MS = 4 * 60 * 60_000;

export type MotivoDaSaude = "ok" | "sem_credenciais" | "sem_token" | "token_expirado";

export interface SaudeDaIntegracaoSsw {
  configurado: boolean;
  tokenValido: boolean;
  tokenAtualizadoEm: Date | null;
  saudavel: boolean;
  motivo: MotivoDaSaude;
}

/**
 * Integração desligada (ou sem empresa) é "saudável": a faixa só acende para quem usa a SSW API.
 * origem: getSswHealth (src/features/ssw/ingestao.functions.ts)
 */
export function saudeDaIntegracaoSsw(entrada: {
  ativa: boolean;
  configurado: boolean;
  tokenGeradoEm: Date | null;
  agora: Date;
}): SaudeDaIntegracaoSsw {
  if (!entrada.ativa) {
    return {
      configurado: false,
      tokenValido: false,
      tokenAtualizadoEm: null,
      saudavel: true,
      motivo: "ok",
    };
  }
  const tokenValido =
    entrada.tokenGeradoEm !== null &&
    entrada.agora.getTime() - entrada.tokenGeradoEm.getTime() < TTL_DO_TOKEN_MS;
  let motivo: MotivoDaSaude = "ok";
  if (!entrada.configurado) motivo = "sem_credenciais";
  else if (entrada.tokenGeradoEm === null) motivo = "sem_token";
  else if (!tokenValido) motivo = "token_expirado";
  return {
    configurado: entrada.configurado,
    tokenValido,
    tokenAtualizadoEm: entrada.tokenGeradoEm,
    saudavel: entrada.configurado && tokenValido,
    motivo,
  };
}
