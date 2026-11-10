import { createPrivateKey, createPublicKey, randomUUID } from "node:crypto";

import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { gerarChavePem } from "../testes/cenario";
import { criarEmissorDeTokens, lerChavesAnteriores } from "./tokens";

const base = { emissor: "erp-ssw", audiencia: "erp-ssw-web", chavesAnteriores: {} };
const sessao = { usuarioId: randomUUID(), empresaId: randomUUID(), familiaId: randomUUID() };

describe("tokens de acesso (EdDSA)", () => {
  it("emite e verifica com kid", async () => {
    const emissor = criarEmissorDeTokens({ ...base, chavePrivadaPem: gerarChavePem(), kid: "k1" });
    const token = await emissor.emitir(sessao);
    expect(JSON.parse(Buffer.from(token.split(".")[0] ?? "", "base64url").toString())).toEqual({
      alg: "EdDSA",
      kid: "k1",
    });
    expect(await emissor.verificar(token)).toEqual({ valido: true, sessao });
  });

  it("rotação: chave nova emite, a anterior ainda é aceita até expirar", async () => {
    const antiga = gerarChavePem();
    const tokenAntigo = await criarEmissorDeTokens({
      ...base,
      chavePrivadaPem: antiga,
      kid: "k1",
    }).emitir(sessao);
    const publicaAntiga = createPublicKey(createPrivateKey(antiga))
      .export({ type: "spki", format: "pem" })
      .toString();
    const nova = criarEmissorDeTokens({
      ...base,
      chavePrivadaPem: gerarChavePem(),
      kid: "k2",
      chavesAnteriores: lerChavesAnteriores(JSON.stringify({ k1: publicaAntiga })),
    });
    expect(await nova.verificar(tokenAntigo)).toMatchObject({ valido: true });
  });

  it("recusa assinatura de outra chave, kid desconhecido e token vencido", async () => {
    const emissor = criarEmissorDeTokens({ ...base, chavePrivadaPem: gerarChavePem(), kid: "k1" });
    const outro = criarEmissorDeTokens({ ...base, chavePrivadaPem: gerarChavePem(), kid: "k1" });
    expect(await emissor.verificar(await outro.emitir(sessao))).toEqual({
      valido: false,
      motivo: "invalido",
    });

    const chave = gerarChavePem();
    const vencido = await new SignJWT({ emp: null, sid: sessao.familiaId })
      .setProtectedHeader({ alg: "EdDSA", kid: "k1" })
      .setSubject(sessao.usuarioId)
      .setIssuer(base.emissor)
      .setAudience(base.audiencia)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(createPrivateKey(chave));
    const mesmoEmissor = criarEmissorDeTokens({ ...base, chavePrivadaPem: chave, kid: "k1" });
    expect(await mesmoEmissor.verificar(vencido)).toEqual({ valido: false, motivo: "expirado" });
  });
});
