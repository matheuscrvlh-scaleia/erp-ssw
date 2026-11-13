import { type CodigoDoAdmin } from "@erp/shared/contracts/occurrence-codes";
import { describe, expect, it } from "vitest";

import { filtrarCodigos, FILTROS_INICIAIS, rotulosDaLetra } from "./rules";

const codigo = (n: number, extra: Partial<CodigoDoAdmin> = {}): CodigoDoAdmin => ({
  codigo: n,
  descricao: `Código ${String(n)}`,
  responsavel: "FR",
  penaliza: false,
  letraResponsavel: "F",
  ativo: true,
  pendenteClassificacao: false,
  notas: null,
  tipoSsw: null,
  processoSsw: null,
  atualizadoEm: "2026-11-01T00:00:00.000Z",
  atualizadoPorNome: null,
  frequencia30d: 0,
  ...extra,
});

describe("filtros do Admin › Códigos", () => {
  const lista = [
    codigo(13, { descricao: "Devolução", penaliza: true, frequencia30d: 5 }),
    codigo(2, { letraResponsavel: "C", frequencia30d: 9 }),
    codigo(40, { ativo: false, atualizadoEm: "2026-11-09T00:00:00.000Z" }),
  ];

  it("padrão: só ativos, por código", () => {
    expect(filtrarCodigos(lista, FILTROS_INICIAIS).map((c) => c.codigo)).toEqual([2, 13]);
  });

  it("busca, letra, penaliza e ordenações", () => {
    const f = { ...FILTROS_INICIAIS, ativo: "tudo" as const };
    expect(filtrarCodigos(lista, { ...f, busca: "devol" }).map((c) => c.codigo)).toEqual([13]);
    expect(filtrarCodigos(lista, { ...f, letras: ["C"] }).map((c) => c.codigo)).toEqual([2]);
    expect(filtrarCodigos(lista, { ...f, penaliza: "sim" }).map((c) => c.codigo)).toEqual([13]);
    expect(filtrarCodigos(lista, { ...f, ordem: "freq" }).map((c) => c.codigo)).toEqual([
      2, 13, 40,
    ]);
    expect(filtrarCodigos(lista, { ...f, ordem: "atualizado" })[0]?.codigo).toBe(40);
  });

  it("a letra F leva o nome curto da empresa", () => {
    expect(rotulosDaLetra("ACME").F).toBe("ACME (transportadora)");
  });
});
