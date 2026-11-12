/** Número do CT-e nas tabelas (abre o detalhe pela linha). */
export function NumeroDoCtrc({ numero }: { numero: string }) {
  return <span className="font-mono text-[12.5px] font-semibold text-brand">{numero}</span>;
}
