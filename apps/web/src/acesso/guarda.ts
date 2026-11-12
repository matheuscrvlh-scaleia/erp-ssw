import { destinoInterno } from "@erp/shared/acesso/destino";
import { CAMINHO_DA_TELA, type Tela, telaDoCaminho } from "@erp/shared/acesso/telas";
import { type Acesso } from "@erp/shared/contratos/auth";

import { atende, hubDoCaminho, type Requisito } from "./navegacao";

type DecisaoDaGuarda =
  | { tipo: "liberado" }
  | { tipo: "modulo_desligado"; moduloNome: string }
  | { tipo: "redirecionar"; para: string };

const LIBERADO: DecisaoDaGuarda = { tipo: "liberado" };

/** Telas que também abrem a página de outra: Usuários e cargos tem a aba Cargos. */
const TAMBEM_ABREM: Partial<Record<Tela, readonly Tela[]>> = { admin_usuarios: ["admin_roles"] };

/**
 * Guarda de rota do front (docs/regras/05 §1.9). Caminho sem tela (ex.: `/`) fica liberado; tela
 * de módulo desligado mostra o aviso no lugar; tela sem permissão leva à primeira tela do usuário
 * (`telas[0]`, como hoje). Tela com abas (hub) abre se o usuário vê pelo menos uma aba. A API
 * confere de novo em cada chamada.
 */
export function decidirAcesso(
  acesso: Pick<Acesso, "ativo" | "telas" | "telasBloqueadas" | "adminPlataforma">,
  caminho: string,
): DecisaoDaGuarda {
  if (caminho === "/sem-acesso") return LIBERADO;
  if (!acesso.ativo) return { tipo: "redirecionar", para: "/sem-acesso" };
  const hub = hubDoCaminho(caminho);
  const tela = telaDoCaminho(caminho);
  const requisitos: Requisito[] = hub
    ? hub.abas.map((a) => a.requisito)
    : tela
      ? [tela, ...(TAMBEM_ABREM[tela] ?? [])]
      : [];
  if (requisitos.length === 0 || requisitos.some((r) => atende(acesso, r))) return LIBERADO;
  const bloqueio = acesso.telasBloqueadas.find((b) => requisitos.includes(b.tela));
  if (bloqueio) return { tipo: "modulo_desligado", moduloNome: bloqueio.moduloNome };
  const primeira = acesso.telas[0];
  return { tipo: "redirecionar", para: primeira ? CAMINHO_DA_TELA[primeira] : "/sem-acesso" };
}

/**
 * Só caminho interno da mesma origem: `//outro.site`, `/\t/outro.site` ou URL absoluta no
 * `?redirect=` viraria open redirect.
 */
export function destinoSeguro(destino: string | undefined): string {
  return destinoInterno(destino, window.location.origin);
}
