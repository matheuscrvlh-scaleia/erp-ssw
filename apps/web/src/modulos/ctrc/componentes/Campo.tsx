import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Um campo do cartão; `largo` ocupa as duas colunas (nomes, endereço, textos longos). */
export function Campo({
  rotulo,
  largo,
  children,
}: {
  rotulo: string;
  largo?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", largo && "col-span-2")}>
      <dt className="label-xs">{rotulo}</dt>
      <dd className="mt-1 text-[13px] break-words text-foreground">{children}</dd>
    </div>
  );
}
