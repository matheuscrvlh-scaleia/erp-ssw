import { type PainelDeColetas } from "@erp/shared/contracts/pickups";

import { TabelaDados } from "@/components/common/DataTable";

export function TabelaPorUnidade({
  linhas,
  carregando,
  subtitulo,
}: {
  linhas: PainelDeColetas["porUnidade"];
  carregando: boolean;
  subtitulo: string;
}) {
  return (
    <TabelaDados
      titulo="Por unidade"
      colunas={[
        { chave: "unidade", titulo: "Unidade", classe: "font-mono" },
        { chave: "total", titulo: "Coletas", formato: "inteiro" },
        { chave: "coletadas", titulo: "Coletadas", formato: "inteiro" },
        { chave: "noPrazo", titulo: "No prazo", formato: "inteiro" },
        { chave: "atrasadas", titulo: "Atrasadas", formato: "inteiro" },
        {
          chave: "pctNoPrazo",
          titulo: "% no prazo",
          formato: "percentual",
          valor: (l) => (l.coletadas > 0 ? l.noPrazo / l.coletadas : null),
        },
        { chave: "abertas", titulo: "Em aberto", formato: "inteiro" },
        { chave: "vencidas", titulo: "Vencidas", formato: "inteiro" },
        { chave: "canceladas", titulo: "Canceladas", formato: "inteiro" },
      ]}
      linhas={linhas}
      chaveDaLinha={(l) => l.unidade}
      carregando={carregando}
      porPagina={0}
      exportacao={{
        arquivo: "coletas-por-unidade",
        titulo: "Coletas por unidade",
        subtitulo,
      }}
    />
  );
}
