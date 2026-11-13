import { useEffect, useState } from "react";

const CHAVE_OCULTOS = "romaneio:cards-ocultos";

/**
 * "Baixado sem entrega" e "Parado sem saída" ficam ocultos por padrão, com opção de reexibir.
 * A escolha fica no navegador e vale para todas as abas.
 */
export function useCardsSecundarios() {
  const [ocultos, setOcultos] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(CHAVE_OCULTOS) === "0") setOcultos(false);
    } catch {
      // sem acesso ao armazenamento: fica o padrão (ocultos)
    }
  }, []);
  const alternar = () => {
    setOcultos((atual) => {
      try {
        window.localStorage.setItem(CHAVE_OCULTOS, atual ? "0" : "1");
      } catch {
        // sem armazenamento: vale só nesta visita
      }
      return !atual;
    });
  };
  return { ocultos, alternar };
}
