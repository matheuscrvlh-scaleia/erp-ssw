import { formatarInteiro, formatarMoeda } from "@erp/shared/formatacao";

/** Dica do gráfico de prejuízo: dia/hora, frete e quantidade de cargas. */
export function DicaDoPrejuizo({
  titulo,
  frete,
  ctes,
}: {
  titulo: string;
  frete: number;
  ctes: number;
}) {
  return (
    <>
      <div className="label-xs mb-1.5">{titulo}</div>
      <div className="flex items-center gap-2 tabular-nums">
        <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-status-bad" />
        <strong className="font-semibold text-foreground">
          {formatarMoeda(frete, { centavos: false })}
        </strong>
        <span className="text-muted-foreground">· {formatarInteiro(ctes)} carga(s)</span>
      </div>
    </>
  );
}
