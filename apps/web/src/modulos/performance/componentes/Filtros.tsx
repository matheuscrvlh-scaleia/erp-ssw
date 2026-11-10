import { Search } from "lucide-react";
import { useState } from "react";

import { Input } from "@/componentes/ui/input";

/** Busca de documento (CTRC, NF): Enter abre a Listagem detalhada com o número digitado. */
export function BuscaDocumento({
  placeholder,
  onBuscar,
}: {
  placeholder: string;
  onBuscar: (v: string) => void;
}) {
  const [valor, setValor] = useState("");
  return (
    <span className="relative inline-flex w-[150px] items-center">
      <Search className="absolute left-2 h-3 w-3 text-muted-foreground" />
      <Input
        value={valor}
        placeholder={placeholder}
        className="h-7 pl-6 text-[12px]"
        onChange={(e) => {
          setValor(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && valor.trim()) onBuscar(valor.trim());
        }}
      />
    </span>
  );
}
