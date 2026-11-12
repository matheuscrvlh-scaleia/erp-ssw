import { type SaidaDe } from "@erp/shared/contrato";
import {
  type AlteracaoDoCodigo,
  type CodigoDoAdmin,
  type contratosCodigosOcorrencia,
} from "@erp/shared/contratos/codigos-ocorrencia";

import {
  type CatalogoDeCodigos,
  type CodigoComFrequencia,
} from "../models/codigos-ocorrencia/codigos-ocorrencia.service";

function apresentarCodigo(codigo: CodigoComFrequencia): CodigoDoAdmin {
  return { ...codigo, atualizadoEm: codigo.atualizadoEm.toISOString() };
}

export function apresentarCatalogoDeCodigos(
  catalogo: CatalogoDeCodigos,
): SaidaDe<typeof contratosCodigosOcorrencia.listar> {
  return { codigos: catalogo.codigos.map(apresentarCodigo), estatisticas: catalogo.estatisticas };
}

export function apresentarHistoricoDoCodigo(
  alteracoes: AlteracaoDoCodigo[],
): SaidaDe<typeof contratosCodigosOcorrencia.historico> {
  return { alteracoes };
}
