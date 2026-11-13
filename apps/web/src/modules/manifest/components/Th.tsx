import { type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Th({
  direita,
  className,
  style,
  children,
}: {
  direita?: boolean | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  children?: ReactNode;
}) {
  return (
    <th
      scope="col"
      style={style}
      className={cn(
        "px-4 py-2.5 align-bottom text-[11.5px] font-semibold tracking-[0.04em] whitespace-nowrap uppercase",
        direita ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}
