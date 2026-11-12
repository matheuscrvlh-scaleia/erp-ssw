import { EtiquetaDoTipo } from "@/componentes/comum/EtiquetaDoTipo";

export function Legenda() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <EtiquetaDoTipo tipo="nacional" />
      <EtiquetaDoTipo tipo="estadual" />
      <EtiquetaDoTipo tipo="municipal" />
    </div>
  );
}
