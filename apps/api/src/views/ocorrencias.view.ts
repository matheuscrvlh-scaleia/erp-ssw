import { type SaidaDe } from "@erp/shared/contrato";
import {
  type CodigoDoCard,
  type contratosOcorrencias,
  type LinhaDeOcorrencia,
} from "@erp/shared/contratos/ocorrencias";

import { type OpcoesDeOcorrencias } from "../models/ocorrencias/ocorrencias.service";

export function apresentarExportacaoDeOcorrencias(
  linhas: LinhaDeOcorrencia[],
): SaidaDe<typeof contratosOcorrencias.exportar> {
  return { linhas };
}

export function apresentarCodigosDoCard(
  codigos: CodigoDoCard[],
): SaidaDe<typeof contratosOcorrencias.codigosDoCard> {
  return { codigos };
}

/** Pagador sem nome aparece pelo CNPJ formatado; código fora do catálogo, como "Código N". */
export function apresentarOpcoesDeOcorrencias(
  opcoes: OpcoesDeOcorrencias,
): SaidaDe<typeof contratosOcorrencias.opcoes> {
  return {
    unidades: opcoes.unidades,
    parceiros: opcoes.pagadores.map((p) => ({
      id: p.cnpj,
      nome: p.nome ?? p.cnpjFormatado,
      cnpjFormatado: p.cnpjFormatado,
    })),
    codigos: opcoes.codigos.map(({ codigo, descricao }) => ({
      codigo,
      descricao: descricao ?? `Código ${codigo}`,
    })),
  };
}

export function apresentarConferentes(
  conferentes: string[],
): SaidaDe<typeof contratosOcorrencias.conferentes> {
  return { conferentes };
}
