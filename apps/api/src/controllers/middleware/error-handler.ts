import { ehTempoEsgotado, ehViolacaoDeUnicidade } from "@erp/db";
import { ErroDeNegocio } from "@erp/domain/errors";
import {
  type CodigoErro,
  type ErroPadrao,
  MENSAGEM_ERRO_INTERNO,
  MENSAGEM_TEMPO_ESGOTADO,
  STATUS_DO_CODIGO,
} from "@erp/shared/errors";
import { type FastifyError, type FastifyInstance, type FastifyReply } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";

function responder(reply: FastifyReply, codigo: CodigoErro, mensagem: string) {
  const corpo: ErroPadrao = { erro: { codigo, mensagem } };
  return reply.status(STATUS_DO_CODIGO[codigo]).send(corpo);
}

/** Primeiro problema, com o campo: "descricao: Pequeno demais: esperava…". */
function mensagemDeValidacao(validacao: readonly { instancePath: string; message?: string }[]) {
  const [primeiro] = validacao;
  if (!primeiro) return "Dados inválidos.";
  const campo = primeiro.instancePath.replace(/^\//, "").replaceAll("/", ".");
  const mensagem = primeiro.message ?? "valor inválido";
  return campo ? `${campo}: ${mensagem}` : mensagem;
}

/**
 * Toda resposta de erro sai no formato padrão, sem detalhe interno. Erro esperado
 * (`ErroDeNegocio`) vai com a mensagem dele; timeout de consulta pede para filtrar mais; o resto
 * vira "erro interno" e só o log tem o detalhe.
 */
export function registrarTratadorDeErros(app: FastifyInstance): void {
  app.setErrorHandler((erro: FastifyError, request, reply) => {
    if (erro instanceof ErroDeNegocio) return responder(reply, erro.codigo, erro.message);
    if (hasZodFastifySchemaValidationErrors(erro)) {
      return responder(reply, "ENTRADA_INVALIDA", mensagemDeValidacao(erro.validation));
    }
    if (ehTempoEsgotado(erro)) {
      request.log.warn({ err: erro }, "consulta cancelada por tempo");
      return responder(reply, "TEMPO_ESGOTADO", MENSAGEM_TEMPO_ESGOTADO);
    }
    if (ehViolacaoDeUnicidade(erro)) {
      return responder(reply, "CONFLITO", "Já existe um registro igual a este.");
    }
    if (erro.statusCode === 413) {
      return responder(reply, "ENTRADA_INVALIDA", "Conteúdo grande demais.");
    }
    if (erro.statusCode !== undefined && erro.statusCode >= 400 && erro.statusCode < 500) {
      return responder(reply, "ENTRADA_INVALIDA", "Requisição inválida.");
    }
    request.log.error({ err: erro }, "erro não tratado");
    return responder(reply, "ERRO_INTERNO", MENSAGEM_ERRO_INTERNO);
  });

  app.setNotFoundHandler((_request, reply) =>
    responder(reply, "NAO_ENCONTRADO", "Rota não encontrada."),
  );
}
