/**
 * Recepção do webhook SSW2181 (`/api/public/ssw-ocorrencias`): o SSW posta uma ocorrência por
 * chamada. Aqui só se autentica (segredo da empresa), lê, registra o evento e enfileira; o
 * processamento (CT-e e ocorrência pelo núcleo) é do worker. Toda saída com empresa conhecida
 * grava `ssw_webhook_eventos`; sem empresa vai só para o log (sem o segredo).
 * Especificação: docs/regras/06-ingestao.md §0.1, §3.17.
 */
import { createHash } from "node:crypto";

import { type SegredoCifrado } from "@erp/db/segredos";
import {
  candidatosDaCredencial,
  cnpjsAceitosDosParametros,
  cnpjTransportadora,
  cnpjTransportadoraAceito,
  conferirSegredo,
  extrairTokensAuthorization,
  gerarProtocolo,
  lerEventoSsw2181,
  numeroNfe,
  pedido,
  respostaSsw2181,
  type RetornoSsw2181,
  statusHttpDoErro,
} from "@erp/dominio/ingestao/webhook-ssw";

import { type FilasDeIngestao } from "./casos-de-uso";

/** Empresa com a integração do webhook (ligada ou não), como o cadastro está. */
export interface EmpresaDoWebhook {
  id: string;
  slug: string;
  nome: string;
  status: string;
  integracaoAtiva: boolean;
  parametros: Record<string, unknown>;
  segredo: SegredoCifrado | null;
}

export interface EventoRecebido {
  empresaId: string;
  ip: string | null;
  userAgent: string | null;
  autenticado: boolean;
  motivoRejeicao: string | null;
  statusHttp: number;
  payloadBruto: unknown;
  /** SHA-256 de cada candidato a token recebido; nunca o token. */
  tokenSha256: string[] | null;
  erroProcessamento: string | null;
}

export interface PortasDoWebhook {
  /** Empresas com a integração `ssw_webhook` cadastrada (cache de 60 s por quem implementa). */
  empresas(): Promise<EmpresaDoWebhook[]>;
  /** Decifra o segredo da empresa; `null` sem chave no servidor. */
  segredo(empresa: EmpresaDoWebhook): string | null;
  registrarEvento(evento: EventoRecebido): Promise<string>;
  marcarEvento(
    empresaId: string,
    eventoId: string,
    statusHttp: number,
    erro: string,
  ): Promise<void>;
  filas: FilasDeIngestao | null;
  agora: () => Date;
  aleatorio: () => number;
  /** Log sem segredo: só tamanhos e motivos. */
  avisar: (dados: Record<string, unknown>, mensagem: string) => void;
}

/** O que dá para saber antes de ler o corpo. */
export interface CabecalhosDoWebhook {
  authorization: string;
  segredoNaQuery: string;
  empresaNaQuery: string;
  ip: string | null;
  userAgent: string | null;
}

export interface RequisicaoDoWebhook extends CabecalhosDoWebhook {
  corpoBruto: string;
}

export interface RespostaDoWebhook {
  status: number;
  corpo: RetornoSsw2181[];
}

/** Resultado da autenticação, decidida só pelos cabeçalhos e pela query (antes do corpo). */
export type AutenticacaoDoWebhook =
  | { tipo: "autenticado"; empresa: EmpresaDoWebhook; resumos: string[] | null }
  | {
      tipo: "token_incorreto";
      empresa: EmpresaDoWebhook;
      resumos: string[] | null;
      resposta: RespostaDoWebhook;
    }
  | { tipo: "recusado"; resposta: RespostaDoWebhook };

