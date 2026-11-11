import { createHash } from "node:crypto";

import { jsonCanonico, lerJson, type ValorJson } from "../transformacoes/json";

const MODULO = 1n << 64n;

/**
 * Checksum de conferência independente da ordem: soma (mod 2^64) do SHA-256 de cada linha em
 * forma canônica. Origem transformada e destino lido de volta têm de dar a mesma soma e a mesma
 * quantidade.
 */
export class SomaDeConferencia {
  private soma = 0n;
  private total = 0;

  /** `json`: colunas `jsonb` (texto da origem ou objeto montado: as duas formas comparam igual). */
  adicionar(linha: Readonly<Record<string, ValorJson>>, json: ReadonlySet<string>): void {
    this.adicionarParcela(SomaDeConferencia.parcela(linha, json));
  }

  /** Parcela de uma linha na soma (para quem precisa decidir antes quais linhas entram). */
  static parcela(linha: Readonly<Record<string, ValorJson>>, json: ReadonlySet<string>): bigint {
    const canonica: Record<string, ValorJson> = {};
    for (const chave of Object.keys(linha).sort()) {
      const valor = linha[chave] ?? null;
      canonica[chave] = json.has(chave) && typeof valor === "string" ? lerJson(valor) : valor;
    }
    const hash = createHash("sha256").update(jsonCanonico(canonica), "utf8").digest("hex");
    return BigInt(`0x${hash.slice(0, 16)}`);
  }

  adicionarParcela(parcela: bigint): void {
    this.soma = (this.soma + parcela) % MODULO;
    this.total += 1;
  }

  get quantidade(): number {
    return this.total;
  }

  get valor(): string {
    return this.soma.toString(16).padStart(16, "0");
  }
}
