import {
  type Contrato,
  type EntradaDe,
  montarCaminho,
  type ParametrosDe,
  type SaidaDe,
  usaCorpo,
} from "@erp/shared/contrato";
import { contratosAuth } from "@erp/shared/contratos/auth";
import { type CodigoErro, erroPadrao, MENSAGEM_ERRO_INTERNO } from "@erp/shared/erros";
import { type z } from "@erp/shared/zod";

/** Erro devolvido pela API no formato padrão `{ erro: { codigo, mensagem } }`. */
export class ErroDaApi extends Error {
  constructor(
    readonly codigo: CodigoErro,
    mensagem: string,
    /** 0 = a requisição nem chegou ao servidor (rede). */
    readonly status: number,
  ) {
    super(mensagem);
    this.name = "ErroDaApi";
  }
}

export const MENSAGEM_SEM_CONEXAO =
  "Sem conexão com o servidor. Verifique a internet e tente de novo.";

/**
 * Token de acesso só na memória da aba (nunca em storage: um XSS não o leva embora). Some no F5
 * e volta pelo cookie httpOnly de refresh na primeira chamada que tomar 401.
 */
let tokenAcesso: string | null = null;

export function definirTokenAcesso(token: string | null): void {
  tokenAcesso = token;
}

interface OpcoesSoltas {
  parametros?: Record<string, string>;
  entrada?: unknown;
}

type Opcoes<C extends Contrato> = (C["parametros"] extends z.ZodObject
  ? { parametros: ParametrosDe<C> }
  : { parametros?: never }) &
  (C["entrada"] extends z.ZodType ? { entrada: EntradaDe<C> } : { entrada?: never });

/** Sem parâmetros nem entrada, o segundo argumento é opcional. */
type Argumentos<C extends Contrato> = object extends Opcoes<C> ? [Opcoes<C>?] : [Opcoes<C>];

function paraQuery(entrada: unknown): string {
  if (typeof entrada !== "object" || entrada === null) return "";
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(entrada)) {
    if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean") {
      busca.append(chave, String(valor));
    } else if (Array.isArray(valor)) {
      // Lista vira a chave repetida (`?x=a&x=b`).
      for (const item of valor) busca.append(chave, String(item));
    }
  }
  const texto = busca.toString();
  return texto ? `?${texto}` : "";
}

async function enviar(contrato: Contrato, opcoes: OpcoesSoltas): Promise<Response> {
  let url = montarCaminho(contrato.caminho, opcoes.parametros);
  const cabecalhos = new Headers({ accept: "application/json" });
  if (tokenAcesso) cabecalhos.set("authorization", `Bearer ${tokenAcesso}`);
  let corpo: string | null = null;
  if (opcoes.entrada !== undefined) {
    if (usaCorpo(contrato.metodo)) {
      cabecalhos.set("content-type", "application/json");
      corpo = JSON.stringify(opcoes.entrada);
    } else {
      url += paraQuery(opcoes.entrada);
    }
  }
  try {
    return await fetch(url, {
      method: contrato.metodo,
      headers: cabecalhos,
      body: corpo,
      credentials: "same-origin",
    });
  } catch {
    throw new ErroDaApi("INDISPONIVEL", MENSAGEM_SEM_CONEXAO, 0);
  }
}

async function lerErro(resposta: Response): Promise<ErroDaApi> {
  const corpo: unknown = await resposta.json().catch(() => null);
  const lido = erroPadrao.safeParse(corpo);
  return lido.success
    ? new ErroDaApi(lido.data.erro.codigo, lido.data.erro.mensagem, resposta.status)
    : new ErroDaApi("ERRO_INTERNO", MENSAGEM_ERRO_INTERNO, resposta.status);
}

let renovacaoEmCurso: Promise<boolean> | null = null;

/**
 * Troca o cookie de refresh por um token novo. Chamadas simultâneas que tomam 401 esperam a
 * mesma renovação: o refresh é rotativo e duas renovações seguidas pareceriam reuso de token.
 */
export function renovarSessao(): Promise<boolean> {
  renovacaoEmCurso ??= (async () => {
    try {
      const resposta = await enviar(contratosAuth.renovar, {});
      if (!resposta.ok) {
        tokenAcesso = null;
        return false;
      }
      tokenAcesso = contratosAuth.renovar.saida.parse(await resposta.json()).tokenAcesso;
      return true;
    } finally {
      renovacaoEmCurso = null;
    }
  })();
  return renovacaoEmCurso;
}

/** 401 no login ou no próprio refresh é resposta final, não sessão vencida. */
const SEM_RENOVACAO: ReadonlySet<Contrato> = new Set([contratosAuth.login, contratosAuth.renovar]);

/**
 * Chama um endpoint pelo contrato: monta caminho, query ou corpo, renova a sessão uma vez em caso
 * de 401 e repete, e valida a resposta com o schema de saída.
 */
export async function chamar<C extends Contrato>(
  contrato: C,
  ...argumentos: Argumentos<C>
): Promise<SaidaDe<C>>;
export async function chamar(contrato: Contrato, opcoes: OpcoesSoltas = {}): Promise<unknown> {
  let resposta = await enviar(contrato, opcoes);
  if (resposta.status === 401 && !SEM_RENOVACAO.has(contrato) && (await renovarSessao())) {
    resposta = await enviar(contrato, opcoes);
  }
  if (!resposta.ok) throw await lerErro(resposta);
  return contrato.saida.parse(await resposta.json());
}

export function ehSessaoVencida(erro: unknown): boolean {
  return erro instanceof ErroDaApi && erro.status === 401;
}
