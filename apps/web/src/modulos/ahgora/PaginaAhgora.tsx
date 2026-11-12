import { useState } from "react";

import { Abas } from "@/componentes/comum/Abas";

import { AbaApuracaoDoPeriodo } from "./componentes/AbaApuracaoDoPeriodo";
import { AbaBatidasPorColaborador } from "./componentes/AbaBatidasPorColaborador";

type Aba = "apuracao" | "colaborador";

/**
 * Cada aba é uma tela inteira (título, filtros e conteúdo próprios); as abas ficam no pé do
 * cabeçalho. Trocar de aba recomeça a outra, como antes.
 * origem: features/ahgora/components/AhgoraScreen.tsx (sistema atual)
 */
export function PaginaAhgora() {
  const [aba, setAba] = useState<Aba>("apuracao");
  const abas = (
    <Abas
      rotulo="Abas do ponto"
      abas={[
        { valor: "apuracao", rotulo: "Apuração do período" },
        { valor: "colaborador", rotulo: "Batidas por colaborador" },
      ]}
      valor={aba}
      aoMudar={setAba}
    />
  );
  return aba === "apuracao" ? (
    <AbaApuracaoDoPeriodo abas={abas} />
  ) : (
    <AbaBatidasPorColaborador abas={abas} />
  );
}
