import { type LinhaDeComprovante } from "@erp/shared/contratos/comprovantes";

import { type ColunaTabela } from "@/componentes/comum/tabela-dados";
import { type ColunaExportacao, urlCtrcNoSsw } from "@/lib/exportacao";

/** As colunas do arquivo são as da lista lateral, na mesma ordem. */
export const colunasDaExportacao = (
  colunas: readonly ColunaTabela<LinhaDeComprovante>[],
): ColunaExportacao[] =>
  colunas.map(({ chave, titulo, formato }) => ({
    chave,
    titulo,
    formato,
  }));

/** A linha do arquivo: o comprovante por extenso e o link do CT-e no SSW. */
export const linhaDaExportacao = (l: LinhaDeComprovante) => ({
  ...l,
  digitalizado: l.digitalizado ? "Digitalizado" : "Pendente",
  linkSsw: urlCtrcNoSsw(l.siglaCtrc, l.numeroCtrc, l.dataEmissao),
});
