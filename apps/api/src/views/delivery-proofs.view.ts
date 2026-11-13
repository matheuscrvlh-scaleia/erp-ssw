import { type SaidaDe } from "@erp/shared/contract";
import {
  type contratosComprovantes,
  type LinhaDeComprovante,
  TIPO_NAO_INFORMADO,
} from "@erp/shared/contracts/delivery-proofs";
import { SEM_TIPO_DOCUMENTO } from "@erp/shared/contracts/occurrences";

import {
  type ComprovanteDaLista,
  type ListaDeComprovantes,
} from "../models/delivery-proofs/delivery-proofs.service";

/** A linha como a tela mostra: CT-e sem tipo aparece como "NAO INFORMADO". */
function apresentarComprovante(c: ComprovanteDaLista): LinhaDeComprovante {
  return {
    id: c.id,
    numeroCtrc: c.numero,
    siglaCtrc: c.sigla,
    numeroNf: c.numeroNf,
    dataEntrega: c.dataEntrega.toISOString(),
    dataEmissao: c.dataEmissao,
    unidade: c.unidade,
    setor: c.setor,
    pagadorNome: c.pagadorNome,
    remetente: c.remetente,
    destinatario: c.destinatario,
    cidadeDestino: c.cidadeDestino,
    tipoDocumento: c.tipoEfetivo === SEM_TIPO_DOCUMENTO ? TIPO_NAO_INFORMADO : c.tipoEfetivo,
    digitalizado: c.digitalizado,
  };
}

export function apresentarListaDeComprovantes(
  lista: ListaDeComprovantes,
): SaidaDe<typeof contratosComprovantes.lista> {
  return { total: lista.total, linhas: lista.linhas.map(apresentarComprovante) };
}

export function apresentarExportacaoDeComprovantes(
  linhas: ComprovanteDaLista[],
): SaidaDe<typeof contratosComprovantes.exportar> {
  return { linhas: linhas.map(apresentarComprovante) };
}
