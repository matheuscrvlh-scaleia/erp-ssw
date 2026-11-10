import { type ChavesDeSegredo, contextoDoSegredo, decifrarSegredo } from "@erp/db/segredos";
import { type FastifyPluginCallback, type FastifyRequest } from "fastify";

import { type ExecutorComContexto } from "../../repositorios";
import { type FilasDeIngestao } from "./casos-de-uso";
import { type EmpresaDoWebhook, type PortasDoWebhook, receberWebhook } from "./webhook";

export const CAMINHO_DO_WEBHOOK = "/api/public/ssw-ocorrencias";

/** Cadastro de empresas e segredos do webhook guardado por 60 s (como hoje). */
const CACHE_MS = 60_000;
/** O SSW manda uma ocorrência por chamada e em rajada: limite próprio, bem acima do geral. */
const LIMITE_POR_MINUTO = 6_000;

export interface OpcoesDoWebhookPublico {
  executar: ExecutorComContexto;
  filas: FilasDeIngestao | null;
  chaves: ChavesDeSegredo | null;
  agora: () => Date;
}

const PLATAFORMA = { empresaId: null, usuarioId: null, plataforma: true };
const daEmpresa = (empresaId: string) => ({ empresaId, usuarioId: null, plataforma: false });

function textoDe(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function ipDa(request: FastifyRequest): string {
  const cf = request.headers["cf-connecting-ip"];
  return (typeof cf === "string" && cf) || request.ip;
}

/**
 * Webhook SSW2181, no mesmo caminho de hoje. Sem sessão de usuário: autentica pelo segredo da
 * empresa (header `Authorization` ou `?secret=`), que nunca vai para o log (ver `infra/log.ts`).
 * origem: src/routes/api/public/ssw-ocorrencias.ts (sistema atual)
 */
export const rotasPublicasSsw: FastifyPluginCallback<OpcoesDoWebhookPublico> = (
  app,
  opcoes,
  pronto,
) => {
  let cache: { ate: number; empresas: EmpresaDoWebhook[] } | null = null;
  const portas: PortasDoWebhook = {
    empresas: async () => {
      const agora = opcoes.agora().getTime();
      if (cache && cache.ate > agora) return cache.empresas;
      const empresas = await opcoes.executar(PLATAFORMA, ({ ingestaoSsw }) =>
        ingestaoSsw.empresasComWebhook(),
      );
      cache = { ate: agora + CACHE_MS, empresas };
      return empresas;
    },
    segredo: (empresa) => {
      if (opcoes.chaves === null || empresa.segredo === null) return null;
      try {
        return decifrarSegredo(
          opcoes.chaves,
          empresa.segredo,
          contextoDoSegredo(empresa.id, "ssw_webhook"),
        );
      } catch {
        app.log.error(
          { empresaId: empresa.id },
          "segredo do webhook não decifra com as chaves atuais",
        );
        return null;
      }
    },
    registrarEvento: (evento) =>
      opcoes.executar(daEmpresa(evento.empresaId), ({ ingestaoSsw }) =>
        ingestaoSsw.registrarEvento(evento),
      ),
    marcarEvento: (empresaId, eventoId, status, erro) =>
      opcoes.executar(daEmpresa(empresaId), ({ ingestaoSsw }) =>
        ingestaoSsw.marcarEvento(eventoId, status, erro),
      ),
    filas: opcoes.filas,
    agora: opcoes.agora,
    aleatorio: Math.random,
    avisar: (dados, mensagem) => {
      app.log.warn(dados, mensagem);
    },
  };

  // O corpo chega cru: JSON inválido também é registrado e respondido no formato do SSW.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", { parseAs: "string" }, (_request, corpo, feito) => {
    feito(null, corpo);
  });

  app.get(CAMINHO_DO_WEBHOOK, async (_request, reply) => {
    void reply.header("cache-control", "no-store");
    return {
      ok: true,
      endpoint: CAMINHO_DO_WEBHOOK,
      metodo: "POST",
      mensagem:
        "Webhook SSW2181 ativo. Envie o token no header Authorization ou em ?secret=<token> na URL.",
    };
  });

  app.post(
    CAMINHO_DO_WEBHOOK,
    { config: { rateLimit: { max: LIMITE_POR_MINUTO, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const query =
        typeof request.query === "object" && request.query !== null ? request.query : {};
      const resposta = await receberWebhook(portas, {
        corpoBruto: typeof request.body === "string" ? request.body : "",
        authorization: request.headers.authorization ?? "",
        segredoNaQuery: textoDe(Reflect.get(query, "secret")),
        empresaNaQuery: textoDe(Reflect.get(query, "empresa")),
        ip: ipDa(request),
        userAgent: request.headers["user-agent"] ?? null,
      });
      void reply.header("cache-control", "no-store").code(resposta.status);
      return resposta.corpo;
    },
  );

  pronto();
};
