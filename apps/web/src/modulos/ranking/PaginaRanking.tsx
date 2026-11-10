import { Aba, Abas, ConteudoDaAba, ListaDeAbas } from "./kit-local";
import { RankingTabela } from "./RankingTabela";

/** origem: routes/_authenticated/ranking.tsx (sistema atual) */
export function PaginaRanking() {
  return (
    <div className="space-y-4">
      <header>
        {/* TODO(kit-ui): SyncStatusBadge abaixo do título. */}
        <h1 className="text-2xl font-semibold">Ranking por Parceiro e Cidade</h1>
        <p className="text-sm text-muted-foreground">
          SLA operacional por parceiro (pagador) e por cidade de destino. Clique num item para ver
          os casos que estão puxando o SLA para baixo.
        </p>
      </header>
      <Abas padrao="parceiro" className="w-full">
        <div className="-mx-1 overflow-x-auto px-1">
          <ListaDeAbas>
            <Aba valor="parceiro">Parceiro</Aba>
            <Aba valor="cidade">Cidade</Aba>
          </ListaDeAbas>
        </div>
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
