import { Button } from "@/components/ui/button";

/** "Anterior" e "Próxima" das listas paginadas; quem usa põe o "Página X de Y" e o espaçamento. */
export function BotoesDePagina({
  pagina,
  totalDePaginas,
  aoMudar,
  desabilitado = false,
  className,
}: {
  /** Página atual, a partir de 1. */
  pagina: number;
  totalDePaginas: number;
  aoMudar: (pagina: number) => void;
  /** Ex.: enquanto a lista carrega. */
  desabilitado?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={className}
        disabled={desabilitado || pagina <= 1}
        onClick={() => {
          aoMudar(Math.max(1, pagina - 1));
        }}
      >
        Anterior
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={className}
        disabled={desabilitado || pagina >= totalDePaginas}
        onClick={() => {
          aoMudar(Math.min(totalDePaginas, pagina + 1));
        }}
      >
        Próxima
      </Button>
    </>
  );
}
