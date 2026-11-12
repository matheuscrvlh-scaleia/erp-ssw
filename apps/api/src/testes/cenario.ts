import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";

import { type ChavesDeSegredo, lerChavesDeSegredo } from "@erp/db/segredos";
import { type JobEnfileiravel } from "@erp/shared/jobs";
import { type FastifyInstance } from "fastify";

import { construirApp, type Dependencias } from "../app";
import { type Ambiente, carregarAmbiente } from "../config/env";
import type { Armazenamento } from "../infra/armazenamento";
import { type Correio, type Mensagem } from "../infra/correio";
import type { DadosDoJob, FilaDeJobs } from "../infra/fila";
import { type ProvedorGoogle } from "../infra/google";
import { criarLimitadorEmMemoria } from "../infra/limitador";
import { criarServicoDeSenhas } from "../infra/senhas";
import { criarEmissorDeTokens, type EmissorDeTokens } from "../infra/tokens";
import { type DependenciasAuth } from "../modulos/auth/casos-de-uso";
import { BancoEmMemoria, type UsuarioFalso } from "./banco-em-memoria";

export function gerarChavePem(): string {
  return generateKeyPairSync("ed25519")
    .privateKey.export({ type: "pkcs8", format: "pem" })
    .toString();
}

export function ambienteDeTeste(extra: Record<string, string> = {}): Ambiente {
  return carregarAmbiente({
    NODE_ENV: "test",
    DATABASE_URL: "postgres://teste@localhost/teste",
    WEB_URL: "http://localhost:5173",
    JWT_CHAVE_PRIVADA: gerarChavePem(),
    COOKIE_SEGREDO: "segredo-de-teste-com-mais-de-32-caracteres",
    ...extra,
  });
}

export class CorreioFalso implements Correio {
  enviados: Mensagem[] = [];
  enviar(mensagem: Mensagem) {
    this.enviados.push(mensagem);
    return Promise.resolve();
  }
}

export class FilaFalsa implements FilaDeJobs {
  ligada = true;
  jobs: { nome: string; fila: string; dados: DadosDoJob }[] = [];
  enfileirar(job: JobEnfileiravel, dados: DadosDoJob) {
    this.jobs.push({ ...job, dados });
    return Promise.resolve(true);
  }
}

export class ArmazenamentoFalso implements Armazenamento {
  arquivos = new Map<string, { conteudo: Uint8Array; tipo: string }>();
  enviar(caminho: string, conteudo: Uint8Array, tipo: string) {
    this.arquivos.set(caminho, { conteudo, tipo });
    return Promise.resolve();
  }
  apagar(caminho: string) {
    this.arquivos.delete(caminho);
    return Promise.resolve();
  }
}

/** Relógio controlável: os testes avançam o tempo sem esperar. */
export class Relogio {
  constructor(public atual = new Date("2026-11-10T12:00:00Z")) {}
  agora = () => this.atual;
  avancar(ms: number) {
    this.atual = new Date(this.atual.getTime() + ms);
  }
}

export interface Cenario {
  banco: BancoEmMemoria;
  tokens: EmissorDeTokens;
  correio: CorreioFalso;
  relogio: Relogio;
  ambiente: Ambiente;
  deps: DependenciasAuth;
  fila: FilaFalsa;
  armazenamento: ArmazenamentoFalso;
  chavesDeSegredo: ChavesDeSegredo;
}

export function criarCenario(): Cenario {
  const banco = new BancoEmMemoria();
  const ambiente = ambienteDeTeste();
  const relogio = new Relogio();
  const correio = new CorreioFalso();
  const tokens = criarEmissorDeTokens({
    chavePrivadaPem: ambiente.JWT_CHAVE_PRIVADA,
    chavesAnteriores: [],
    emissor: ambiente.JWT_EMISSOR,
    audiencia: ambiente.JWT_AUDIENCIA,
  });
  const deps: DependenciasAuth = {
    executar: banco.executar,
    senhas: criarServicoDeSenhas(),
    tokens,
    limitador: criarLimitadorEmMemoria(() => relogio.atual.getTime()),
    correio,
    agora: relogio.agora,
    webUrl: () => Promise.resolve("http://localhost:5173"),
    urlDoLogo: () => null,
  };
  return {
    banco,
    tokens,
    correio,
    relogio,
    ambiente,
    deps,
    fila: new FilaFalsa(),
    armazenamento: new ArmazenamentoFalso(),
    chavesDeSegredo: lerChavesDeSegredo(`1:${randomBytes(32).toString("base64")}`, 1),
  };
}

export async function construirAppDeTeste(
  cenario: Cenario,
  google: ProvedorGoogle | null = null,
  extras: Partial<Dependencias> = {},
): Promise<FastifyInstance> {
  const { deps } = cenario;
  return construirApp({
    ambiente: cenario.ambiente,
    executar: cenario.banco.executar,
    verificarBanco: () =>
      cenario.banco.falharCom === null ? Promise.resolve() : Promise.reject(new Error("fora")),
    redis: null,
    tokens: deps.tokens,
    senhas: deps.senhas,
    limitador: deps.limitador,
    correio: cenario.correio,
    google,
    workerSsw: null,
    fila: cenario.fila,
    armazenamento: cenario.armazenamento,
    chavesDeSegredo: cenario.chavesDeSegredo,
    agora: deps.agora,
    ...extras,
  });
}

export async function usuarioComSenha(
  cenario: Cenario,
  email: string,
  senha: string,
  dados: Partial<UsuarioFalso> = {},
): Promise<UsuarioFalso> {
  return cenario.banco.criarUsuario({
    email,
    senhaHash: await cenario.deps.senhas.gerarHash(senha),
    senhaAlgoritmo: "argon2id",
    ...dados,
  });
}

/** Sessão pronta (sem passar pelo login): grava a família e devolve o cabeçalho Bearer. */
export async function entrarComo(
  cenario: Cenario,
  usuarioId: string,
  empresaId: string | null,
): Promise<{ authorization: string }> {
  const familiaId = randomUUID();
  cenario.banco.sessoes.push({
    id: randomUUID(),
    usuarioId,
    familiaId,
    tokenHash: randomUUID(),
    empresaAtivaId: empresaId,
    criadoEm: cenario.relogio.atual,
    expiraEm: new Date(cenario.relogio.atual.getTime() + 86_400_000),
    ip: null,
    userAgent: null,
    substituidaEm: null,
    revogadaEm: null,
    motivo: null,
  });
  const token = await cenario.tokens.emitir({ usuarioId, empresaId, familiaId });
  return { authorization: `Bearer ${token}` };
}
