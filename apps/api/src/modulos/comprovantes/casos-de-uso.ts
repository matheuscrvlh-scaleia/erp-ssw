import {
  calcularPainelDeComprovantes,
  classificarComprovantes,
  type CteEntregue,
  diaCobertoPeloArquivo,
  listarComprovantes,
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
  TIPO_NAO_INFORMADO,
} from "@erp/shared/contratos/comprovantes";
import { SEM_TIPO_DOCUMENTO } from "@erp/shared/contratos/ocorrencias";
import { type z } from "@erp/shared/zod";

import { consultaAmplaDemais } from "../../http/erros";
import { type Executor } from "../../repositorios";

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

export interface DetalheDoComprovante {
  id: string;
  numero: string;
  sigla: string;
  numeroNf: number | null;
  dataEmissao: string;
  setor: string | null;
  pagadorNome: string | null;
  remetente: string | null;
  destinatario: string | null;
  cidadeDestino: string | null;
}

export interface RepositorioComprovantes {
  /** CT-e entregues no período (dia da entrega em São Paulo), com os filtros. */
  entregues(filtro: FiltroDeEntregues, limite: number): Promise<CteEntregue[]>;
  /** Nomes dos arquivos 930 importados (o dia coberto vem do nome). */
  arquivos930Importados(empresaId: string): Promise<string[]>;
  detalhes(ids: string[]): Promise<DetalheDoComprovante[]>;
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
  const dias = (await repo.arquivos930Importados(empresaId))
    .map(diaCobertoPeloArquivo)
    .filter((d) => d !== null);
  return classificarComprovantes(entregues, new Set(dias));
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

/**
 * Lista de um card (todos, digitalizados, pendentes), paginada.
 * origem: comprovantes_lista_v2 (sistema atual)
 */
export async function obterListaDeComprovantes(
  db: Db,
  empresaId: string,
  entrada: z.output<typeof contratosComprovantes.lista.entrada>,
): Promise<SaidaDe<typeof contratosComprovantes.lista>> {
  return db(async ({ comprovantes }) => {
    const todos = listarComprovantes(
      await comprovantesDoPeriodo(comprovantes, empresaId, entrada),
      saneTipos(entrada.tipos),
      entrada.status,
    );
    const inicio = (entrada.pagina - 1) * entrada.tamanho;
    const pagina = todos.slice(inicio, inicio + entrada.tamanho);
    const detalhes = new Map(
      (await comprovantes.detalhes(pagina.map((c) => c.id))).map((d) => [d.id, d]),
    );
    return {
      total: todos.length,
      linhas: pagina.flatMap((c) => {
        const d = detalhes.get(c.id);
        if (!d) return [];
        return [
          {
            id: c.id,
            numeroCtrc: d.numero,
            siglaCtrc: d.sigla,
            numeroNf: d.numeroNf,
            dataEntrega: c.dataEntrega.toISOString(),
            dataEmissao: d.dataEmissao,
            unidade: c.unidade,
            setor: d.setor,
            pagadorNome: d.pagadorNome,
            remetente: d.remetente,
            destinatario: d.destinatario,
            cidadeDestino: d.cidadeDestino,
            tipoDocumento:
              c.tipoEfetivo === SEM_TIPO_DOCUMENTO ? TIPO_NAO_INFORMADO : c.tipoEfetivo,
            digitalizado: c.digitalizado,
          },
        ];
      }),
    };
  });
}
