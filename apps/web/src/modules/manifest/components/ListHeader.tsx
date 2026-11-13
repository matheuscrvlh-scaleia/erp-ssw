import { type OrdemLista } from "@erp/shared/contracts/manifest";

import { Checkbox } from "@/components/ui/checkbox";

import { Cabecalho } from "./Header";
import { ThOrdenavel } from "./SortableTh";
import { Th } from "./Th";

/** Cabeçalho da tabela da aba Total: colunas ordenáveis e a caixa que marca a lista inteira. */
export function CabecalhoDaLista({
  ordem,
  cabecalho,
  aoAlternarTodas,
  semLinhas,
}: {
  ordem: { ordem: OrdemLista | undefined; dir: "asc" | "desc"; aoOrdenar: (c: OrdemLista) => void };
  cabecalho: boolean | "indeterminate";
  aoAlternarTodas: () => void;
  semLinhas: boolean;
}) {
  return (
    <Cabecalho>
      <ThOrdenavel
        coluna="numero_nf"
        rotulo="NF"
        {...ordem}
        fixa
        antes={
          <Checkbox
            checked={cabecalho}
            onCheckedChange={() => {
              aoAlternarTodas();
            }}
            disabled={semLinhas}
            aria-label="Marcar ou desmarcar todas as linhas da lista"
            title="Marcar/desmarcar todas as linhas da lista (todas as páginas) — só as marcadas saem na exportação"
          />
        }
      />
      <ThOrdenavel coluna="numero_ctrc" rotulo="CTRC" {...ordem} />
      <Th>Status</Th>
      <ThOrdenavel coluna="data_emissao" rotulo="Emissão" {...ordem} />
      <ThOrdenavel coluna="data_embarque" rotulo="Embarque" {...ordem} />
      <Th>Prazo</Th>
      <ThOrdenavel coluna="parceiro" rotulo="Parceiro" {...ordem} />
      <ThOrdenavel coluna="unidade" rotulo="Unidade" {...ordem} />
      <Th>Cidade Unid.</Th>
      <Th>Local. atual</Th>
      <Th>Placa</Th>
      <Th>Motorista</Th>
      <ThOrdenavel coluna="remetente" rotulo="Remetente" {...ordem} />
      <Th>Cliente destino</Th>
      <ThOrdenavel coluna="cidade_destino" rotulo="Destino" {...ordem} />
      <Th>Setor</Th>
      <Th>Bairro</Th>
      <Th direita>Vlr. mercadoria</Th>
      <ThOrdenavel coluna="peso" rotulo="Peso" {...ordem} direita />
      <ThOrdenavel coluna="volumes" rotulo="Vol." {...ordem} direita />
      <ThOrdenavel coluna="valor_frete" rotulo="Frete" {...ordem} direita />
      <ThOrdenavel coluna="status_atual" rotulo="Última ocorrência" {...ordem} />
      <Th>Atraso</Th>
      <Th>Alertas</Th>
    </Cabecalho>
  );
}
