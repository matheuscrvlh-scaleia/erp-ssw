import { useEffect, useState } from "react";

import { CaixaDeBusca } from "./CaixaDeBusca";

/**
 * Campo de texto que grava na URL após uma pausa na digitação (CTRC, nota fiscal, busca da
 * lista). Acompanha a URL quando o filtro é limpo por fora (etiqueta, "Limpar filtros").
 */
export function CampoAdiado({
  valor,
  aoMudar,
  placeholder,
  className,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [texto, setTexto] = useState(valor);
  const [daUrl, setDaUrl] = useState(valor);
  if (valor !== daUrl) {
    setDaUrl(valor);
    if (valor !== texto.trim()) setTexto(valor);
  }
  useEffect(() => {
    const limpo = texto.trim();
    if (limpo === valor) return;
    const espera = setTimeout(() => {
      aoMudar(limpo);
    }, 400);
    return () => {
      clearTimeout(espera);
    };
  }, [texto, valor, aoMudar]);
  return (
    <CaixaDeBusca
      valor={texto}
      aoMudar={setTexto}
      placeholder={placeholder}
      rotulo={placeholder.replace(/[.…]+$/, "")}
      ativo={valor !== ""}
      className={className}
    />
  );
}
