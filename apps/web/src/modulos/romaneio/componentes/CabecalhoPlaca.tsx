import { Eye, EyeOff, Lock } from "lucide-react";

/** Cabeçalho "Placas" com o olho (só para quem tem a permissão Romaneio · Ver placa). */
export function CabecalhoPlaca({
  pode,
  visivel,
  aoAlternar,
}: {
  pode: boolean;
  visivel: boolean;
  aoAlternar: () => void;
}) {
  const Olho = visivel ? EyeOff : Eye;
  return (
    <span className="inline-flex items-center gap-1">
      Placas
      {pode ? (
        <button
          type="button"
          onClick={aoAlternar}
          aria-label={visivel ? "Ocultar placas" : "Mostrar placas"}
          title={visivel ? "Ocultar placas" : "Mostrar placas"}
          className="rounded-md p-1 hover:bg-card hover:text-foreground"
        >
          <Olho className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : (
        <span title="Placa disponível só para quem tem a permissão “Romaneio · Ver placa”.">
          <Lock className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}
    </span>
  );
}
