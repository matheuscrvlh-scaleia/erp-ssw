import { createHash, createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";

import { z } from "@erp/shared/zod";
import { errors, jwtVerify, SignJWT } from "jose";

/** O que o access token carrega. Telas e papéis não vão nele: são lidos do banco a cada uso. */
export interface SessaoDoToken {
  usuarioId: string;
  empresaId: string | null;
  /** Família do refresh token (estável entre rotações): permite checar logout e revogação. */
  familiaId: string;
}

export type ResultadoVerificacao =
  { valido: true; sessao: SessaoDoToken } | { valido: false; motivo: "expirado" | "invalido" };

export interface EmissorDeTokens {
  readonly validadeSegundos: number;
  emitir(sessao: SessaoDoToken): Promise<string>;
  verificar(token: string): Promise<ResultadoVerificacao>;
}

const VALIDADE_SEGUNDOS = 15 * 60;
const ALGORITMO = "EdDSA";

const reivindicacoes = z.object({
  sub: z.uuid(),
  emp: z.uuid().nullable(),
  sid: z.uuid(),
});

interface ConfigTokens {
  chavePrivadaPem: string;
  /** PEM públicos de rotações anteriores, aceitos até os tokens delas expirarem. */
  chavesAnteriores: readonly string[];
  emissor: string;
  audiencia: string;
}

/**
 * `kid` = impressão digital da chave pública (RFC 7638, SHA-256 do JWK): sai da própria chave, sem
 * variável à parte, e muda sozinho na rotação.
 */
function kidDa(publica: KeyObject): string {
  const { crv, kty, x } = publica.export({ format: "jwk" });
  return createHash("sha256").update(JSON.stringify({ crv, kty, x })).digest("base64url");
}

/** JWT EdDSA (Ed25519) de 15 min, com `kid` para trocar a chave sem derrubar ninguém. */
export function criarEmissorDeTokens(config: ConfigTokens): EmissorDeTokens {
  const privada = createPrivateKey(config.chavePrivadaPem);
  const atual = createPublicKey(privada);
  const kid = kidDa(atual);
  const publicas = new Map<string, KeyObject>([[kid, atual]]);
  for (const pem of config.chavesAnteriores) {
    const publica = createPublicKey(pem);
    publicas.set(kidDa(publica), publica);
  }

  return {
    validadeSegundos: VALIDADE_SEGUNDOS,
    emitir: (sessao) =>
      new SignJWT({ emp: sessao.empresaId, sid: sessao.familiaId })
        .setProtectedHeader({ alg: ALGORITMO, kid })
        .setSubject(sessao.usuarioId)
        .setIssuer(config.emissor)
        .setAudience(config.audiencia)
        .setIssuedAt()
        .setExpirationTime(`${VALIDADE_SEGUNDOS}s`)
        .sign(privada),

    verificar: async (token) => {
      try {
        const { payload } = await jwtVerify(
          token,
          (cabecalho) => {
            const chave = cabecalho.kid ? publicas.get(cabecalho.kid) : undefined;
            if (!chave) throw new errors.JWKSNoMatchingKey();
            return chave;
          },
          { algorithms: [ALGORITMO], issuer: config.emissor, audience: config.audiencia },
        );
        const claims = reivindicacoes.parse(payload);
        return {
          valido: true,
          sessao: { usuarioId: claims.sub, empresaId: claims.emp, familiaId: claims.sid },
        };
      } catch (erro) {
        return {
          valido: false,
          motivo: erro instanceof errors.JWTExpired ? "expirado" : "invalido",
        };
      }
    },
  };
}

/** `JWT_CHAVES_ANTERIORES`: lista JSON de PEM públicos (`\n` literal aceito). */
export function lerChavesAnteriores(json: string | undefined): string[] {
  if (!json) return [];
  return z
    .array(z.string())
    .parse(JSON.parse(json))
    .map((pem) => pem.replace(/\\n/g, "\n"));
}
