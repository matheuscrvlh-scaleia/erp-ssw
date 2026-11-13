import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export function AlternarCardsSecundarios({
  ocultos,
  quantos,
  aoClicar,
}: {
  ocultos: boolean;
  quantos: number;
  aoClicar: () => void;
}) {
  const Icone = ocultos ? Eye : EyeOff;
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={aoClicar}
      className="h-auto min-h-8 text-[12.5px] font-medium whitespace-normal text-muted-foreground hover:text-foreground"
    >
      <Icone aria-hidden />
      {ocultos
        ? `Mostrar ${quantos === 1 ? "card oculto" : `${quantos} cards ocultos`} (Baixado sem entrega${quantos > 1 ? ", Parado sem saída" : ""})`
        : "Ocultar Baixado sem entrega e Parado sem saída"}
    </Button>
  );
}
