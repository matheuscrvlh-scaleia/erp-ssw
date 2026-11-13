import { type LucideIcon, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { CLASSE_DO_TOM, ICONE_DO_TOM, type Tom } from "./StatusBadge";

type PropsDoAviso = {
  tom: Exclude<Tom, "neutro">;
  titulo?: ReactNode;
  icone?: LucideIcon | undefined;
  /** Botão ou link (ex.: "Abrir configuração"). */
  acao?: ReactNode;
  children?: ReactNode;
};

/**
 * Aviso da tela (alerta, erro, informação, sucesso). Não ocupa a página: vira notificação no canto
 * inferior direito enquanto o componente estiver montado (sai junto com a condição que o mostrou).
 * Erro e alerta ficam até fechar; informação e sucesso somem em 8 s. Fechado, não volta enquanto
 * a tela estiver aberta.
 */
export function Aviso(props: PropsDoAviso) {
  const id = useId();
  const fechado = useRef(false);
  const fixo = props.tom === "erro" || props.tom === "alerta";

  // Sem dependências de propósito: título e texto são ReactNode; atualiza a mesma notificação.
  useEffect(() => {
    if (fechado.current) return;
    toast.custom(
      () => (
        <CartaoDoAviso
          {...props}
          aoFechar={() => {
            fechado.current = true;
            toast.dismiss(id);
          }}
        />
      ),
      {
        id,
        duration: fixo ? Infinity : 8000,
        onAutoClose: () => {
          fechado.current = true;
        },
      },
    );
  });
  useEffect(
    () => () => {
      toast.dismiss(id);
    },
    [id],
  );
  return null;
}

function CartaoDoAviso({
  tom,
  titulo,
  icone,
  acao,
  children,
  aoFechar,
}: PropsDoAviso & { aoFechar: () => void }) {
  const Icone = icone ?? ICONE_DO_TOM[tom];
  return (
    <div
      role={tom === "erro" ? "alert" : "status"}
      className="relative flex w-[min(380px,calc(100vw-2rem))] items-start gap-3 rounded-xl border bg-card py-3 pr-9 pl-4 text-[13px] text-foreground shadow-flutuante"
    >
      <span
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
          CLASSE_DO_TOM[tom],
        )}
      >
        <Icone className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && (
          <div className={cn(titulo && "mt-0.5", "text-muted-foreground")}>{children}</div>
        )}
        {acao && <div className="mt-2.5">{acao}</div>}
      </div>
      <button
        type="button"
        onClick={aoFechar}
        aria-label="Fechar aviso"
        className="absolute top-2.5 right-2.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
