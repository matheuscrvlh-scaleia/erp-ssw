import { randomBytes } from "node:crypto";

import {
  cifrarSegredo,
  contextoDaPlataforma,
  contextoDoSegredo,
  decifrarSegredo,
  lerChavesDeSegredo,
  type SegredoCifrado,
} from "@erp/db/segredos";
import { describe, expect, it } from "vitest";

import {
  type IntegracaoCifrada,
  recifrarSegredos,
  type RepositorioSegredos,
} from "./segredos.service";

const chave = () => randomBytes(32).toString("base64");
const k1 = chave();
const k2 = chave();
const antigas = lerChavesDeSegredo(`1:${k1}`, 1);
const novas = lerChavesDeSegredo(`1:${k1},2:${k2}`, 2);

function repositorio(linhas: IntegracaoCifrada[]): RepositorioSegredos {
  return {
    foraDaVersao: (versao) =>
      Promise.resolve(
        linhas.filter((l) =>
          [l.segredo, l.segredoAnterior].some((s) => s !== null && s.versaoChave !== versao),
        ),
      ),
    regravar: (alvo, segredos) => {
      const linha = linhas.find((l) => l.id === alvo.id && l.empresaId === alvo.empresaId);
      if (linha) Object.assign(linha, segredos);
      return Promise.resolve();
    },
  };
}

describe("recifrarSegredos", () => {
  it("regrava atual e anterior com a chave nova, no mesmo contexto; as antigas param de ser usadas", async () => {
    const ctx = contextoDoSegredo("e1", "ssw_webhook");
    const linha: IntegracaoCifrada = {
      id: "i1",
      empresaId: "e1",
      tipo: "ssw_webhook",
      segredo: cifrarSegredo(antigas, "segredo-atual", ctx),
      segredoAnterior: cifrarSegredo(antigas, "segredo-velho", ctx),
    };
    const semSegredo: IntegracaoCifrada = {
      id: "i2",
      empresaId: "e1",
      tipo: "xml_cte",
      segredo: null,
      segredoAnterior: null,
    };
    const repo = repositorio([linha, semSegredo]);

    expect(await recifrarSegredos(repo, novas)).toEqual({ recifrados: 1, falhas: [] });
    const lerSo2 = lerChavesDeSegredo(`2:${k2}`, 2);
    const ler = (s: SegredoCifrado | null) => (s ? decifrarSegredo(lerSo2, s, ctx) : null);
    expect(linha.segredo?.versaoChave).toBe(2);
    expect(ler(linha.segredo)).toBe("segredo-atual");
    expect(ler(linha.segredoAnterior)).toBe("segredo-velho");
    // Segunda rodada: nada mais fora da versão.
    expect(await recifrarSegredos(repo, novas)).toEqual({ recifrados: 0, falhas: [] });
  });

  it("linha que não decifra fica como está e volta como falha (sem o segredo)", async () => {
    const linha: IntegracaoCifrada = {
      id: "i1",
      empresaId: "e1",
      tipo: "sftp",
      // Copiado de outra empresa: o contexto não bate.
      segredo: cifrarSegredo(antigas, "senha", contextoDoSegredo("e9", "sftp")),
      segredoAnterior: null,
    };
    const original = linha.segredo;
    const r = await recifrarSegredos(repositorio([linha]), novas);
    expect(r).toEqual({ recifrados: 0, falhas: [{ empresaId: "e1", tipo: "sftp" }] });
    expect(linha.segredo).toBe(original);
  });

  it("segredo da Plataforma é recifrado no contexto plataforma:<tipo>", async () => {
    const ctx = contextoDaPlataforma("email");
    const linha: IntegracaoCifrada = {
      id: "email",
      empresaId: null,
      tipo: "email",
      segredo: cifrarSegredo(antigas, "re_chave", ctx),
      segredoAnterior: null,
    };
    expect(await recifrarSegredos(repositorio([linha]), novas)).toEqual({
      recifrados: 1,
      falhas: [],
    });
    expect(linha.segredo?.versaoChave).toBe(2);
    const recifrado = linha.segredo;
    if (!recifrado) throw new Error("segredo sumiu");
    expect(decifrarSegredo(lerChavesDeSegredo(`2:${k2}`), recifrado, ctx)).toBe("re_chave");
  });
});
