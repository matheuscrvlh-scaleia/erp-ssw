import { INATIVIDADE_MAXIMA_MS, RENOVAR_COM_USO_A_CADA_MS } from "@erp/dominio/autenticacao";
import { useEffect } from "react";

import { momentoDoUltimoToken, renovarSessao } from "@/lib/api";

/** Última interação, compartilhada entre as abas: mexer em uma mantém todas abertas. */
const CHAVE = "painel:ultima-atividade";
const EVENTOS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
const GRAVAR_NO_MAXIMO_A_CADA_MS = 15_000;
const CONFERIR_A_CADA_MS = 30_000;

function lerAtividadeDasAbas(): number {
  try {
    return Number(window.localStorage.getItem(CHAVE)) || 0;
  } catch {
    return 0;
  }
}

function gravarAtividade(momento: number): void {
  try {
    window.localStorage.setItem(CHAVE, String(momento));
  } catch {
    // sem storage: vale só a atividade desta aba
  }
}

/**
 * Sessão cai após 30 min sem uso do painel. Com uso, renova o token a cada 10 min, porque a API
 * também derruba a sessão que passa 30 min sem renovar (cobre o navegador fechado).
 * `aoEncerrar` deve ser estável (useCallback).
 */
export function useEncerrarPorInatividade(aoEncerrar: () => void): void {
  useEffect(() => {
    let ultima = Date.now();
    let encerrado = false;
    gravarAtividade(ultima);

    const aoUsar = () => {
      const agora = Date.now();
      if (agora - ultima < GRAVAR_NO_MAXIMO_A_CADA_MS) return;
      ultima = agora;
      gravarAtividade(agora);
      // Falha aqui não importa: a próxima chamada que tomar 401 tenta de novo.
      if (agora - momentoDoUltimoToken() > RENOVAR_COM_USO_A_CADA_MS) {
        renovarSessao().catch(() => undefined);
      }
    };
    const conferir = () => {
      const parado = Date.now() - Math.max(ultima, lerAtividadeDasAbas());
      if (encerrado || parado <= INATIVIDADE_MAXIMA_MS) return;
      encerrado = true;
      aoEncerrar();
    };

    for (const evento of EVENTOS) window.addEventListener(evento, aoUsar, { passive: true });
    const relogio = window.setInterval(conferir, CONFERIR_A_CADA_MS);
    return () => {
      for (const evento of EVENTOS) window.removeEventListener(evento, aoUsar);
      window.clearInterval(relogio);
    };
  }, [aoEncerrar]);
}
