import { cn } from "@/lib/utils";

export function AreaDeTexto(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-[120px] w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs text-foreground shadow-cartao placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        props.className,
      )}
    />
  );
}
