import { mensagemModuloDesligado } from "@erp/shared/access/modules";
import { Lock } from "lucide-react";

/** Aviso no lugar da tela quando o módulo dela está desligado para a empresa. */
export function ModuloDesligado({ moduloNome }: { moduloNome: string }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-cartao">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />
      </span>
      <h1 className="text-[18px] font-bold">Módulo não liberado</h1>
      <p className="mt-2 text-[13.5px] text-muted-foreground">
        {mensagemModuloDesligado([moduloNome])}
      </p>
    </div>
  );
}
