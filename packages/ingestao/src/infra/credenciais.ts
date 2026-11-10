/**
 * Credenciais da integração `sftp` da empresa: parâmetros + senha do cofre (AES-256-GCM). Sem
 * senha no cofre, as variáveis `SFTP_*` só valem com `parametros.usar_env` (transição da FR).
 * Spec 06 §0.1 e §3.1.
 */
import { type Transacao } from "@erp/db";
import { empresaIntegracoes } from "@erp/db/schema";
import { type ChavesDeSegredo, decifrarSegredo } from "@erp/db/segredos";
import { and, eq } from "drizzle-orm";

import { type ConfiguracaoSftp, type CredenciaisDaEmpresa } from "../casos-de-uso/portas";

export interface IntegracaoLida {
  ativo: boolean;
  parametros: Record<string, unknown>;
  segredoCifrado: string | null;
  segredoVersaoChave: number | null;
}

export async function lerIntegracao(
  tx: Transacao,
  empresaId: string,
  tipo: "sftp" | "xml_cte",
): Promise<IntegracaoLida | null> {
  const [i] = await tx
    .select({
      ativo: empresaIntegracoes.ativo,
      parametros: empresaIntegracoes.parametros,
      segredoCifrado: empresaIntegracoes.segredoCifrado,
      segredoVersaoChave: empresaIntegracoes.segredoVersaoChave,
    })
    .from(empresaIntegracoes)
    .where(and(eq(empresaIntegracoes.empresaId, empresaId), eq(empresaIntegracoes.tipo, tipo)));
  return i ?? null;
}

/** Variáveis `SFTP_*` do ambiente (só com `usar_env`). */
export interface SftpDoAmbiente {
  SFTP_HOST?: string | undefined;
  SFTP_PORTA?: string | undefined;
  SFTP_USUARIO?: string | undefined;
  SFTP_SENHA?: string | undefined;
}

const texto = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

export function montarConfiguracaoSftp(
  empresaId: string,
  integracao: IntegracaoLida | null,
  chaves: ChavesDeSegredo | null,
  ambiente: SftpDoAmbiente,
): ConfiguracaoSftp | null {
  if (!integracao?.ativo) return null;
  const p = integracao.parametros;
  const usarEnv = p.usar_env === true || p.usar_env === "true";
  let senha: string | null = null;
  if (integracao.segredoCifrado && integracao.segredoVersaoChave !== null && chaves) {
    senha = decifrarSegredo(
      chaves,
      { cifrado: integracao.segredoCifrado, versaoChave: integracao.segredoVersaoChave },
      `${empresaId}:sftp`,
    );
  } else if (usarEnv) {
    senha = texto(ambiente.SFTP_SENHA);
  }
  const host = texto(p.host) ?? (usarEnv ? texto(ambiente.SFTP_HOST) : null);
  const usuario = texto(p.usuario) ?? (usarEnv ? texto(ambiente.SFTP_USUARIO) : null);
  if (!host || !usuario || !senha) return null;
  const porta = Number(p.porta ?? (usarEnv ? ambiente.SFTP_PORTA : undefined) ?? 22);
  return {
    host,
    porta: Number.isInteger(porta) && porta > 0 ? porta : 22,
    usuario,
    senha,
    relatoriosPath: texto(p.relatorios_path) ?? "/arquivos_import",
    importadosPath: texto(p.importados_path) ?? "/importados",
  };
}

export function criarCredenciais(
  ler: (empresaId: string) => Promise<IntegracaoLida | null>,
  chaves: ChavesDeSegredo | null,
  ambiente: SftpDoAmbiente,
): CredenciaisDaEmpresa {
  return {
    sftp: async (empresaId) =>
      montarConfiguracaoSftp(empresaId, await ler(empresaId), chaves, ambiente),
  };
}
