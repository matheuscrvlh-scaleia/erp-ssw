import { type Mensagem } from "../../infra/correio";

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
