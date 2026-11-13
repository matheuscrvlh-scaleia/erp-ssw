import { hash, verify } from "@node-rs/argon2";
import bcrypt from "bcryptjs";

export type AlgoritmoSenha = "argon2id" | "bcrypt";

export interface ServicoDeSenhas {
  gerarHash(senha: string): Promise<string>;
  conferir(senha: string, hashGravado: string, algoritmo: AlgoritmoSenha): Promise<boolean>;
  /** Mesmo custo de uma conferência, para e-mail inexistente não responder mais rápido. */
  gastarTempo(senha: string): Promise<void>;
}

// Parâmetros mínimos da OWASP para argon2id (19 MiB, 2 passadas, 1 via). O padrão da biblioteca
// já é argon2id.
const ARGON2 = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function criarServicoDeSenhas(): ServicoDeSenhas {
  let hashDeReferencia: Promise<string> | undefined;
  return {
    gerarHash: (senha) => hash(senha, ARGON2),
    conferir: (senha, hashGravado, algoritmo) =>
      // bcrypt só para as senhas vindas do Supabase Auth; o login regrava em argon2id.
      algoritmo === "bcrypt" ? bcrypt.compare(senha, hashGravado) : verify(hashGravado, senha),
    gastarTempo: async (senha) => {
      hashDeReferencia ??= hash("referencia-de-tempo", ARGON2);
      await verify(await hashDeReferencia, senha);
    },
  };
}
