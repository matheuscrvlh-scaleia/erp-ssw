/** Classe do botão de grupo segmentado (Por emissão / Por previsão). */
export function classeDoSegmento(ativo: boolean): string {
  return (
    "rounded-md px-3 py-1 text-[13px] font-medium transition-colors " +
    (ativo
      ? "bg-primary text-primary-foreground shadow-cartao"
      : "text-muted-foreground hover:bg-muted hover:text-foreground")
  );
}
