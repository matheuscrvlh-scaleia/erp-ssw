import { createHash, randomBytes } from "node:crypto";

/** Token opaco para cookie e link de e-mail: 256 bits, base64url. */
export function gerarTokenOpaco(): string {
  return randomBytes(32).toString("base64url");
}

/** O banco guarda só o hash: vazar a tabela não entrega sessões nem links válidos. */
export function hashDoToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
