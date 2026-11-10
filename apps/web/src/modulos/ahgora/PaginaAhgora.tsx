import { Abas, ConteudoDaAba } from "@/componentes/comum/Abas";

import { ApuracaoPonto } from "./ApuracaoPonto";
import { BatidasPorColaborador } from "./BatidasPorColaborador";

/** origem: features/ahgora/components/AhgoraScreen.tsx (sistema atual) */
export function PaginaAhgora() {
  return (
    <Abas
      abas={[
        { valor: "apuracao", rotulo: "Apuração do período" },
        { valor: "colaborador", rotulo: "Batidas por colaborador" },
      ]}
      padrao="apuracao"
      classeDoGrupo="space-y-4"
      classeDaAba="text-[12px]"
    >
      <ConteudoDaAba valor="apuracao">
        <ApuracaoPonto />
      </ConteudoDaAba>
      <ConteudoDaAba valor="colaborador">
        <BatidasPorColaborador />
      </ConteudoDaAba>
    </Abas>
  );
}
