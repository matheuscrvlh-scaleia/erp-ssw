import { createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";

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

export interface ConfigTokens {
  chavePrivadaPem: string;
  kid: string;
  /** Chaves públicas de rotações anteriores, aceitas até os tokens delas expirarem. */
  chavesAnteriores: Record<string, string>;
  emissor: string;
  audiencia: string;
}

/** JWT EdDSA (Ed25519) de 15 min, com `kid` para trocar a chave sem derrubar ninguém. */
export function criarEmissorDeTokens(config: ConfigTokens): EmissorDeTokens {
  const privada = createPrivateKey(config.chavePrivadaPem);
  const publicas = new Map<string, KeyObject>([[config.kid, createPublicKey(privada)]]);
  for (const [kid, pem] of Object.entries(config.chavesAnteriores)) {
    publicas.set(kid, createPublicKey(pem));
  }

  return {
    validadeSegundos: VALIDADE_SEGUNDOS,
    emitir: (sessao) =>
      new SignJWT({ emp: sessao.empresaId, sid: sessao.familiaId })
        .setProtectedHeader({ alg: ALGORITMO, kid: config.kid })
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

export function lerChavesAnteriores(json: string | undefined): Record<string, string> {
  if (!json) return {};
  const chaves = z.record(z.string(), z.string()).parse(JSON.parse(json));
  return Object.fromEntries(
    Object.entries(chaves).map(([kid, pem]) => [kid, pem.replace(/\\n/g, "\n")]),
  );
}
