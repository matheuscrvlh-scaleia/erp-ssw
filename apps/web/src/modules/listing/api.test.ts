import { type LinhaLista } from "@erp/shared/contracts/listing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { chamar } from "@/lib/api";

import { carregarTodasAsLinhas, LIMITE_DA_EXPORTACAO } from "./api";

vi.mock("@/lib/api", () => ({ chamar: vi.fn() }));

const chamarFalso = vi.mocked(chamar);

/** Páginas de `tamanho` linhas até `total` (só o que a exportação lê importa). */
function servir(total: number, tamanho: number) {
  chamarFalso.mockImplementation((_contrato, opcoes) => {
    const { pagina } = (opcoes as { entrada: { pagina: number } }).entrada;
    const inicio = (pagina - 1) * tamanho;
    const quantas = Math.max(0, Math.min(tamanho, total - inicio));
    const linhas = Array.from({ length: quantas }, () => ({}) as LinhaLista);
    return Promise.resolve({ linhas, temMais: inicio + quantas < total });
  });
}

const ordenacao = { ordem: "emissao", direcao: "desc" } as const;

describe("carregarTodasAsLinhas", () => {
  beforeEach(() => {
    chamarFalso.mockReset();
  });

  it("pede página a página até acabar, sem cortar", async () => {
    servir(12_345, 5000);
    const progresso: number[] = [];
    const r = await carregarTodasAsLinhas({ tipo: "emitidos" }, ordenacao, (n) => {
      progresso.push(n);
    });
    expect(r.linhas).toHaveLength(12_345);
    expect(r.cortada).toBe(false);
    expect(progresso).toEqual([5000, 10_000, 12_345]);
    expect(chamarFalso).toHaveBeenCalledTimes(3);
  });

  it("acima do teto exporta os primeiros e avisa que cortou", async () => {
    servir(LIMITE_DA_EXPORTACAO + 1, 5000);
    const r = await carregarTodasAsLinhas({ tipo: "emitidos" }, ordenacao);
    expect(r.linhas).toHaveLength(LIMITE_DA_EXPORTACAO);
    expect(r.cortada).toBe(true);
  });

  it("exatamente no teto não é corte", async () => {
    servir(LIMITE_DA_EXPORTACAO, 5000);
    const r = await carregarTodasAsLinhas({ tipo: "emitidos" }, ordenacao);
    expect(r.cortada).toBe(false);
  });
});
