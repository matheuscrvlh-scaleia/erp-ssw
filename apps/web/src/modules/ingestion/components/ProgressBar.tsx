export function BarraDeProgresso({ valor, rotulo }: { valor: number; rotulo: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(valor * 100)));
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className="h-full rounded-full bg-primary motion-safe:transition-[width]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
