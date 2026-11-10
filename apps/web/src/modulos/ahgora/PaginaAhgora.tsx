// TODO(kit-ui): Tabs do kit comum.
import { Aba, Abas, ConteudoDaAba, ListaDeAbas } from "../ranking/kit-local";
import { ApuracaoPonto } from "./ApuracaoPonto";
import { BatidasPorColaborador } from "./BatidasPorColaborador";

/** origem: features/ahgora/components/AhgoraScreen.tsx (sistema atual) */
export function PaginaAhgora() {
  return (
    <Abas padrao="apuracao" className="space-y-4">
      <ListaDeAbas>
        <Aba valor="apuracao" className="text-[12px]">
          Apuração do período
        </Aba>
        <Aba valor="colaborador" className="text-[12px]">
          Batidas por colaborador
        </Aba>
      </ListaDeAbas>
      <ConteudoDaAba valor="apuracao">
        <ApuracaoPonto />
      </ConteudoDaAba>
      <ConteudoDaAba valor="colaborador">
        <BatidasPorColaborador />
      </ConteudoDaAba>
    </Abas>
  );
}
