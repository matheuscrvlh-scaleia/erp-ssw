import { type ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Dica no passar do mouse (e no foco, quando o filho é focável). O filho é um elemento só. */
export function ComDica({
  texto,
  lado = "top",
  children,
}: {
  texto: ReactNode;
  lado?: "top" | "bottom";
  children: ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={lado} className="max-w-[320px] text-[12px] leading-snug">
          {texto}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
