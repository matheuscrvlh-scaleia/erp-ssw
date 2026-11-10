/**
 * Recepção do webhook SSW2181 (`/api/public/ssw-ocorrencias`): o SSW posta uma ocorrência por
 * chamada. Aqui só se autentica (segredo da empresa), lê, registra o evento e enfileira; o
 * processamento (CT-e e ocorrência pelo núcleo) é do worker. Toda saída com empresa conhecida
 * grava `ssw_webhook_eventos`; sem empresa vai só para o log (sem o segredo).
 * Especificação: docs/regras/06-ingestao.md §0.1, §3.17.
 */
import { type SegredoCifrado } from "@erp/db/segredos";
import {
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

export interface RequisicaoDoWebhook {
  corpoBruto: string;
  authorization: string;
  segredoNaQuery: string;
  empresaNaQuery: string;
  ip: string | null;
  userAgent: string | null;
}

export interface RespostaDoWebhook {
  status: number;
  corpo: RetornoSsw2181[];
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

/** origem: handler POST de src/routes/api/public/ssw-ocorrencias.ts (sistema atual) */
export async function receberWebhook(
  portas: PortasDoWebhook,
  req: RequisicaoDoWebhook,
): Promise<RespostaDoWebhook> {
  const agora = portas.agora();
  const erro = (codigo: number, descricao: string, extras: Record<string, unknown> = {}) => ({
    status: statusHttpDoErro(codigo),
    corpo: respostaSsw2181(codigo, descricao, agora, extras),
  });
  const auth = extrairTokensAuthorization(req.authorization);
  const base = { ip: req.ip, userAgent: req.userAgent };
  const registrar = (
    empresaId: string,
    statusHttp: number,
    motivo: string | null,
    payload: unknown,
    autenticado = false,
  ) =>
    portas.registrarEvento({
      ...base,
      empresaId,
      statusHttp,
      motivoRejeicao: motivo,
      payloadBruto: payload,
      autenticado,
      erroProcessamento: null,
    });
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

  const corpo = lerJson(req.corpoBruto);
  if (corpo === undefined) {
    avisar("json_invalido");
    return erro(400, "NAO FOI POSSIVEL PROCESSAR A REQUISICAO (json invalido)");
  }

  const cadastradas = await portas.empresas();
  let empresa: EmpresaDoWebhook | null = null;
  let esperado = "";
  if (req.empresaNaQuery) {
    const r = resolverEmpresa(cadastradas, req.empresaNaQuery);
    if (r.tipo === "erro") {
      avisar(r.motivo);
      return erro(401, "EMPRESA INVALIDA OU WEBHOOK DESLIGADO", { motivo: r.motivo });
    }
    empresa = r.empresa;
    esperado = portas.segredo(empresa)?.trim() ?? "";
    if (!esperado) {
      await registrar(empresa.id, 503, "webhook_nao_configurado", corpo);
      return erro(
        503,
        "WEBHOOK NAO CONFIGURADO — cadastre o segredo em Plataforma → Empresa → Integrações",
      );
    }
  }

  if (!req.authorization && !req.segredoNaQuery) {
    avisar("autorizacao_ausente");
    if (empresa) await registrar(empresa.id, 401, "autorizacao_ausente", corpo);
    return erro(
      401,
      "AUTORIZACAO AUSENTE — envie header 'Authorization: Bearer <token>' ou parametro ?secret=<token>",
      { motivo: "autorizacao_ausente" },
    );
  }
  if (
    req.authorization &&
    auth.esquema !== "raw" &&
    auth.tokens.length === 0 &&
    !req.segredoNaQuery
  ) {
    avisar("token_header_vazio");
    if (empresa) await registrar(empresa.id, 401, "token_header_vazio", corpo);
    return erro(
      401,
      "TOKEN DO HEADER VAZIO — Authorization foi recebido sem credencial valida apos o esquema",
      { motivo: "token_header_vazio" },
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
    if (empresa) await registrar(empresa.id, 401, "token_incorreto", corpo);
    return erro(
      401,
      `TOKEN INVALIDO — valor recebido via ${origem} nao confere com o configurado`,
      {
        motivo: "token_incorreto",
        origem,
        comprimento_recebido: comprimento,
      },
    );
  }

  const cnpj = cnpjTransportadora(corpo);
  if (!cnpjTransportadoraAceito(cnpj, listaDe(empresa.parametros.cnpjs_aceitos))) {
    avisar("cnpj_nao_autorizado", { cnpjRecebido: cnpj || "(vazio)" });
    await registrar(empresa.id, 401, "cnpj_nao_autorizado", corpo, true);
    return erro(
      401,
      `CNPJ TRANSPORTADORA NAO AUTORIZADO — '${cnpj || "(vazio)"}' nao esta na allowlist`,
      { motivo: "cnpj_nao_autorizado", cnpj_recebido: cnpj },
    );
  }

  const lido = lerEventoSsw2181(corpo);
  if (lido.tipo === "falha") {
    await registrar(empresa.id, lido.status, lido.motivo, corpo, true);
    return erro(lido.status, lido.descricao);
  }

  const eventoId = await registrar(empresa.id, 200, null, corpo, true);
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

/** Corpo vazio vale como `{}` (como hoje); JSON inválido = `undefined`. */
function lerJson(texto: string): unknown {
  if (texto.trim() === "") return {};
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return undefined;
  }
}

function listaDe(valor: unknown): string[] {
  const itens = Array.isArray(valor) ? valor : typeof valor === "string" ? valor.split(",") : [];
  return itens.filter((i): i is string => typeof i === "string" && i.trim() !== "");
}
