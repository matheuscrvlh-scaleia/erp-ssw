import { type ReactNode } from "react";

export function Contagem({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-[12px] font-semibold text-muted-foreground tabular-nums">
      {children}
    </span>
  );
}
