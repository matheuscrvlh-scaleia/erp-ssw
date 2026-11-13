import { type SaidaDe } from "@erp/shared/contract";
import { type contratosFiltros, type PagadorOpcao } from "@erp/shared/contracts/filters";
import { formatarCnpj } from "@erp/shared/formatting";

import { type CodigoCadastrado } from "../models/ctrc/ctrc.service";
import { type OpcoesDosFiltros, type PagadorAgrupado } from "../models/filters/filters.service";

/** O código como o seletor vê: tipo do SSW e pendência ficam no servidor. */
function apresentarCodigo({ codigo, descricao, penaliza }: CodigoCadastrado) {
  return { codigo, descricao, penaliza };
}

export function apresentarCodigos(
  catalogo: CodigoCadastrado[],
): SaidaDe<typeof contratosFiltros.codigos> {
  return catalogo.map(apresentarCodigo);
}

export function apresentarOpcoes({
  filiais,
  codigos,
}: OpcoesDosFiltros): SaidaDe<typeof contratosFiltros.opcoes> {
  return { filiais, codigos: codigos.map(apresentarCodigo) };
}

/** Sem nome gravado, o pagador aparece pelo CNPJ formatado. */
function apresentarPagador(p: PagadorAgrupado): PagadorOpcao {
  const cnpjFormatado = p.cnpjGravado ?? formatarCnpj(p.cnpj);
  return { id: p.cnpj, nome: p.nome ?? cnpjFormatado, cnpjFormatado };
}

export function apresentarPagadores(
  pagadores: PagadorAgrupado[],
): SaidaDe<typeof contratosFiltros.pagadores> {
  return pagadores.map(apresentarPagador);
}
