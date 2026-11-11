import { ErroDeNegocio } from "@erp/dominio/erros";
import { type FastifyBaseLogger } from "fastify";
import { createTransport, type Transporter } from "nodemailer";

import { type FonteDaConfiguracao } from "./configuracao-da-plataforma";

export interface Mensagem {
  para: string;
  assunto: string;
  texto: string;
  html: string;
}

export interface Correio {
  enviar(mensagem: Mensagem): Promise<void>;
}

/** SMTP do Resend: usuário fixo `resend`, senha = chave da API. */
const SMTP_RESEND = { host: "smtp.resend.com", port: 465, secure: true } as const;

export const MENSAGEM_EMAIL_NAO_CONFIGURADO =
  "O envio de e-mail não está configurado. Configure em Plataforma › Integrações.";

/**
 * E-mail pelo Resend com a configuração da tela Plataforma › Integrações (lida a cada envio, com
 * o cache da fonte). Sem configuração: `semConfiguracao` (o log, em desenvolvimento) ou erro.
 */
export function criarCorreioDaPlataforma(
  fonte: FonteDaConfiguracao,
  semConfiguracao: Correio | null,
): Correio {
  let transporte: { chaveApi: string; valor: Transporter } | null = null;
  const transporteDa = (chaveApi: string) => {
    if (transporte?.chaveApi !== chaveApi) {
      transporte = {
        chaveApi,
        valor: createTransport({ ...SMTP_RESEND, auth: { user: "resend", pass: chaveApi } }),
      };
    }
    return transporte.valor;
  };
  return {
    enviar: async (m) => {
      const { email } = await fonte.obter();
      if (!email) {
        if (semConfiguracao) return semConfiguracao.enviar(m);
        throw new ErroDeNegocio("INDISPONIVEL", MENSAGEM_EMAIL_NAO_CONFIGURADO);
      }
      await transporteDa(email.chaveApi).sendMail({
        from: email.remetente,
        to: m.para,
        subject: m.assunto,
        text: m.texto,
        html: m.html,
      });
    },
  };
}

/**
 * Desenvolvimento sem e-mail configurado: a mensagem sai no log (com o link, para dar para testar
 * o fluxo). Em produção não é usado.
 */
export function criarCorreioDeDesenvolvimento(log: FastifyBaseLogger): Correio {
  return {
    enviar: (m) => {
      log.info({ para: m.para, assunto: m.assunto, texto: m.texto }, "e-mail (desenvolvimento)");
      return Promise.resolve();
    },
  };
}
