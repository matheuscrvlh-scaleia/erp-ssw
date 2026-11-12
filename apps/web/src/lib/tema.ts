import { useSyncExternalStore } from "react";

/**
 * Tema do painel. O sistema sempre começa no claro; a troca para o escuro vale enquanto a aba
 * estiver aberta (sessionStorage), então sobrevive a recarregar a página mas não a reabrir.
 */
export type Tema = "claro" | "escuro";

const CHAVE = "painel:tema";
const ouvintes = new Set<() => void>();

function temaDaSessao(): Tema {
  try {
    return window.sessionStorage.getItem(CHAVE) === "escuro" ? "escuro" : "claro";
  } catch {
    return "claro";
  }
}

function aplicar(tema: Tema): void {
  document.documentElement.classList.toggle("dark", tema === "escuro");
}

/** Chamado no main.tsx antes de montar a tela (sem piscar o tema errado). */
export function aplicarTemaSalvo(): void {
  aplicar(temaDaSessao());
}

export function definirTema(tema: Tema): void {
  try {
    window.sessionStorage.setItem(CHAVE, tema);
  } catch {
    // sem storage: vale só até recarregar
  }
  aplicar(tema);
  for (const avisar of ouvintes) avisar();
}

function assinar(avisar: () => void) {
  ouvintes.add(avisar);
  return () => {
    ouvintes.delete(avisar);
  };
}

export function useTema(): Tema {
  return useSyncExternalStore(assinar, () =>
    document.documentElement.classList.contains("dark") ? "escuro" : "claro",
  );
}
