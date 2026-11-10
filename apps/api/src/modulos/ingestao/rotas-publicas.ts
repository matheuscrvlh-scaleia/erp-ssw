/**
 * Rotas públicas da ingestão SSW, nos mesmos caminhos de hoje (spec 06 §6). Sem sessão: segredo
 * por cabeçalho comparado em tempo constante; nunca a chave publicável. Q46 b: as rotas 410
 * (`ftp-xml-import`, `ssw-ingest`, `enriquecer-*`) não são recriadas; `xml-recuperar-orfaos` é
 * código morto (§9).
 */
import { createHash, timingSafeEqual } from "node:crypto";

import {
  decidirEmpresa,
  LIMITE_PADRAO_DOS_ORFAOS,
  receberArquivo,
  reprocessarOrfaos,
  sha256,
  type TipoIntegracao,
} from "@erp/ingestao/casos-de-uso";
import { filaDoJob, idDeExecucao } from "@erp/shared/ingestao";
import { z } from "@erp/shared/zod";
import { type FastifyReply, type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { type ServicosDaIngestao } from "./servicos";

/** Arquivos em base64 (455 CSV chega dividido, mas a parte retroativa pode vir inteira). */
const LIMITE_COM_ARQUIVO = 64 * 1024 * 1024;
const LIMITE_SEM_ARQUIVO = 1024 * 1024;

/** Compara em tempo constante (resumo de tamanho fixo: não vaza o tamanho do segredo). */
export function segredoConfere(recebido: string | undefined, esperado: string | null): boolean {
  if (!recebido || !esperado) return false;
  const a = createHash("sha256").update(recebido).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}

const cabecalho = (request: FastifyRequest, nome: string) => {
  const v = request.headers[nome];
  return Array.isArray(v) ? v[0] : v;
};

const corpoComEmpresa = z
  .object({ empresa: z.string().optional(), empresa_id: z.string().optional() })
  .loose();

function empresaPedida(
  request: FastifyRequest,
  corpo: { empresa?: string | undefined; empresa_id?: string | undefined },
) {
  const query = request.query as Record<string, unknown> | undefined;
  const daQuery = typeof query?.empresa === "string" ? query.empresa : undefined;
  return (
    [daQuery, cabecalho(request, "x-empresa"), corpo.empresa, corpo.empresa_id].find(
      (v) => v !== undefined && v.trim() !== "",
    ) ?? null
  );
}

const erro = (reply: FastifyReply, status: number, motivo: string, mensagem: string) =>
  reply.status(status).send({ ok: false, motivo, erro: mensagem });

export const rotasPublicasDaIngestao: FastifyPluginCallbackZod<{
  servicos: ServicosDaIngestao;
  agora: () => Date;
}> = (app, { servicos, agora }, pronto) => {
  /** Segredo do FTP (ou também o token do cron); devolve `false` se já respondeu o erro. */
  async function autorizado(request: FastifyRequest, reply: FastifyReply, aceitaCron: boolean) {
    const segredoFtp = cabecalho(request, "x-ftp-ingest-secret");
    if (segredoConfere(segredoFtp, servicos.segredoDoFtp)) return true;
    if (
      aceitaCron &&
      segredoConfere(cabecalho(request, "x-cron-token"), await servicos.tokenDoCron())
    ) {
      return true;
    }
    if (!servicos.segredoDoFtp && !aceitaCron) {
      await erro(reply, 503, "ingest_secret_nao_configurado", "FTP_INGEST_SECRET não configurado.");
    } else {
      await erro(reply, 401, "token_invalido", "Segredo ausente ou inválido.");
    }
    return false;
  }

  async function empresaDe(
    request: FastifyRequest,
    reply: FastifyReply,
    tipo: TipoIntegracao,
    corpo: z.infer<typeof corpoComEmpresa>,
  ) {
    const d = decidirEmpresa(
      empresaPedida(request, corpo),
      tipo,
      await servicos.empresasParaIngestao(),
    );
    if (!d.ok) {
      await erro(reply, d.status, d.motivo, d.erro);
      return null;
    }
    return d.empresa.id;
  }

  const limite = (max: number) => ({ rateLimit: { max, timeWindow: "1 minute" } });

  app.post(
    "/api/public/ftp-relatorio-import",
    {
      bodyLimit: LIMITE_COM_ARQUIVO,
      config: limite(240),
      schema: {
        body: corpoComEmpresa.extend({
          nome: z.string().optional(),
          base64: z.string().optional(),
          sha256: z.string().optional(),
          tamanho: z.number().optional(),
          mtime: z.number().optional(),
        }),
      },
    },
    async (request, reply) => {
      if (!(await autorizado(request, reply, false))) return reply;
      const corpo = request.body;
      if (!corpo.nome || !corpo.base64) {
        return erro(reply, 400, "nome_ou_base64_ausentes", "Informe nome e base64 do arquivo.");
      }
      const texto = corpo.base64.includes(",")
        ? (corpo.base64.split(",", 2)[1] ?? "")
        : corpo.base64;
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(texto.replace(/\s/g, ""))) {
        return erro(reply, 400, "base64_invalido", "Conteúdo base64 inválido.");
      }
      const empresaId = await empresaDe(request, reply, "sftp", corpo);
      if (!empresaId) return reply;
      const bytes = new Uint8Array(Buffer.from(texto, "base64"));
      try {
        return await receberArquivo(
          {
            empresaId,
            executar: servicos.executarNaEmpresa(empresaId, null),
            enfileirador: servicos.enfileirador,
          },
          {
            nome: corpo.nome,
            bytes,
            sha256: corpo.sha256 ?? sha256(bytes),
            tamanho: corpo.tamanho ?? bytes.length,
            mtime: corpo.mtime ?? 0,
          },
        );
      } catch (e) {
        request.log.error({ err: e }, "ftp-relatorio-import");
        return erro(reply, 500, "excecao_no_pipeline", e instanceof Error ? e.message : String(e));
      }
    },
  );

  app.post(
    "/api/public/ssw-ciclo-aplicar",
    {
      bodyLimit: LIMITE_SEM_ARQUIVO,
      config: limite(120),
      schema: { body: corpoComEmpresa.optional() },
    },
    async (request, reply) => {
      if (!(await autorizado(request, reply, true))) return reply;
      const empresaId = await empresaDe(request, reply, "sftp", request.body ?? {});
      if (!empresaId) return reply;
      // O ciclo roda no worker (singleton por empresa); a rota só pede a rodada.
      await servicos.enfileirador.enfileirar(
        filaDoJob("aplicar-ciclos"),
        "aplicar-ciclos",
        { empresaId },
        { deduplicacao: idDeExecucao("aplicar-ciclos", empresaId) },
      );
      return { ok: true, status: "enfileirado", resultados: [] };
    },
  );

  app.post(
    "/api/public/xml-orfaos-retry",
    {
      bodyLimit: LIMITE_SEM_ARQUIVO,
      config: limite(30),
      schema: {
        body: corpoComEmpresa
          .extend({ limite: z.number().int().min(1).max(1000).optional() })
          .optional(),
      },
    },
    async (request, reply) => {
      if (!(await autorizado(request, reply, true))) return reply;
      const corpo = request.body ?? {};
      const empresaId = await empresaDe(request, reply, "xml_cte", corpo);
      if (!empresaId) return reply;
      const r = await reprocessarOrfaos(
        servicos.executarNaEmpresa(empresaId, null),
        corpo.limite ?? LIMITE_PADRAO_DOS_ORFAOS,
        agora(),
      );
      return { ok: true, ...r };
    },
  );

  pronto();
};
