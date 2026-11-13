import { type Acesso } from "@erp/shared/contracts/auth";
import { formatarData } from "@erp/shared/formatting";
import { CalendarClock } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Vencimento = Acesso["vencimentos"][number];

/** Um aviso por módulo, prazo e dia de antecedência: fechado, só volta no próximo marco. */
const chave = (empresaId: string, v: Vencimento) =>
  `aviso-vencimento:${empresaId}:${v.modulo}:${v.fim}:${String(v.dias)}`;

function jaVisto(empresaId: string, v: Vencimento): boolean {
  try {
    return window.localStorage.getItem(chave(empresaId, v)) !== null;
  } catch {
    return false;
  }
}

function marcarVisto(empresaId: string, vencimentos: readonly Vencimento[]): void {
  try {
    for (const v of vencimentos) window.localStorage.setItem(chave(empresaId, v), "1");
  } catch {
    // navegador sem storage: o aviso volta na próxima abertura
  }
}

const emDias = (dias: number) => (dias === 1 ? "amanhã" : `em ${String(dias)} dias`);

/**
 * Modal que avisa a empresa dos módulos que vencem daqui a 7, 5, 2 ou 1 dia (a sessão já traz só
 * esses). Atalho: "já visto" fica neste navegador; outro navegador mostra de novo.
 */
export function AvisoDeVencimento({
  empresaId,
  vencimentos,
}: {
  empresaId: string;
  vencimentos: readonly Vencimento[];
}) {
  const [pendentes, setPendentes] = useState(() =>
    vencimentos.filter((v) => !jaVisto(empresaId, v)),
  );
  const fechar = () => {
    marcarVisto(empresaId, pendentes);
    setPendentes([]);
  };
  if (pendentes.length === 0) return null;
  const um = pendentes.length === 1 ? pendentes[0] : null;

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto) fechar();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock aria-hidden className="size-5 text-status-warn-fg" />
            {um ? `O módulo ${um.moduloNome} vence ${emDias(um.dias)}` : "Módulos perto de vencer"}
          </DialogTitle>
          <DialogDescription>
            Depois do vencimento, as telas do módulo saem do menu. Para renovar, fale com o suporte.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-[13px]">
          {pendentes.map((v) => (
            <li
              key={v.modulo}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <span className="font-semibold">{v.moduloNome}</span>
              <span className="text-muted-foreground tabular-nums">
                {emDias(v.dias)} · último dia {formatarData(v.fim)}
              </span>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button onClick={fechar}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
