import { Children, type CSSProperties, type ReactNode } from "react";

/**
 * Grade de indicadores em linhas iguais (8 = 4 + 4, 9 = 3 + 3 + 3): nenhum card sozinho na linha.
 * Conta só os filhos que de fato aparecem.
 */
export function GradeDeIndicadores({ max = 4, children }: { max?: number; children: ReactNode }) {
  const n = Math.max(1, Children.toArray(children).length);
  const colunas = (limite: number) => Math.ceil(n / Math.ceil(n / limite));
  const estilo: CSSProperties & Record<"--cols-sm" | "--cols-xl", number> = {
    "--cols-sm": colunas(2),
    "--cols-xl": colunas(max),
  };
  return (
    <div
      className="grid gap-4 sm:[grid-template-columns:repeat(var(--cols-sm),minmax(0,1fr))] xl:[grid-template-columns:repeat(var(--cols-xl),minmax(0,1fr))]"
      style={estilo}
    >
      {children}
    </div>
  );
}
