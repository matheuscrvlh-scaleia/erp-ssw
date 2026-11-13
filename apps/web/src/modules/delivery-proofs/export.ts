import { type LinhaDeComprovante } from "@erp/shared/contracts/delivery-proofs";

import { type ColunaTabela } from "@/components/common/data-table";
import { type ColunaExportacao, urlCtrcNoSsw } from "@/lib/export";

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
