import { createPrivateKey, createPublicKey, randomUUID } from "node:crypto";

import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { gerarChavePem } from "../testes/cenario";
import { criarEmissorDeTokens, kidDaChave, lerChavesAnteriores } from "./tokens";

const base = { emissor: "erp-ssw", audiencia: "erp-ssw-web", chavesAnteriores: [] };
const sessao = { usuarioId: randomUUID(), empresaId: randomUUID(), familiaId: randomUUID() };

describe("tokens de acesso (EdDSA)", () => {
  it("emite e verifica com o kid tirado da própria chave", async () => {
    const chave = gerarChavePem();
    const emissor = criarEmissorDeTokens({ ...base, chavePrivadaPem: chave });
    const token = await emissor.emitir(sessao);
    expect(JSON.parse(Buffer.from(token.split(".")[0] ?? "", "base64url").toString())).toEqual({
      alg: "EdDSA",
      kid: kidDaChave(chave),
    });
    expect(kidDaChave(chave)).toMatch(/^[\w-]{43}$/);
    expect(await emissor.verificar(token)).toEqual({ valido: true, sessao });
  });

  it("rotação: chave nova emite, a anterior ainda é aceita até expirar", async () => {
    const antiga = gerarChavePem();
    const tokenAntigo = await criarEmissorDeTokens({ ...base, chavePrivadaPem: antiga }).emitir(
      sessao,
    );
    const publicaAntiga = createPublicKey(createPrivateKey(antiga))
      .export({ type: "spki", format: "pem" })
      .toString();
    const nova = criarEmissorDeTokens({
      ...base,
      chavePrivadaPem: gerarChavePem(),
      chavesAnteriores: lerChavesAnteriores(JSON.stringify([publicaAntiga])),
    });
    expect(await nova.verificar(tokenAntigo)).toMatchObject({ valido: true });
  });

  it("recusa assinatura de outra chave, kid desconhecido e token vencido", async () => {
    const emissor = criarEmissorDeTokens({ ...base, chavePrivadaPem: gerarChavePem() });
    const outro = criarEmissorDeTokens({ ...base, chavePrivadaPem: gerarChavePem() });
    expect(await emissor.verificar(await outro.emitir(sessao))).toEqual({
      valido: false,
      motivo: "invalido",
    });

    const chave = gerarChavePem();
    const vencido = await new SignJWT({ emp: null, sid: sessao.familiaId })
      .setProtectedHeader({ alg: "EdDSA", kid: kidDaChave(chave) })
      .setSubject(sessao.usuarioId)
      .setIssuer(base.emissor)
      .setAudience(base.audiencia)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(createPrivateKey(chave));
    const mesmoEmissor = criarEmissorDeTokens({ ...base, chavePrivadaPem: chave });
    expect(await mesmoEmissor.verificar(vencido)).toEqual({ valido: false, motivo: "expirado" });
  });
});
