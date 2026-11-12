import { type PainelDeColetas } from "@erp/shared/contratos/coletas";

import { TabelaDados } from "@/componentes/comum/TabelaDados";

export function TabelaPorTipoDeCte({
  linhas,
  carregando,
}: {
  linhas: PainelDeColetas["porTipoCtrc"];
  carregando: boolean;
}) {
  return (
    <TabelaDados
      titulo="CT-e gerado pela coleta, por tipo de documento"
      colunas={[
        { chave: "tipoDocumento", titulo: "Tipo de documento" },
        { chave: "coletas", titulo: "Coletas", formato: "inteiro" },
        { chave: "ctes", titulo: "CT-e", formato: "inteiro" },
      ]}
      linhas={linhas}
      chaveDaLinha={(l) => l.tipoDocumento}
      carregando={carregando}
      porPagina={0}
    />
  );
}
