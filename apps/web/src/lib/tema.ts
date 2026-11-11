import { useSyncExternalStore } from "react";

/** Tema do painel. Escolha por navegador (conveniência); sem escolha, segue o sistema. */
export type Tema = "claro" | "escuro";

const CHAVE = "painel:tema";
const ouvintes = new Set<() => void>();

function lerEscolha(): Tema | null {
  try {
    const valor = window.localStorage.getItem(CHAVE);
    return valor === "claro" || valor === "escuro" ? valor : null;
  } catch {
    return null;
  }
}

function temaAtual(): Tema {
  const escolha = lerEscolha();
  if (escolha) return escolha;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

function aplicar(tema: Tema): void {
  document.documentElement.classList.toggle("dark", tema === "escuro");
}

/** Chamado no main.tsx antes de montar a tela (sem piscar o tema errado). */
export function aplicarTemaSalvo(): void {
  aplicar(temaAtual());
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (lerEscolha()) return;
    aplicar(temaAtual());
    for (const avisar of ouvintes) avisar();
  });
}

export function definirTema(tema: Tema): void {
  try {
    window.localStorage.setItem(CHAVE, tema);
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
