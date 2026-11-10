import { agruparPorFaixaDeAtraso, pedeFaixaDeAtraso } from "@erp/dominio/listagem/faixas";
import {
  CHAVES_DE_CONFIGURACAO_DA_LISTAGEM,
  type FiltroLista,
  lerConfiguracoesDaListagem,
  montarFiltroLista,
} from "@erp/dominio/listagem/filtro";
import { type SaidaDe } from "@erp/shared/contrato";
import {
  type CodigoDoRecorte,
  type contratosListagem,
  type FiltroListaValidado,
  type LinhaLista,
  type OrdemLista,
} from "@erp/shared/contratos/listagem";

import { type Executor } from "../../repositorios";
import { type CodigoCadastrado, type RepositorioCtrc } from "../ctrc/casos-de-uso";

export interface ContagemPorCodigo {
  codigo: number;
  /** Maior descrição gravada na efetiva; vazia = a do catálogo. */
  descricao: string | null;
  qtd: number;
}

export interface Agregados {
  total: number;
  porCodigo: ContagemPorCodigo[];
  porUnidade: { unidade: string; qtd: number }[];
  porCidade: { cidade: string; qtd: number }[];
  /** CT-e por dia de atraso (só atraso > 0); vazio quando não pedido. */
  porAtraso: { atraso: number; qtd: number }[];
}

export interface RepositorioListagem {
  linhas(
    empresaId: string,
    f: FiltroLista,
    pagina: { ordem: OrdemLista; direcao: "asc" | "desc"; limite: number; deslocamento: number },
  ): Promise<LinhaLista[]>;
  agregados(
    empresaId: string,
    f: FiltroLista,
    opcoes: { topCodigos: number; topCidades: number; comAtraso: boolean },
  ): Promise<Agregados>;
  /** Contagem por código sem o filtro de códigos (opções do seletor Ocorrência). */
  codigosDoRecorte(empresaId: string, f: FiltroLista, top: number): Promise<ContagemPorCodigo[]>;
}

export interface ContextoListagem {
  empresaId: string;
  /** Fuso da empresa: o "hoje" e o dia da entrega (Q11). */
  fuso: string;
}

type Db = Executor<"ctrc" | "listagem">;
type EntradaListar = FiltroListaValidado & {
  ordem: OrdemLista;
  direcao: "asc" | "desc";
  pagina: number;
  tamanho: number;
};

const TOP_CODIGOS = 10;
const TOP_CIDADES = 10;
const TOP_CODIGOS_DO_RECORTE = 500;

/** Lê universo, catálogo e configuração da empresa e monta o filtro único. */
async function prepararFiltro(
  ctrc: RepositorioCtrc,
  ctx: ContextoListagem,
  entrada: FiltroListaValidado,
  agora: Date,
): Promise<{ filtro: FiltroLista | null; catalogo: CodigoCadastrado[] }> {
  const catalogo = await ctrc.catalogo(ctx.empresaId);
  const configuracao = lerConfiguracoesDaListagem(
    await ctrc.configuracoes(ctx.empresaId, CHAVES_DE_CONFIGURACAO_DA_LISTAGEM),
  );
  const filtro = montarFiltroLista(entrada, {
    filiaisProprias: await ctrc.filiaisProprias(ctx.empresaId),
    catalogo,
    ...configuracao,
    agora,
    fuso: ctx.fuso,
  });
  return { filtro, catalogo };
}

function comDescricaoDoCatalogo(
  contagens: readonly ContagemPorCodigo[],
  catalogo: readonly CodigoCadastrado[],
): ContagemPorCodigo[] {
  const descricoes = new Map(catalogo.map((k) => [k.codigo, k.descricao]));
  return contagens.map((c) => ({
    ...c,
    descricao: c.descricao ?? descricoes.get(c.codigo) ?? null,
  }));
}

/**
 * Página da lista, total e os quatro gráficos com o MESMO filtro. O total é contado à parte
 * (página depois da última mostra o total certo, Q10).
 * origem: listarCtrcsDetalhado (src/features/performance/lista.functions.ts, sistema atual)
 */
export async function listarCtrcs(
  db: Db,
  ctx: ContextoListagem,
  entrada: EntradaListar,
  agora: Date,
): Promise<SaidaDe<typeof contratosListagem.listar>> {
  return db(async ({ ctrc, listagem }) => {
    const { filtro, catalogo } = await prepararFiltro(ctrc, ctx, entrada, agora);
    if (filtro === null) {
      return { linhas: [], total: 0, porCodigo: [], porUnidade: [], porCidade: [], porFaixa: [] };
    }
    const linhas = await listagem.linhas(ctx.empresaId, filtro, {
      ordem: entrada.ordem,
      direcao: entrada.direcao,
      limite: entrada.tamanho,
      deslocamento: (entrada.pagina - 1) * entrada.tamanho,
    });
    const agregados = await listagem.agregados(ctx.empresaId, filtro, {
      topCodigos: TOP_CODIGOS,
      topCidades: TOP_CIDADES,
      comAtraso: pedeFaixaDeAtraso(filtro.recortes),
    });
    return {
      linhas,
      total: agregados.total,
      porCodigo: comDescricaoDoCatalogo(agregados.porCodigo, catalogo),
      porUnidade: agregados.porUnidade,
      porCidade: agregados.porCidade,
      porFaixa: agruparPorFaixaDeAtraso(agregados.porAtraso),
    };
  });
}

/**
 * Uma página grande da exportação. A tela pede página a página até `temMais` = falso: nada é
 * cortado em silêncio (Q04).
 * origem: exportarListaCtrcsDetalhado (sistema atual), sem o teto de 20 mil
 */
export async function exportarCtrcs(
  db: Db,
  ctx: ContextoListagem,
  entrada: EntradaListar,
  agora: Date,
): Promise<SaidaDe<typeof contratosListagem.exportar>> {
  return db(async ({ ctrc, listagem }) => {
    const { filtro } = await prepararFiltro(ctrc, ctx, entrada, agora);
    if (filtro === null) return { linhas: [], temMais: false };
    const linhas = await listagem.linhas(ctx.empresaId, filtro, {
      ordem: entrada.ordem,
      direcao: entrada.direcao,
      limite: entrada.tamanho + 1,
      deslocamento: (entrada.pagina - 1) * entrada.tamanho,
    });
    return {
      linhas: linhas.slice(0, entrada.tamanho),
      temMais: linhas.length > entrada.tamanho,
    };
  });
}

/**
 * Opções do seletor "Ocorrência": códigos efetivos do recorte com a quantidade, sem o próprio
 * filtro de códigos (senão, com alguns marcados, os outros sumiriam), com tipo e "penaliza".
 * origem: listarCodigosDoRecorte (sistema atual)
 */
export async function listarCodigosDoRecorte(
  db: Db,
  ctx: ContextoListagem,
  entrada: FiltroListaValidado,
  agora: Date,
): Promise<CodigoDoRecorte[]> {
  return db(async ({ ctrc, listagem }) => {
    const { filtro, catalogo } = await prepararFiltro(ctrc, ctx, entrada, agora);
    if (filtro === null) return [];
    const contagens = await listagem.codigosDoRecorte(
      ctx.empresaId,
      filtro,
      TOP_CODIGOS_DO_RECORTE,
    );
    const doCatalogo = new Map(catalogo.map((k) => [k.codigo, k]));
    return comDescricaoDoCatalogo(contagens, catalogo).map((c) => ({
      ...c,
      tipo: doCatalogo.get(c.codigo)?.tipoSsw ?? null,
      penaliza: doCatalogo.get(c.codigo)?.penaliza ?? false,
    }));
  });
}
