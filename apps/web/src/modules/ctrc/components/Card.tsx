import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { Painel } from "@/components/common/Panel";

/** Painel de um grupo de campos: rótulo em caixa alta sobre o valor, em duas colunas. */
export function Cartao({
  titulo,
  icone,
  rodape,
  children,
}: {
  titulo: string;
  icone: LucideIcon;
  rodape?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Painel
      titulo={titulo}
      icone={icone}
      rodape={rodape && <p className="text-[12.5px] leading-snug">{rodape}</p>}
    >
      <dl className="grid grid-cols-2 gap-x-5 gap-y-4 px-5 py-4">{children}</dl>
    </Painel>
  );
}
