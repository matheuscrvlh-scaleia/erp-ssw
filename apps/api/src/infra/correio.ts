import { type FastifyBaseLogger } from "fastify";
import { createTransport } from "nodemailer";

export interface Mensagem {
  para: string;
  assunto: string;
  texto: string;
  html: string;
}

export interface Correio {
  enviar(mensagem: Mensagem): Promise<void>;
}

export interface ConfigSmtp {
  host: string;
  porta: number;
  seguro: boolean;
  usuario: string | undefined;
  senha: string | undefined;
  remetente: string;
}

export function criarCorreioSmtp(config: ConfigSmtp): Correio {
  const transporte = createTransport({
    host: config.host,
    port: config.porta,
    secure: config.seguro,
    ...(config.usuario ? { auth: { user: config.usuario, pass: config.senha } } : {}),
  });
  return {
    enviar: async (m) => {
      await transporte.sendMail({
        from: config.remetente,
        to: m.para,
        subject: m.assunto,
        text: m.texto,
        html: m.html,
      });
    },
  };
}

/**
 * Desenvolvimento sem SMTP: o e-mail sai no log (com o link, para dar para testar o fluxo).
 * O boot recusa isso em produção.
 */
export function criarCorreioDeDesenvolvimento(log: FastifyBaseLogger): Correio {
  return {
    enviar: (m) => {
      log.info({ para: m.para, assunto: m.assunto, texto: m.texto }, "e-mail (desenvolvimento)");
      return Promise.resolve();
    },
  };
}
