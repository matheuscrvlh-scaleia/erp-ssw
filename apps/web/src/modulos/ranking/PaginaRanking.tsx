import { Abas, ConteudoDaAba } from "@/componentes/comum/Abas";
import { SeloDosDados } from "@/modulos/ingestao-ssw/SeloDosDados";

import { RankingTabela } from "./RankingTabela";

/** origem: routes/_authenticated/ranking.tsx (sistema atual) */
export function PaginaRanking() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Ranking por Parceiro e Cidade</h1>
        <SeloDosDados />
        <p className="text-sm text-muted-foreground">
          SLA operacional por parceiro (pagador) e por cidade de destino. Clique num item para ver
          os casos que estão puxando o SLA para baixo.
        </p>
      </header>
      <Abas
        abas={[
          { valor: "parceiro", rotulo: "Parceiro" },
          { valor: "cidade", rotulo: "Cidade" },
        ]}
        padrao="parceiro"
        classeDoGrupo="w-full"
      >
        <ConteudoDaAba valor="parceiro" className="mt-4">
          <RankingTabela grupo="pagador" />
        </ConteudoDaAba>
        <ConteudoDaAba valor="cidade" className="mt-4">
          <RankingTabela grupo="cidade" />
        </ConteudoDaAba>
      </Abas>
    </div>
  );
}
