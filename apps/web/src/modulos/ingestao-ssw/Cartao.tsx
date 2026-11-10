import { type ReactNode } from "react";

import { Badge } from "@/componentes/ui/badge";

/** Card das telas de integração (mesmo desenho dos cards de hoje). */
export function Cartao({
  titulo,
  icone,
  direita,
  children,
}: {
  titulo: string;
  icone: ReactNode;
  direita?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[10px] border border-border/70 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2 text-[13px] font-medium">
        <h2 className="flex items-center gap-2">
          {icone} {titulo}
        </h2>
        {direita && <div className="text-[11px] font-normal text-muted-foreground">{direita}</div>}
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

type SituacaoDoEvento = "processado" | "sem_vinculo" | "rejeitado" | "erro";

/** Mesma classificação dos contadores do diagnóstico (rejeitado = auth/4xx; erro = 5xx). */
export function situacaoDoEvento(e: {
  statusHttp: number;
  autenticado: boolean;
}): SituacaoDoEvento {
  if (!e.autenticado || (e.statusHttp >= 400 && e.statusHttp < 500)) return "rejeitado";
  if (e.statusHttp >= 500) return "erro";
  if (e.statusHttp === 202) return "sem_vinculo";
  return "processado";
}

const SELO: Record<
  SituacaoDoEvento,
  { rotulo: string; variante: "default" | "secondary" | "destructive" | "outline" }
> = {
  processado: { rotulo: "processado", variante: "default" },
  sem_vinculo: { rotulo: "sem vínculo", variante: "outline" },
  rejeitado: { rotulo: "rejeitado", variante: "secondary" },
  erro: { rotulo: "erro", variante: "destructive" },
};

export function SeloDoEvento({ situacao }: { situacao: SituacaoDoEvento }) {
  const s = SELO[situacao];
  return <Badge variant={s.variante}>{s.rotulo}</Badge>;
}
