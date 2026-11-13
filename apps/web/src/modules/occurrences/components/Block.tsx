import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { Painel } from "@/components/common/Panel";

import { TituloComDica } from "./TitleWithHint";

/** Bloco de barras horizontais clicáveis (cada linha recorta a tela). */
export function Bloco({
  titulo,
  dica,
  icone,
  children,
}: {
  titulo: string;
  dica: string;
  icone: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Painel
      titulo={<TituloComDica titulo={titulo} dica={dica} />}
      icone={icone}
      classeDoCorpo="p-2"
    >
      <ul className="rolagem-fina max-h-[320px] space-y-1 overflow-auto">{children}</ul>
    </Painel>
  );
}
