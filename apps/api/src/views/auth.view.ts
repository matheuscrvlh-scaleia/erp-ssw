import { type SaidaDe } from "@erp/shared/contract";
import { type contratosAuth, type TokenEmitido } from "@erp/shared/contracts/auth";

import { type Mensagem } from "../infra/mail";
import { type AjudaDeAcesso } from "../models/auth/auth.service";

/** O corpo leva só o access token: o refresh vai no cookie httpOnly. */
export function apresentarToken(sessao: TokenEmitido): SaidaDe<typeof contratosAuth.login> {
  return { tokenAcesso: sessao.tokenAcesso, expiraEmSegundos: sessao.expiraEmSegundos };
}

/** A mesma resposta exista ou não o e-mail. */
export function apresentarPedidoDeRedefinicao(): SaidaDe<typeof contratosAuth.esqueciSenha> {
  return {
    mensagem: "Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.",
  };
}

export function apresentarAjudaDeAcesso({
  acesso,
  admins,
}: AjudaDeAcesso): SaidaDe<typeof contratosAuth.ajudaAcesso> {
  return {
    ativo: acesso.ativo,
    nome: acesso.usuario.nome,
    email: acesso.usuario.email,
    papelRotulo: acesso.papelRotulo,
    admins,
  };
}

function escaparHtml(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function html(saudacao: string, paragrafos: string[], link: string, botao: string): string {
  const corpo = paragrafos.map((p) => `<p style="margin:0 0 12px">${escaparHtml(p)}</p>`).join("");
  return `<!doctype html><html lang="pt-BR"><body style="font-family:Manrope,Arial,sans-serif;color:#1f2421;background:#f7f8f7;padding:24px">
<div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e7e6;border-radius:10px;padding:24px">
<p style="margin:0 0 12px">${escaparHtml(saudacao)}</p>${corpo}
<p style="margin:20px 0"><a href="${escaparHtml(link)}" style="background:#0f6e56;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px">${escaparHtml(botao)}</a></p>
<p style="margin:0;font-size:12px;color:#6b736e">Se você não pediu isto, ignore este e-mail.</p>
</div></body></html>`;
}

const saudacao = (nome: string | null) => (nome ? `Olá, ${nome}.` : "Olá.");

export function emailDeRedefinicao(dados: {
  para: string;
  nome: string | null;
  link: string;
}): Mensagem {
  const paragrafos = [
    "Recebemos um pedido para criar uma nova senha no Painel Logístico.",
    "O link abaixo vale por 1 hora e só pode ser usado uma vez.",
  ];
  return {
    para: dados.para,
    assunto: "Redefinir sua senha — Painel Logístico",
    texto: [saudacao(dados.nome), ...paragrafos, dados.link].join("\n\n"),
    html: html(saudacao(dados.nome), paragrafos, dados.link, "Criar nova senha"),
  };
}

/** Convite (criação de conta pelo Admin ou pela Plataforma): o link leva a criar a senha. */
export function emailDeConvite(dados: {
  para: string;
  nome: string | null;
  empresa: string;
  link: string;
  validadeHoras: number;
}): Mensagem {
  const paragrafos = [
    `Você foi convidado para o Painel Logístico da ${dados.empresa}.`,
    `Crie sua senha pelo link abaixo. Ele vale por ${dados.validadeHoras} horas e só pode ser usado uma vez.`,
  ];
  return {
    para: dados.para,
    assunto: `Convite para o Painel Logístico — ${dados.empresa}`,
    texto: [saudacao(dados.nome), ...paragrafos, dados.link].join("\n\n"),
    html: html(saudacao(dados.nome), paragrafos, dados.link, "Criar minha senha"),
  };
}
