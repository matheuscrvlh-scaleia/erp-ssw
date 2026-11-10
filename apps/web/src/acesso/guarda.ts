import { CAMINHO_DA_TELA, telaDoCaminho } from "@erp/shared/acesso/telas";
import { type Acesso } from "@erp/shared/contratos/auth";

export type DecisaoDaGuarda =
  | { tipo: "liberado" }
  | { tipo: "modulo_desligado"; moduloNome: string }
  | { tipo: "redirecionar"; para: string };

const LIBERADO: DecisaoDaGuarda = { tipo: "liberado" };

/**
 * Guarda de rota do front (docs/regras/05 §1.9). Caminho sem tela (ex.: `/`) fica liberado; tela
 * de módulo desligado mostra o aviso no lugar; tela sem permissão leva à primeira tela do usuário
 * (`telas[0]`, como hoje). A API confere de novo em cada chamada.
 */
export function decidirAcesso(
  acesso: Pick<Acesso, "ativo" | "telas" | "telasBloqueadas">,
  caminho: string,
): DecisaoDaGuarda {
  if (caminho === "/sem-acesso") return LIBERADO;
  if (!acesso.ativo) return { tipo: "redirecionar", para: "/sem-acesso" };
  const tela = telaDoCaminho(caminho);
  if (!tela || acesso.telas.includes(tela)) return LIBERADO;
  const bloqueio = acesso.telasBloqueadas.find((b) => b.tela === tela);
  if (bloqueio) return { tipo: "modulo_desligado", moduloNome: bloqueio.moduloNome };
  const primeira = acesso.telas[0];
  return { tipo: "redirecionar", para: primeira ? CAMINHO_DA_TELA[primeira] : "/sem-acesso" };
}

/** Só caminho interno: `//outro.site` ou URL absoluta no `?redirect=` viraria open redirect. */
export function destinoSeguro(destino: string | undefined): string {
  return destino && /^\/(?![/\\])/.test(destino) ? destino : "/";
}
