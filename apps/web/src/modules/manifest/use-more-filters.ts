import { useState } from "react";

const CHAVE_MAIS_FILTROS = "romaneio:mais-filtros";

/** "Mais filtros" aberto ou fechado: preferência do navegador (começa fechado). */
export function useMaisFiltros() {
  const [aberto, setAberto] = useState(() => {
    try {
      return window.localStorage.getItem(CHAVE_MAIS_FILTROS) === "1";
    } catch {
      return false;
    }
  });
  const alternar = () => {
    setAberto((atual) => {
      try {
        window.localStorage.setItem(CHAVE_MAIS_FILTROS, atual ? "0" : "1");
      } catch {
        // sem armazenamento: vale só nesta visita
      }
      return !atual;
    });
  };
  return { aberto, alternar };
}
