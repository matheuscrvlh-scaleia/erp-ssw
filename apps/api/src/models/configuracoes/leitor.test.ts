import { type ConfiguracaoLida } from "@erp/dominio/configuracoes";
import { describe, expect, it } from "vitest";

import { criarCacheDeConfiguracoes, VALIDADE_DO_CACHE_MS } from "./cache";
import { criarLeitorDeConfiguracoes } from "./leitor";

function cenario() {
  let agora = new Date("2026-11-10T12:00:00Z");
  const linhas: ConfiguracaoLida[] = [
    { empresaId: null, chave: "sla_meta_pct", valor: "95" },
    { empresaId: null, chave: "otif_visivel", valor: "false" },
    { empresaId: "e1", chave: "sla_meta_pct", valor: "90" },
  ];
  const leituras: (string | null)[] = [];
  const cache = criarCacheDeConfiguracoes(() => agora);
  const ler = criarLeitorDeConfiguracoes((empresaId) => {
    leituras.push(empresaId);
    return Promise.resolve(linhas.filter((l) => l.empresaId === null || l.empresaId === empresaId));
  }, cache);
  const passar = (ms: number) => {
    agora = new Date(agora.getTime() + ms);
  };
  return { linhas, leituras, cache, ler, passar };
}

describe("leitor de configurações", () => {
  it("a da empresa vence a da Plataforma; só as chaves pedidas que existem", async () => {
    const { ler } = cenario();
    expect(await ler("e1", ["sla_meta_pct", "otif_visivel", "nao_existe"])).toEqual(
      new Map([
        ["sla_meta_pct", "90"],
        ["otif_visivel", "false"],
      ]),
    );
    expect(await ler(null, ["sla_meta_pct"])).toEqual(new Map([["sla_meta_pct", "95"]]));
  });

  it("lê o banco uma vez por empresa no cache; invalidar ou vencer lê de novo", async () => {
    const { leituras, cache, ler, passar } = cenario();
    await ler("e1", ["sla_meta_pct"]);
    await ler("e1", ["otif_visivel"]);
    expect(leituras).toEqual(["e1"]);
    cache.invalidar("e1");
    await ler("e1", ["sla_meta_pct"]);
    passar(VALIDADE_DO_CACHE_MS + 1);
    await ler("e1", ["sla_meta_pct"]);
    expect(leituras).toEqual(["e1", "e1", "e1"]);
  });
});
