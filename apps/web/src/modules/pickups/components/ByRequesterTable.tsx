import { type PainelDeColetas } from "@erp/shared/contracts/pickups";

import { TabelaDados } from "@/components/common/DataTable";

import { alternar } from "../rules";
import { type BuscaColetas } from "../search";
import { SEM_SOLICITANTE } from "../texts";

/** Clicar no solicitante liga/desliga o filtro por ele. */
export function TabelaPorSolicitante({
  linhas,
  carregando,
  solicitantes,
  subtitulo,
  aoMudar: mudar,
}: {
  linhas: PainelDeColetas["porSolicitante"];
  carregando: boolean;
  solicitantes: readonly string[];
  subtitulo: string;
  aoMudar: (m: Partial<BuscaColetas>) => void;
}) {
  return (
    <TabelaDados
      className="xl:col-span-2"
      titulo="Coletas por solicitante"
      colunas={[
        {
          chave: "solicitante",
          titulo: "Solicitante",
          valor: (l) => l.solicitante || SEM_SOLICITANTE,
        },
        { chave: "total", titulo: "Coletas", formato: "inteiro" },
        { chave: "coletadas", titulo: "Coletadas", formato: "inteiro" },
        { chave: "noPrazo", titulo: "No prazo", formato: "inteiro" },
        { chave: "atrasadas", titulo: "Atrasadas", formato: "inteiro" },
        { chave: "abertas", titulo: "Em aberto", formato: "inteiro" },
      ]}
      linhas={linhas}
      chaveDaLinha={(l) => l.solicitante}
      carregando={carregando}
      porPagina={10}
      aoClicarLinha={(l) => {
        mudar({ solicitantes: alternar(solicitantes, l.solicitante) });
      }}
      exportacao={{
        arquivo: "coletas-por-solicitante",
        titulo: "Coletas por solicitante",
        subtitulo,
      }}
    />
  );
}
