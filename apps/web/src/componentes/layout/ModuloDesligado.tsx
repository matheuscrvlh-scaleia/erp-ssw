import { mensagemModuloDesligado } from "@erp/shared/acesso/modulos";
import { Lock } from "lucide-react";

/** Aviso no lugar da tela quando o módulo dela está desligado para a empresa. */
export function ModuloDesligado({ moduloNome }: { moduloNome: string }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-[10px] border border-border/70 bg-card p-6 text-center">
      <Lock className="mx-auto mb-3 h-6 w-6 text-muted-foreground" aria-hidden />
      <h1 className="text-[16px] font-medium">Módulo não liberado</h1>
      <p className="mt-2 text-[13px] text-muted-foreground">
        {mensagemModuloDesligado([moduloNome])}
      </p>
    </div>
  );
}
