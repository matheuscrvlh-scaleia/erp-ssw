import { useEffect, useState } from "react";

/** Busca de documento (CT-e, NF): só vale ao confirmar (Enter ou sair do campo). */
export function CampoDeTexto({
  valor,
  aoConfirmar,
  placeholder,
  rotulo,
  largura = "w-[150px]",
}: {
  valor: string;
  aoConfirmar: (v: string) => void;
  placeholder: string;
  rotulo: string;
  largura?: string;
}) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => {
    setTexto(valor);
  }, [valor]);
  const confirmar = () => {
    if (texto.trim() !== valor.trim()) aoConfirmar(texto.trim());
  };
  return (
    <input
      aria-label={rotulo}
      value={texto}
      placeholder={placeholder}
      onChange={(e) => {
        setTexto(e.target.value);
      }}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === "Enter") confirmar();
      }}
      className={`${largura} h-7 rounded-md border border-border/70 bg-card px-2 text-[13px]`}
    />
  );
}

/** Classe do botão de grupo segmentado (Por emissão / Por previsão). */
export function classeDoSegmento(ativo: boolean): string {
  return (
    "rounded-[5px] px-3 py-1 text-[13px] font-semibold transition-colors " +
    (ativo ? "bg-[var(--brand)] text-white" : "text-muted-foreground hover:bg-muted")
  );
}