/** SHA-256 em hex: o que se guarda da credencial recebida e o que o reprocesso compara. */
export function resumoDoSegredo(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

const STATUS_QUE_INGERE = new Set(["ativa", "implantacao"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `?empresa=<slug|id>` (sem diferenciar maiúsculas). origem: decidirEmpresaIngestao */
function resolverEmpresa(
  empresas: readonly EmpresaDoWebhook[],
  pedida: string,
): { tipo: "ok"; empresa: EmpresaDoWebhook } | { tipo: "erro"; motivo: string } {
  const alvo = pedida.toLowerCase();
  const empresa = empresas.find((e) => (UUID.test(pedida) ? e.id : e.slug).toLowerCase() === alvo);
  if (!empresa) return { tipo: "erro", motivo: "empresa_desconhecida" };
  if (!STATUS_QUE_INGERE.has(empresa.status)) return { tipo: "erro", motivo: "empresa_inativa" };
  if (!empresa.integracaoAtiva) return { tipo: "erro", motivo: "integracao_desligada" };
  return { tipo: "ok", empresa };
}

function erroSsw(agora: Date) {
  return (codigo: number, descricao: string, extras: Record<string, unknown> = {}) => ({
    status: statusHttpDoErro(codigo),
    corpo: respostaSsw2181(codigo, descricao, agora, extras),
  });
}

/**
 * Autentica pela credencial e pela empresa pedida, sem ler o corpo. Recusa com empresa conhecida
 * grava só metadados (IP, user-agent, motivo, resumo do token). "Token incorreto" com empresa
 * conhecida segue para `processarWebhook`, que decide o que guardar.
 * origem: handler POST de src/routes/api/public/ssw-ocorrencias.ts (sistema atual)
 */
export async function autenticarWebhook(
  portas: PortasDoWebhook,
  req: CabecalhosDoWebhook,
): Promise<AutenticacaoDoWebhook> {
  const erro = erroSsw(portas.agora());
  const auth = extrairTokensAuthorization(req.authorization);
  let esperado = "";
  // Sem o texto do token: só os resumos (com o comprimento do segredo atual para o caso "contém").
  const resumos = () =>
    req.authorization || req.segredoNaQuery
      ? candidatosDaCredencial(req.authorization, req.segredoNaQuery, [esperado.length]).map(
          resumoDoSegredo,
        )
      : null;
  const recusar = async (
    empresa: EmpresaDoWebhook | null,
    resposta: RespostaDoWebhook,
    motivo: string,
  ): Promise<AutenticacaoDoWebhook> => {
    if (empresa) {
      await portas.registrarEvento({
        empresaId: empresa.id,
        ip: req.ip,
        userAgent: req.userAgent,
        autenticado: false,
        motivoRejeicao: motivo,
        statusHttp: resposta.status,
        payloadBruto: null,
        tokenSha256: resumos(),
        erroProcessamento: null,
      });
    }
    return { tipo: "recusado", resposta };
  };
  const avisar = (motivo: string, extra: Record<string, unknown> = {}) => {
    portas.avisar(
      {
        ip: req.ip,
        motivo,
        esquema: auth.esquema,
        authorizationTamanho: req.authorization.length,
        segredoNaQueryTamanho: req.segredoNaQuery.length,
        ...extra,
      },
      `webhook SSW2181 ${motivo}`,
    );
  };

  const cadastradas = await portas.empresas();
  let empresa: EmpresaDoWebhook | null = null;
  if (req.empresaNaQuery) {
    const r = resolverEmpresa(cadastradas, req.empresaNaQuery);
    if (r.tipo === "erro") {
      avisar(r.motivo);
      return recusar(
        null,
        erro(401, "EMPRESA INVALIDA OU WEBHOOK DESLIGADO", { motivo: r.motivo }),
        r.motivo,
      );
    }
    empresa = r.empresa;
    esperado = portas.segredo(empresa)?.trim() ?? "";
    if (!esperado) {
      return recusar(
        empresa,
        erro(
          503,
          "WEBHOOK NAO CONFIGURADO — cadastre o segredo em Plataforma → Empresa → Integrações",
        ),
        "webhook_nao_configurado",
      );
    }
  }

  if (!req.authorization && !req.segredoNaQuery) {
    avisar("autorizacao_ausente");
    return recusar(
      empresa,
      erro(
        401,
        "AUTORIZACAO AUSENTE — envie header 'Authorization: Bearer <token>' ou parametro ?secret=<token>",
        { motivo: "autorizacao_ausente" },
      ),
      "autorizacao_ausente",
    );
  }
  if (
    req.authorization &&
    auth.esquema !== "raw" &&
    auth.tokens.length === 0 &&
    !req.segredoNaQuery
  ) {
    avisar("token_header_vazio");
    return recusar(
      empresa,
      erro(
        401,
        "TOKEN DO HEADER VAZIO — Authorization foi recebido sem credencial valida apos o esquema",
        { motivo: "token_header_vazio" },
      ),
      "token_header_vazio",
    );
  }

  // Sem ?empresa=, a empresa é a dona do segredo recebido.
  if (empresa === null) {
    for (const candidata of cadastradas) {
      if (!candidata.integracaoAtiva || !STATUS_QUE_INGERE.has(candidata.status)) continue;
      const segredo = portas.segredo(candidata)?.trim() ?? "";
      if (
        segredo &&
        conferirSegredo(segredo, req.authorization, req.segredoNaQuery).tipo === "ok"
      ) {
        empresa = candidata;
        esperado = segredo;
        break;
      }
    }
  }
  const conferido = conferirSegredo(esperado, req.authorization, req.segredoNaQuery);
  if (empresa === null || conferido.tipo === "recusado") {
    const origem = conferido.tipo === "recusado" ? conferido.origem : "header";
    const comprimento = conferido.tipo === "recusado" ? conferido.comprimento : 0;
    avisar("token_incorreto", {
      origem,
      comprimentoRecebido: comprimento,
      esperadoTamanho: esperado.length,
    });
    const resposta = erro(
      401,
      `TOKEN INVALIDO — valor recebido via ${origem} nao confere com o configurado`,
      {
        motivo: "token_incorreto",
        origem,
        comprimento_recebido: comprimento,
      },
    );
    if (empresa === null) return { tipo: "recusado", resposta };
    return { tipo: "token_incorreto", empresa, resumos: resumos(), resposta };
  }
  return { tipo: "autenticado", empresa, resumos: resumos() };
}

/** Com a autenticação já decidida: lê o corpo, registra o evento e enfileira. */
export async function processarWebhook(
  portas: PortasDoWebhook,
  req: RequisicaoDoWebhook,
  autenticacao: Exclude<AutenticacaoDoWebhook, { tipo: "recusado" }>,
): Promise<RespostaDoWebhook> {
  const agora = portas.agora();
  const erro = erroSsw(agora);
  const { empresa, resumos } = autenticacao;
  const registrar = (
    statusHttp: number,
    motivo: string | null,
    payload: unknown,
    autenticado: boolean,
  ) =>
    portas.registrarEvento({
      empresaId: empresa.id,
      ip: req.ip,
      userAgent: req.userAgent,
      statusHttp,
      motivoRejeicao: motivo,
      payloadBruto: payload,
      tokenSha256: resumos,
      autenticado,
      erroProcessamento: null,
    });

  const corpo = lerJson(req.corpoBruto);
  if (autenticacao.tipo === "token_incorreto") {
    await registrar(autenticacao.resposta.status, "token_incorreto", corpo ?? null, false);
    return autenticacao.resposta;
  }
  if (corpo === undefined) {
    portas.avisar({ ip: req.ip, motivo: "json_invalido" }, "webhook SSW2181 json_invalido");
    return erro(400, "NAO FOI POSSIVEL PROCESSAR A REQUISICAO (json invalido)");
  }

  const cnpj = cnpjTransportadora(corpo);
  const aceitos = cnpjsAceitosDosParametros(empresa.parametros.cnpjs_aceitos);
  if (!cnpjTransportadoraAceito(cnpj, aceitos)) {
    portas.avisar(
      { ip: req.ip, motivo: "cnpj_nao_autorizado", cnpjRecebido: cnpj || "(vazio)" },
      "webhook SSW2181 cnpj_nao_autorizado",
    );
    await registrar(401, "cnpj_nao_autorizado", corpo, true);
    return erro(
      401,
      `CNPJ TRANSPORTADORA NAO AUTORIZADO — '${cnpj || "(vazio)"}' nao esta na allowlist`,
      { motivo: "cnpj_nao_autorizado", cnpj_recebido: cnpj },
    );
  }

  const lido = lerEventoSsw2181(corpo);
  if (lido.tipo === "falha") {
    await registrar(lido.status, lido.motivo, corpo, true);
    return erro(lido.status, lido.descricao);
  }

  const eventoId = await registrar(200, null, corpo, true);
  const protocolo = gerarProtocolo(agora, portas.aleatorio);
  try {
    if (portas.filas === null) throw new Error("fila de processamento indisponível");
    await portas.filas.enfileirar(
      "ssw_webhook",
      { empresaId: empresa.id, eventoId, protocolo },
      { deduplicar: `ssw_webhook__${eventoId}` },
    );
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    await portas.marcarEvento(empresa.id, eventoId, 503, mensagem);
    return erro(503, "SERVICO TEMPORARIAMENTE INDISPONIVEL — reenvie a ocorrencia");
  }
  return {
    status: 200,
    corpo: respostaSsw2181(200, "OCORRENCIA PROCESSADA COM SUCESSO", agora, {
      numeroNFe: numeroNfe(corpo),
      pedido: pedido(corpo),
      protocolo,
    }),
  };
}

/** As duas etapas juntas (a rota faz a primeira no `onRequest`, antes de ler o corpo). */
export async function receberWebhook(
  portas: PortasDoWebhook,
  req: RequisicaoDoWebhook,
): Promise<RespostaDoWebhook> {
  const autenticacao = await autenticarWebhook(portas, req);
  if (autenticacao.tipo === "recusado") return autenticacao.resposta;
  return processarWebhook(portas, req, autenticacao);
}

/** Corpo vazio vale como `{}` (como hoje); JSON inválido = `undefined`. */
function lerJson(texto: string): unknown {
  if (texto.trim() === "") return {};
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return undefined;
  }
}
