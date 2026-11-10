import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Junta classes do Tailwind resolvendo conflitos (padrão do shadcn). */
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}
