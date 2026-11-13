import { formatarDataHora } from "@erp/shared/formatting";
import { KeyRound } from "lucide-react";
import { useState } from "react";

import { CAMPO, Campo } from "@/components/common/FormFields";
import { Button } from "@/components/ui/button";
import { useFusoDaEmpresa } from "@/hooks/use-company-timezone";

/**
 * Senha/token de uma integração: vai cifrado para o banco e o campo nunca mostra o valor gravado.
 * `aoGravar("")` remove. Usado nas integrações da empresa e nas da Plataforma.
 */
export function CampoDeSegredo({
  rotulo,
  definidoEm,
  gravando,
  aoGravar,
}: {
  rotulo: string;
  definidoEm: string | null;
  gravando: boolean;
  aoGravar: (valor: string) => Promise<boolean>;
}) {
  const fuso = useFusoDaEmpresa();
  const [segredo, setSegredo] = useState("");
  const gravar = async (valor: string) => {
    if (await aoGravar(valor)) setSegredo("");
  };
  return (
    <div className="space-y-2 rounded-xl border border-border bg-superficie p-3">
      <Campo rotulo={rotulo}>
        <input
          type="password"
          autoComplete="new-password"
          className={CAMPO}
          value={segredo}
          placeholder={definidoEm ? "•••••••• (digite para trocar)" : "Não definido"}
          onChange={(e) => {
            setSegredo(e.target.value);
          }}
        />
      </Campo>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!segredo.trim() || gravando}
          onClick={() => void gravar(segredo)}
        >
          Gravar
        </Button>
        {definidoEm && (
          <Button
            size="sm"
            variant="ghost"
            disabled={gravando}
            onClick={() => {
              if (window.confirm(`Remover ${rotulo}?`)) void gravar("");
            }}
          >
            Remover
          </Button>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5" aria-hidden />
          {definidoEm
            ? `Guardado cifrado em ${formatarDataHora(definidoEm, fuso, { virgula: true })}`
            : "Não definido."}
        </span>
      </div>
    </div>
  );
}
