import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { AreaDeTexto } from "./TextArea";

/**
 * Confirmação de ação perigosa: título com a pergunta, consequência na descrição, botão
 * destrutivo com o verbo da ação. `motivo` pede um texto obrigatório antes de confirmar.
 */
export function ConfirmarAcao({
  aberto,
  aoMudarAberto,
  titulo,
  descricao,
  rotuloDoBotao,
  motivo,
  aoConfirmar,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  titulo: ReactNode;
  descricao: ReactNode;
  rotuloDoBotao: string;
  /** Rótulo do campo de motivo (obrigatório quando informado). */
  motivo?: string | undefined;
  aoConfirmar: (motivo: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const podeConfirmar = motivo === undefined || texto.trim() !== "";
  const fechar = (v: boolean) => {
    if (!v) setTexto("");
    aoMudarAberto(v);
  };
  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogContent className="max-w-md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!podeConfirmar) return;
            aoConfirmar(texto.trim());
            fechar(false);
          }}
        >
          <DialogHeader>
            <DialogTitle className="pr-6 text-[16px] font-bold">{titulo}</DialogTitle>
            <DialogDescription className="text-[13px]">{descricao}</DialogDescription>
          </DialogHeader>
          {motivo !== undefined && (
            <label className="block space-y-1.5 text-[13px] font-medium text-foreground">
              {motivo}
              <AreaDeTexto
                autoFocus
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                }}
                maxLength={500}
                className="min-h-[88px] font-sans text-[13px]"
              />
            </label>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                fechar(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" size="sm" disabled={!podeConfirmar}>
              {rotuloDoBotao}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
