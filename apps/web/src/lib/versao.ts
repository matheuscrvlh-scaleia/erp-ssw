import { MENSAGEM_RECARREGAR } from "@erp/shared/erros";
import { toast } from "sonner";

/**
 * Depois de um deploy, a aba aberta ainda aponta para os pedaços (chunks) do build anterior, que
 * não existem mais. Cada navegador escreve a falha de um jeito.
 */
const CHUNK_OBSOLETO =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

export function ehChunkObsoleto(erro: unknown): boolean {
  return erro instanceof Error && CHUNK_OBSOLETO.test(erro.message);
}

/** Avisa uma vez, sem recarregar sozinho (recarregar em laço apagaria o que a pessoa digitou). */
function avisarVersaoNova(): void {
  toast.error(MENSAGEM_RECARREGAR, {
    id: "versao-nova",
    duration: Infinity,
    action: {
      label: "Recarregar",
      onClick: () => {
        window.location.reload();
      },
    },
  });
}

/** O Vite dispara `vite:preloadError` quando um chunk pré-carregado não existe mais. */
export function instalarAvisoDeVersao(): void {
  window.addEventListener("vite:preloadError", (evento) => {
    evento.preventDefault();
    avisarVersaoNova();
  });
}
