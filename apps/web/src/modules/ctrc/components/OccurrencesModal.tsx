import { type OcorrenciaDoCtrc } from "@erp/shared/contracts/ctrc";
import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Contagem } from "./Count";
import { LinhaDoTempo } from "./Timeline";

/** Olho que abre todas as ocorrências do CT-e num modal (só leitura). */
export function ModalDeOcorrencias({
  ocorrencias,
  numero,
  fuso,
}: {
  ocorrencias: readonly OcorrenciaDoCtrc[];
  numero: string;
  fuso: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Eye aria-hidden />
          Visualizar
          <Contagem>{ocorrencias.length}</Contagem>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold">Ocorrências · CTRC {numero}</DialogTitle>
        </DialogHeader>
        <div className="rolagem-fina max-h-[60vh] overflow-y-auto rounded-xl border border-border px-4 py-4">
          <LinhaDoTempo ocorrencias={ocorrencias} fuso={fuso} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
