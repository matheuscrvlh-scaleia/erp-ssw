import {
  calcularPainelDeComprovantes,
  classificarComprovantes,
  type CteEntregue,
  diaCobertoPeloArquivo,
} from "@erp/dominio/comprovantes/comprovantes";
import {
  padroesDoFiltroDeTexto,
  saneTipos,
  termoCtrc,
  termoNf,
} from "@erp/dominio/ocorrencias/busca";
import { type SaidaDe } from "@erp/shared/contrato";
import {
  type contratosComprovantes,
  type FiltrosDeComprovantes,
  type LinhaDeComprovante,
  type StatusDeComprovante,
  TIPO_NAO_INFORMADO,
} from "@erp/shared/contratos/comprovantes";
import { SEM_TIPO_DOCUMENTO } from "@erp/shared/contratos/ocorrencias";
import { type z } from "@erp/shared/zod";

import { consultaAmplaDemais } from "../../http/erros";
import { type Executor } from "../../infra/repositorios";

export const LIMITE_DE_LINHAS = 200_000;

export interface FiltroDeEntregues {
  empresaId: string;
  inicio: string;
  fim: string;
  /** Siglas: unidades (URL) e filiais (seletor), as duas pela filial responsável. */
  unidades: string[];
  filiais: string[];
  pagadores: string[];
  remetente: string[] | null;
  destino: string[] | null;
  /**
   * Busca por CT-e/NF: nulo = desligada. Ligada com termo vazio ("000", "0") é paridade com o
   * sistema atual: CT-e não casa nenhum; NF casa todo CT-e sem NF.
   */
  ctrc: string | null;
  nf: string | null;
}

/** O que a lista de um card pede além dos filtros de CT-e. */
export interface PedidoDaLista {
  /** Tipos já saneados (maiúsculos); vazio = sem filtro. */
  tipos: string[];
  status: StatusDeComprovante;
  /** Dias com o 930 importado (`AAAA-MM-DD`). */
  diasCobertos: string[];
}

/** Linha da lista de um card, como o banco devolve. */
export interface ComprovanteDaLista {
  id: string;
  numero: string;
  sigla: string;
  numeroNf: number | null;
  dataEmissao: string;
  dataEntrega: Date;
  unidade: string | null;
  setor: string | null;
  pagadorNome: string | null;
  remetente: string | null;
  destinatario: string | null;
  cidadeDestino: string | null;
  /** Tipo efetivo; sem tipo = `SEM_TIPO_DOCUMENTO`. */
  tipoEfetivo: string;
  digitalizado: boolean;
}

export interface RepositorioComprovantes {
  /** CT-e entregues no período (dia da entrega em São Paulo), com os filtros. */
  entregues(filtro: FiltroDeEntregues, limite: number): Promise<CteEntregue[]>;
  /** Nomes dos arquivos 930 importados (o dia coberto vem do nome). */
  arquivos930Importados(empresaId: string): Promise<string[]>;
  /**
   * Lista de um card filtrada, ordenada (entrega mais recente, depois o CT-e gravado por último
   * e o id) e paginada no banco, com o total da lista inteira.
   */
  lista(
    filtro: FiltroDeEntregues,
    pedido: PedidoDaLista,
    pagina: { limite: number; deslocamento: number },
  ): Promise<{ linhas: ComprovanteDaLista[]; total: number }>;
}

type Db = Executor<"comprovantes">;

function normalizar(empresaId: string, f: FiltrosDeComprovantes): FiltroDeEntregues {
  const texto = (valor: string) => (valor.trim() === "" ? null : padroesDoFiltroDeTexto(valor));
  const busca = (valor: string, termo: (v: string) => string | null) =>
    valor.trim() === "" ? null : (termo(valor) ?? "");
  return {
    empresaId,
    inicio: f.inicio,
    fim: f.fim,
    unidades: f.unidades,
    filiais: f.filiais,
    pagadores: f.pagadores,
    remetente: texto(f.remetente),
    destino: texto(f.destino),
    ctrc: busca(f.ctrc, termoCtrc),
    nf: busca(f.nf, termoNf),
  };
}

async function comprovantesDoPeriodo(
  repo: RepositorioComprovantes,
  empresaId: string,
  f: FiltrosDeComprovantes,
) {
  const entregues = await repo.entregues(normalizar(empresaId, f), LIMITE_DE_LINHAS + 1);
  if (entregues.length > LIMITE_DE_LINHAS) throw consultaAmplaDemais();
  return classificarComprovantes(entregues, new Set(await diasCobertos(repo, empresaId)));
}

/**
 * Cards, tendência por dia e tabelas por unidade e por tipo de documento.
 * origem: comprovantes_metricas_v2 (sistema atual)
 */
export async function obterPainelDeComprovantes(
  db: Db,
  empresaId: string,
  entrada: FiltrosDeComprovantes,
): Promise<SaidaDe<typeof contratosComprovantes.painel>> {
  return db(async ({ comprovantes }) =>
    calcularPainelDeComprovantes(
      await comprovantesDoPeriodo(comprovantes, empresaId, entrada),
      saneTipos(entrada.tipos),
    ),
  );
}

async function diasCobertos(repo: RepositorioComprovantes, empresaId: string) {
  return (await repo.arquivos930Importados(empresaId))
    .map(diaCobertoPeloArquivo)
    .filter((d) => d !== null);
}

function paraALinha(c: ComprovanteDaLista): LinhaDeComprovante {
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

type EntradaDaLista = z.output<typeof contratosComprovantes.exportar.entrada>;

async function lerLista(
  repo: RepositorioComprovantes,
  empresaId: string,
  entrada: EntradaDaLista,
  pagina: { limite: number; deslocamento: number },
) {
  return repo.lista(
    normalizar(empresaId, entrada),
    {
      tipos: saneTipos(entrada.tipos),
      status: entrada.status,
      diasCobertos: await diasCobertos(repo, empresaId),
    },
    pagina,
  );
}

/**
 * Lista de um card (todos, digitalizados, pendentes), paginada no banco.
 * origem: comprovantes_lista_v2 (sistema atual)
 */
export async function obterListaDeComprovantes(
  db: Db,
  empresaId: string,
  entrada: z.output<typeof contratosComprovantes.lista.entrada>,
): Promise<SaidaDe<typeof contratosComprovantes.lista>> {
  return db(async ({ comprovantes }) => {
    const { linhas, total } = await lerLista(comprovantes, empresaId, entrada, {
      limite: entrada.tamanho,
      deslocamento: (entrada.pagina - 1) * entrada.tamanho,
    });
    return { total, linhas: linhas.map(paraALinha) };
  });
}

/** Lista inteira de um card, numa leitura só, na ordem da tela (exportação). */
export async function exportarListaDeComprovantes(
  db: Db,
  empresaId: string,
  entrada: EntradaDaLista,
): Promise<SaidaDe<typeof contratosComprovantes.exportar>> {
  return db(async ({ comprovantes }) => {
    const { linhas } = await lerLista(comprovantes, empresaId, entrada, {
      limite: LIMITE_DE_LINHAS + 1,
      deslocamento: 0,
    });
    if (linhas.length > LIMITE_DE_LINHAS) throw consultaAmplaDemais();
    return { linhas: linhas.map(paraALinha) };
  });
}
