/**
 * Filtro único da Listagem detalhada: a lista, os quatro gráficos, os códigos do recorte e a
 * exportação usam o mesmo `FiltroLista`. Aqui só se decide O QUE filtrar (sem SQL); a API traduz
 * para a consulta.
 * origem: _lista_ctrcs_detalhado_filtro e lista.functions.ts (sistema atual)
 */
import {
  type BaseData,
  type FaixaPrevisto,
  type FiltroListaValidado,
  recortesSelecionados,
  type StatusPrevisto,
  type TipoRecorte,
} from "@erp/shared/contratos/listagem";

import { diaSp, hojeSp } from "../nucleo";
import { type CtrcProcurado, lerCtrcProcurado, lerNotaProcurada, padroesDeTexto } from "./texto";

/** Horas à frente do recorte "Vencendo em 24-48h". origem: p_vencendo_horas DEFAULT 48 */
const HORAS_DE_VENCIMENTO = 48;
/** Dias sem movimento do recorte "Sem atualização recente". origem: p_dias_sem_atualizacao DEFAULT 5 */
const DIAS_SEM_ATUALIZACAO = 5;
/** Limite padrão de "sem movimento" quando a empresa não configurou. origem: _alerta_dias_sem_movimento */
const LIMITE_SEM_MOVIMENTO_PADRAO = 3;

