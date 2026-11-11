import { randomBytes } from "node:crypto";

import { cifrarSegredo, contextoDaPlataforma, lerChavesDeSegredo } from "@erp/db/segredos";
import { describe, expect, it, vi } from "vitest";

import {
  criarFonteDaConfiguracao,
  type LinhaDaPlataforma,
  montarConfiguracao,
} from "./configuracao-da-plataforma";

const chaves = lerChavesDeSegredo(`1:${randomBytes(32).toString("base64")}`);
const outras = lerChavesDeSegredo(`1:${randomBytes(32).toString("base64")}`);
const cifrado = (tipo: string, valor: string) =>
  cifrarSegredo(chaves, valor, contextoDaPlataforma(tipo));

const completas: LinhaDaPlataforma[] = [
  { tipo: "dominio", parametros: { url: "https://erp.fr.com.br/qualquer" }, segredo: null },
  {
    tipo: "email",
    parametros: { remetente: "Painel <nao-responda@fr.com.br>" },
    segredo: cifrado("email", "re_123"),
  },
  {
    tipo: "worker_ssw",
    parametros: { url: "http://host.docker.internal:3002" },
    segredo: cifrado("worker_ssw", "t".repeat(40)),
  },
];

describe("configuração da Plataforma", () => {
  it("monta domínio (só a origem), e-mail e worker-ssw com os segredos decifrados", () => {
    expect(montarConfiguracao(completas, chaves, vi.fn())).toEqual({
      dominio: "https://erp.fr.com.br",
      email: { remetente: "Painel <nao-responda@fr.com.br>", chaveApi: "re_123" },
      workerSsw: { url: "http://host.docker.internal:3002", token: "t".repeat(40) },
    });
  });

  it("sem linha, sem segredo ou com parâmetro inválido = não configurado", () => {
    expect(montarConfiguracao([], chaves, vi.fn())).toEqual({
      dominio: null,
      email: null,
      workerSsw: null,
    });
    const semSegredo = completas.map((l) => ({ ...l, segredo: null }));
    expect(montarConfiguracao(semSegredo, chaves, vi.fn()).email).toBeNull();
    const invalido: LinhaDaPlataforma[] = [
      { tipo: "dominio", parametros: { url: "não é url" }, segredo: null },
    ];
    expect(montarConfiguracao(invalido, chaves, vi.fn()).dominio).toBeNull();
  });

  it("segredo que não decifra (chave mestra trocada) avisa e conta como não configurado", () => {
    const aoFalhar = vi.fn();
    const config = montarConfiguracao(completas, outras, aoFalhar);
    expect(config.email).toBeNull();
    expect(config.workerSsw).toBeNull();
    expect(aoFalhar.mock.calls.map((chamada: unknown[]) => chamada[1])).toEqual([
      "email",
      "worker_ssw",
    ]);
    expect(JSON.stringify(aoFalhar.mock.calls)).not.toContain("re_123");
  });

  it("cache de 30 s; invalidar força nova leitura; falha do banco não fica guardada", async () => {
    let agora = new Date("2026-11-11T12:00:00Z");
    const ler = vi.fn(() => Promise.resolve(completas));
    const fonte = criarFonteDaConfiguracao({ ler, chaves, agora: () => agora, aoFalhar: vi.fn() });
    await fonte.obter();
    await fonte.obter();
    expect(ler).toHaveBeenCalledTimes(1);
    agora = new Date(agora.getTime() + 31_000);
    await fonte.obter();
    expect(ler).toHaveBeenCalledTimes(2);
    fonte.invalidar();
    await fonte.obter();
    expect(ler).toHaveBeenCalledTimes(3);

    ler.mockRejectedValueOnce(new Error("banco fora"));
    fonte.invalidar();
    await expect(fonte.obter()).rejects.toThrow("banco fora");
    expect((await fonte.obter()).dominio).toBe("https://erp.fr.com.br");
  });
});
