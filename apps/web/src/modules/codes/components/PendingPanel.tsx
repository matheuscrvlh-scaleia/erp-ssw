import {
  type CodigoDoAdmin,
  type LetraDeResponsavel,
  LETRAS_DE_RESPONSAVEL,
} from "@erp/shared/contracts/occurrence-codes";
import { formatarInteiro } from "@erp/shared/formatting";
import { AlertTriangle, Sparkles } from "lucide-react";
import { useState } from "react";

import { Escolha } from "@/components/common/FormFields";
import { Painel } from "@/components/common/Panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { ehLetra } from "../rules";

/** Classificação rápida de um código pendente: letra + penaliza. */
function LinhaPendente({
  codigo,
  rotulos,
  podeEditar,
  aoClassificar,
}: {
  codigo: CodigoDoAdmin;
  rotulos: Record<LetraDeResponsavel, string>;
  podeEditar: boolean;
  aoClassificar: (letra: LetraDeResponsavel, penaliza: boolean) => void;
}) {
  const [letra, setLetra] = useState<LetraDeResponsavel>(
    ehLetra(codigo.letraResponsavel) ? codigo.letraResponsavel : "F",
  );
  const [penaliza, setPenaliza] = useState(codigo.penaliza);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-[13px]">
      <span className="font-mono font-bold">#{codigo.codigo}</span>
      <span className="min-w-[160px] flex-1 truncate">{codigo.descricao}</span>
      <span className="text-[12.5px] text-muted-foreground tabular-nums">
        {formatarInteiro(codigo.frequencia30d)} em 30d
      </span>
      <Escolha
        rotulo={`Responsável do código ${String(codigo.codigo)}`}
        className="h-8 w-[220px]"
        opcoes={LETRAS_DE_RESPONSAVEL.map((l) => ({ valor: l, rotulo: `${l} — ${rotulos[l]}` }))}
        valor={letra}
        disabled={!podeEditar}
        aoMudar={(v) => {
          if (ehLetra(v)) setLetra(v);
        }}
      />
      <label className="flex items-center gap-2">
        <Checkbox
          checked={penaliza}
          disabled={!podeEditar}
          onCheckedChange={(v) => {
            setPenaliza(v === true);
          }}
        />
        Penaliza
      </label>
      <Button
        size="sm"
        disabled={!podeEditar}
        onClick={() => {
          aoClassificar(letra, penaliza);
        }}
      >
        <Sparkles aria-hidden /> Classificar
      </Button>
    </li>
  );
}

/** Códigos pendentes de classificação, com a classificação rápida de cada um. */
export function PainelDePendentes({
  pendentes,
  rotulos,
  podeEditar,
  aoClassificar,
}: {
  pendentes: readonly CodigoDoAdmin[];
  rotulos: Record<LetraDeResponsavel, string>;
  podeEditar: boolean;
  aoClassificar: (x: CodigoDoAdmin, letra: LetraDeResponsavel, penaliza: boolean) => void;
}) {
  return (
    <Painel
      titulo={
        <span className="flex items-center gap-2 text-status-warn-fg">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> Códigos pendentes — classifique
          para os números ficarem exatos
        </span>
      }
      className="border-status-warn/40 bg-status-warn-bg"
    >
      <ul className="divide-y divide-border">
        {pendentes.map((x) => (
          <LinhaPendente
            key={x.codigo}
            codigo={x}
            rotulos={rotulos}
            podeEditar={podeEditar}
            aoClassificar={(letra, penaliza) => {
              aoClassificar(x, letra, penaliza);
            }}
          />
        ))}
      </ul>
    </Painel>
  );
}