const TIPOS_PENDENCIA = ["PENDENCIA_CLIENTE", "PENDENCIA_TRANSPORTADORA"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CodigoDoCatalogo {
  codigo: number;
  tipoSsw: string | null;
  pendenciaAcompanhada: boolean;
}

export interface ContextoDoFiltro {
  filiaisProprias: readonly string[];
  catalogo: readonly CodigoDoCatalogo[];
  /** Configuração `ocorrencias_codigos_fora_da_tela` (FR: 3, 40, 55, 96, 98). */
  codigosForaDaTela: readonly number[];
  /** Configuração `alerta_dias_sem_movimento`. */
  limiteSemMovimento: number;
  agora: Date;
}

/** Códigos do catálogo da empresa que os recortes usam. */
interface CodigosDoFiltro {
  /** `tipo_ssw = BAIXA` (Q22: cadastro da empresa). */
  baixas: number[];
  /** Pendência acompanhada (penalizados). */
  acompanhados: number[];
  /** Acompanhados menos os fora da tela (recortes `ocorr_*`, igual à tela Ocorrências). */
  daTela: number[];
  /** Pendência do cliente ou da transportadora. */
  pendencias: number[];
}

export interface FiltroLista {
  /** Filiais efetivas aceitas: as próprias, já cruzadas com unidade/filial pedidas. */
  siglas: string[];
  /** Unidades pedidas por cadastro (id), como no card da Performance (Q13). */
  unidadesIds: string[] | null;
  periodo: { base: BaseData; inicio: string | null; fim: string | null } | null;
  pagadores: string[] | null;
  remetente: string[] | null;
  destino: string[] | null;
  cidade: string[] | null;
  /** Código da ocorrência efetiva, o mesmo do card (Q13). */
  codigos: number[] | null;
  /** Tipo de documento efetivo em maiúsculas; `__SEM_TIPO__` = sem tipo. */
  tipos: string[] | null;
  pesoMin: number | null;
  pesoMax: number | null;
  atrasoMin: number | null;
  atrasoMax: number | null;
  ctrc: CtrcProcurado | null;
  /** Nota sem zeros à esquerda; "" = sem nota (ou nota 0). */
  nf: string | null;
  /** Busca livre: CT-e ou nota. */
  busca: CtrcProcurado | null;
  /** Recortes com condição (sem "emitidos"); vazio = todos os CT-e. Entre eles vale OU. */
  recortes: TipoRecorte[];
  codigoRecorte: number | null;
  faixaMin: number | null;
  faixaMax: number | null;
  statusPrevisto: StatusPrevisto | null;
  faixaPrev: FaixaPrevisto | null;
  /** Hoje em Brasília (Q11). */
  hoje: string;
  /** Último dia do recorte "Vencendo": dia (Brasília) de agora + 48 h. */
  ultimoDiaDeVencimento: string;
  limiteSemMovimento: number;
  diasSemAtualizacao: number;
  codigosDoCatalogo: CodigosDoFiltro;
}

function naoVazia<T>(lista: readonly T[] | undefined): T[] | null {
  return lista && lista.length > 0 ? [...new Set(lista)] : null;
}

const siglaNormalizada = (s: string) => s.trim().toUpperCase();

/** Interseção de siglas pedidas (`null` = sem pedido). */
function cruzar(base: readonly string[], pedidas: readonly string[] | null): string[] {
  if (pedidas === null) return [...base];
  const aceitas = new Set(pedidas.map(siglaNormalizada));
  return base.filter((s) => aceitas.has(s));
}

export function codigosDoCatalogo(
  catalogo: readonly CodigoDoCatalogo[],
  codigosForaDaTela: readonly number[],
): CodigosDoFiltro {
  const acompanhados = catalogo.filter((c) => c.pendenciaAcompanhada).map((c) => c.codigo);
  return {
    baixas: catalogo.filter((c) => c.tipoSsw === "BAIXA").map((c) => c.codigo),
    acompanhados,
    daTela: acompanhados.filter((c) => !codigosForaDaTela.includes(c)),
    pendencias: catalogo
      .filter((c) => c.tipoSsw !== null && TIPOS_PENDENCIA.includes(c.tipoSsw))
      .map((c) => c.codigo),
  };
}

/**
 * Monta o filtro a partir da entrada da tela. `null` = nenhum CT-e pode entrar (empresa sem
 * filial própria, ou unidade/filial pedida que não é própria — Q10 do dono: lista vazia, em vez
 * de ignorar o filtro e mostrar todas).
 */
export function montarFiltroLista(
  entrada: FiltroListaValidado,
  ctx: ContextoDoFiltro,
): FiltroLista | null {
  const unidades = naoVazia(entrada.unidades);
  const siglasDeUnidade = unidades?.filter((u) => !UUID.test(u)) ?? [];
  const unidadesIds = unidades?.filter((u) => UUID.test(u)) ?? [];
  const filiais = naoVazia(entrada.filiais);

  const proprias = [...new Set(ctx.filiaisProprias.map(siglaNormalizada))];
  const siglas = cruzar(
    cruzar(proprias, siglasDeUnidade.length > 0 ? siglasDeUnidade : null),
    filiais,
  );
  if (siglas.length === 0) return null;

  const busca = entrada.busca?.trim() ? lerCtrcProcurado(entrada.busca) : null;
  const ctrc = entrada.ctrc?.trim() ? lerCtrcProcurado(entrada.ctrc) : null;
  const nf = entrada.nf?.trim() ? lerNotaProcurada(entrada.nf) : null;
  const semPeriodo =
    entrada.ignorarPeriodo === true || busca !== null || ctrc !== null || nf !== null;
  const temPeriodo = entrada.inicio !== undefined || entrada.fim !== undefined;

  // `__SEM_TIPO__` já vem em maiúsculas: passa igual.
  const tipos = naoVazia(entrada.tipos?.map((t) => t.toUpperCase()).filter((t) => t !== ""));

  return {
    siglas,
    unidadesIds: unidadesIds.length > 0 ? unidadesIds : null,
    periodo:
      semPeriodo || !temPeriodo
        ? null
        : { base: entrada.base, inicio: entrada.inicio ?? null, fim: entrada.fim ?? null },
    pagadores: naoVazia(entrada.parceiros?.filter((p) => p !== "")),
    remetente: padroesDeTexto(entrada.remetente),
    destino: padroesDeTexto(entrada.destino),
    cidade: padroesDeTexto(entrada.cidade),
    codigos: naoVazia(entrada.codigos),
    tipos,
    pesoMin: entrada.pesoMin ?? null,
    pesoMax: entrada.pesoMax ?? null,
    atrasoMin: entrada.atrasoMin ?? null,
    atrasoMax: entrada.atrasoMax ?? null,
    ctrc,
    nf,
    busca,
    recortes: recortesSelecionados(entrada.tipo, entrada.recortes).filter((r) => r !== "emitidos"),
    codigoRecorte: entrada.codigoRecorte ?? null,
    faixaMin: entrada.faixaMin ?? null,
    faixaMax: entrada.faixaMax ?? null,
    statusPrevisto: entrada.statusPrevisto ?? null,
    faixaPrev: entrada.faixaPrev ?? null,
    hoje: hojeSp(ctx.agora),
    ultimoDiaDeVencimento: diaSp(
      new Date(ctx.agora.getTime() + Math.max(HORAS_DE_VENCIMENTO, 1) * 3_600_000),
    ),
    limiteSemMovimento: ctx.limiteSemMovimento,
    diasSemAtualizacao: Math.max(DIAS_SEM_ATUALIZACAO, 1),
    codigosDoCatalogo: codigosDoCatalogo(ctx.catalogo, ctx.codigosForaDaTela),
  };
}

/**
 * Lê as configurações da empresa que o filtro usa. Valor ausente ou inválido cai no padrão.
 * origem: _alerta_dias_sem_movimento, _ocorrencias_codigos_tela (sistema atual)
 */
export function lerConfiguracoesDaListagem(valores: ReadonlyMap<string, string>): {
  limiteSemMovimento: number;
  codigosForaDaTela: number[];
} {
  const limite = Number.parseInt(valores.get("alerta_dias_sem_movimento")?.trim() ?? "", 10);
  const foraDaTela = (valores.get("ocorrencias_codigos_fora_da_tela") ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter((c) => /^\d+$/.test(c))
    .map(Number);
  return {
    limiteSemMovimento: Number.isFinite(limite) ? limite : LIMITE_SEM_MOVIMENTO_PADRAO,
    codigosForaDaTela: foraDaTela,
  };
}

export const CHAVES_DE_CONFIGURACAO_DA_LISTAGEM = [
  "alerta_dias_sem_movimento",
  "ocorrencias_codigos_fora_da_tela",
] as const;
