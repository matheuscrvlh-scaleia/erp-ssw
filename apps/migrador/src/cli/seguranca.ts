import { ErroDeUso } from "./argumentos";

/** Projeto Supabase de produção (CLAUDE.md): nunca é alvo sem confirmação explícita. */
export const PROJETO_DE_PRODUCAO = "quyrhwmfbqikkpmiivuq";

/**
 * O projeto aparece no host (`db.<ref>.supabase.co`) ou, no pooler, no usuário
 * (`postgres.<ref>@aws-0-...pooler.supabase.com`). Conexão que não se deixa ler como URL é
 * comparada como texto: na dúvida, conta como produção.
 */
export function apontaParaProducao(url: string): boolean {
  try {
    const u = new URL(url);
    const partes = [u.hostname, decodeURIComponent(u.username), u.pathname, u.search];
    return partes.some((p) => p.toLowerCase().includes(PROJETO_DE_PRODUCAO));
  } catch {
    return url.toLowerCase().includes(PROJETO_DE_PRODUCAO);
  }
}

export function verificarAlvos(urls: readonly string[], confirmarProducao: boolean): void {
  if (urls.some(apontaParaProducao) && !confirmarProducao) {
    throw new ErroDeUso(
      "A conexão aponta para o banco de PRODUÇÃO. Recusado. Use o DEVELOP; se for mesmo a " +
        "virada, rode de novo com --confirmar-producao.",
    );
  }
}

/** Para log e relatório: host, porta e banco. Nunca usuário nem senha. */
export function descreverConexao(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}`;
  } catch {
    return "(conexão em formato não-URL)";
  }
}
