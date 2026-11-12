import { InfoTip } from "@/componentes/comum/InfoTip";

/** Título de bloco com a explicação no (i). */
export function TituloComDica({ titulo, dica }: { titulo: string; dica: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {titulo}
      <InfoTip texto={dica} />
    </span>
  );
}
