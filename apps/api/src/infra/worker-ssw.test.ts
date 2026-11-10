import { ErroDeNegocio } from "@erp/dominio/erros";
import { cicloDescartado, EXEMPLOS, situacaoDoFtp } from "@erp/shared/contratos/worker-ssw";
import { describe, expect, it } from "vitest";

import {
  criarClienteWorkerSsw,
  exigirWorkerSsw,
  MENSAGEM_WORKER_SSW_NAO_CONFIGURADO,
} from "./worker-ssw";

const EMPRESA = "0b9a2c3e-1d4f-4a5b-8c6d-7e8f9a0b1c2d";

function cliente(responder: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const chamadas: { url: string; init: RequestInit }[] = [];
  const falhas: string[] = [];
  const c = criarClienteWorkerSsw({
    url: "http://worker-ssw:3003/",
    token: "segredo-de-servico",
    buscar: (entrada, init = {}) => {
      const url =
        typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      chamadas.push({ url, init });
      return Promise.resolve(responder(url, init));
    },
    aoFalhar: (_erro, operacao) => falhas.push(operacao),
  });
  return { c, chamadas, falhas };
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

describe("cliente do worker-ssw", () => {
  it("pede a execução com o token de serviço e devolve o id", async () => {
    const { c, chamadas } = cliente(() => json({ execucaoId: "77" }, 202));
    const id = await c.pedirExecucao(EMPRESA, EXEMPLOS.pedido);
    expect(id).toBe("77");
    expect(chamadas[0]?.url).toBe(
      `http://worker-ssw:3003/interno/v1/empresas/${EMPRESA}/execucoes`,
    );
    expect(chamadas[0]?.init.method).toBe("POST");
    expect(chamadas[0]?.init.headers).toMatchObject({
      authorization: "Bearer segredo-de-servico",
    });
    expect(JSON.parse(chamadas[0]?.init.body as string)).toEqual(EXEMPLOS.pedido);
  });

  it("409 = já está na fila (null)", async () => {
    const { c } = cliente(() => json(EXEMPLOS.erro, 409));
    expect(await c.pedirExecucao(EMPRESA, { job: "sincronizar-ftp", deduplicar: true })).toBeNull();
  });

  it("consulta com a espera na query e lê o estado", async () => {
    const { c, chamadas } = cliente(() => json({ estado: "concluida", resultado: { ok: true } }));
    const fim = await c.consultarExecucao("verificar-token-ssw", "9", 30_000);
    expect(fim).toEqual({ estado: "concluida", resultado: { ok: true } });
    expect(chamadas[0]?.url).toBe(
      "http://worker-ssw:3003/interno/v1/execucoes/verificar-token-ssw/9?aguardarMs=30000",
    );
  });

  it("situação dos jobs da empresa", async () => {
    const { c } = cliente(() => json(EXEMPLOS.situacao));
    expect(await c.situacao(EMPRESA)).toEqual(EXEMPLOS.situacao);
  });

  it("fora do ar, erro HTTP ou resposta fora do contrato: 503 amigável e log", async () => {
    const fora = cliente(() => Promise.reject(new TypeError("fetch failed")));
    await expect(fora.c.situacao(EMPRESA)).rejects.toMatchObject({
      codigo: "INDISPONIVEL",
      message: expect.stringContaining("O worker do SSW não respondeu") as unknown,
    });
    expect(fora.falhas).toEqual(["situação"]);

    const erro = cliente(() => json({}, 500));
    await expect(erro.c.consultarExecucao("bi2-0017", "1", 0)).rejects.toBeInstanceOf(
      ErroDeNegocio,
    );
    const torto = cliente(() => json({ estado: "sumiu" }));
    await expect(torto.c.consultarExecucao("bi2-0017", "1", 0)).rejects.toBeInstanceOf(
      ErroDeNegocio,
    );
  });

  it("dados fora do zod do job não saem da API", async () => {
    const { c, chamadas } = cliente(() => json({ execucaoId: "1" }, 202));
    await expect(
      c.pedirExecucao(EMPRESA, { job: "aplicar-ciclos", dados: { empresaId: EMPRESA } }),
    ).rejects.toThrow();
    expect(chamadas).toEqual([]);
  });

  it("operação manual: caminho com o ciclo, corpo e resposta no formato da tela", async () => {
    const { c, chamadas } = cliente(() => json(EXEMPLOS.cicloDescartado));
    const r = await c.operacao(EMPRESA, "descartarCiclo", cicloDescartado, {
      parametros: { chave: "2026-11-10T12:00" },
      corpo: EXEMPLOS.descarte,
    });
    expect(r).toEqual(EXEMPLOS.cicloDescartado);
    expect(chamadas[0]?.url).toBe(
      `http://worker-ssw:3003/interno/v1/empresas/${EMPRESA}/ciclos/2026-11-10T12%3A00/descartar`,
    );
    expect(JSON.parse(chamadas[0]?.init.body as string)).toEqual(EXEMPLOS.descarte);

    const ftp = cliente(() => json(EXEMPLOS.ftp));
    expect(await ftp.c.operacao(EMPRESA, "ftp", situacaoDoFtp)).toEqual(EXEMPLOS.ftp);
    expect(ftp.chamadas[0]?.init.method).toBe("GET");
  });

  it("erro de negócio do worker-ssw chega ao operador com a mensagem dele", async () => {
    const conflito = {
      erro: { codigo: "CONFLITO", mensagem: "Ciclo já aplicado — descarte não permitido." },
    };
    const { c, falhas } = cliente(() => json(conflito, 409));
    await expect(
      c.operacao(EMPRESA, "descartarCiclo", cicloDescartado, { parametros: { chave: "x" } }),
    ).rejects.toMatchObject({
      codigo: "CONFLITO",
      message: "Ciclo já aplicado — descarte não permitido.",
    });
    expect(falhas).toEqual([]);

    const token = cliente(() =>
      json({ erro: { codigo: "NAO_AUTENTICADO", mensagem: "Token inválido." } }, 401),
    );
    await expect(token.c.situacao(EMPRESA)).rejects.toMatchObject({ codigo: "INDISPONIVEL" });
    expect(token.falhas).toEqual(["situação"]);
  });

  it("sem configuração, as ações respondem 503 com o aviso", () => {
    expect(() => exigirWorkerSsw(null)).toThrow(MENSAGEM_WORKER_SSW_NAO_CONFIGURADO);
  });
});
