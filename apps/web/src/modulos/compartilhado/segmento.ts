/** Classe do botão de grupo segmentado (Por emissão / Por previsão). */
export function classeDoSegmento(ativo: boolean): string {
  return (
    "rounded-[5px] px-3 py-1 text-[13px] font-semibold transition-colors " +
    (ativo ? "bg-[var(--brand)] text-white" : "text-muted-foreground hover:bg-muted")
  );
}
