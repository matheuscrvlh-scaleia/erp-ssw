import type { ContagemDosAbertos, ContagemDosAlertas } from "@erp/dominio/performance/alertas";
import {
  type JanelasDosAlertas,
  janelasDosAlertas,
  limitesDosAlertas,
  montarAlertas,
} from "@erp/dominio/performance/alertas";
import {
  type CodigoDoCatalogo,
  codigosDePrejuizo,
  codigosProblemaOtif,
  type ConjuntosDoCatalogo,
  conjuntosDoCatalogo,
  descricaoDoCodigo,
} from "@erp/dominio/performance/catalogo";
import { type FiltroCtrc, normalizarFiltro } from "@erp/dominio/performance/filtro";
import { arredondarRazao, centavos, reais } from "@erp/dominio/performance/numeros";
import {
  type ContagemPontualidade,
  montarPontualidade,
} from "@erp/dominio/performance/pontualidade";
import { type GrupoPrevisto, montarPrevistos } from "@erp/dominio/performance/previstos";
import {
  type ImpactoBruto,
  impactoDosCodigos,
  montarBloco,
  type ProducaoDaUnidade,
  unidadesDoRelatorio,
} from "@erp/dominio/performance/relatorio";
import {
  agregadosDeProducao,
  type ContagemDoGrupo,
  metaPonderada,
  type MetaVigente,
  totaisDoResumo,
  unidadesDoResumo,
} from "@erp/dominio/performance/resumo";
import { completarSerie } from "@erp/dominio/performance/serie";
import { configuracaoDaTela, ordenarCodigosDisponiveis } from "@erp/dominio/performance/tela";
import {
  type CodigoDisponivel,
  type ConfiguracaoPerformance,
  type ContagemTipo,
  type FiltroPerformanceValidado,
  type FotoDoPeriodo,
  type Granularidade,
  type LimitesDosAlertas,
  type PontoSerie,
  type Pontualidade,
  type TotaisResumo,
} from "@erp/shared/contratos/performance";
import { diferencaEmDias, hojeNoFuso } from "@erp/shared/datas";

import { type Executor } from "../repositorios";
import { type ContextoDaConsulta } from "./consultas";

/** Chaves de `configuracoes` que a Performance lê. */
export const CHAVES_DE_CONFIGURACAO = [
  "sla_meta_pct",
  "sla_alerta_amarelo_pct",
  "taxa_retorno_meta_pct",
  "otif_visivel",
  "sla_alerta_vermelho_pct",
  "alerta_dias_sem_movimento",
  "alerta_queda_sla_pp",
  "alerta_janela_tendencia_dias",
  "alerta_janela_vencimento_h",
  "alerta_min_vencimento",
  "alerta_nascido_atrasado",
  "alerta_desvio_finsistema_pp",
  "alerta_dias_sem_atualizacao",
] as const;

/** Limite de linhas da exportação da tela (igual a hoje). */
export const LIMITE_DA_EXPORTACAO = 10_000;

export interface CteExportado {
  id: string;
  numeroNf: number | null;
  numero: string;
  sigla: string;
  dataEmissao: string;
  filial: string | null;
  remetente: string | null;
  destinatario: string | null;
  cidadeDestino: string | null;
  ufDestino: string | null;
  peso: string | null;
  volumes: number | null;
  valorFrete: string | null;
  placaColeta: string | null;
  placaEntrega: string | null;
  siglaCte: string | null;
  numeroCte: number | null;
  statusAtual: string | null;
}

export interface OcorrenciaExportada {
  cteId: string;
  codigo: number;
  descricao: string | null;
  dataHora: string;
}

export interface RepositorioPerformance {
  /** Valores de `configuracoes` da empresa, com o padrão da Plataforma por baixo. */
  configuracoes(empresaId: string, chaves: readonly string[]): Promise<Map<string, string>>;
  filiaisProprias(empresaId: string): Promise<string[]>;
  catalogo(empresaId: string): Promise<CodigoDoCatalogo[]>;
  /** Consultas pesadas ganham 30 s (como as funções de hoje), só nesta transação. */
  ampliarTempoLimite(): Promise<void>;
  contagensPorGrupo(
    ctx: ContextoDaConsulta,
    filtro: FiltroCtrc,
    conjuntos: ConjuntosDoCatalogo,
    codigosDePrejuizo: readonly number[],
  ): Promise<ContagemDoGrupo[]>;
  metasDeRetorno(empresaId: string, inicio: string, fim: string): Promise<MetaVigente[]>;
  unidadesAtivas(empresaId: string): Promise<{ id: string; nome: string }[]>;
  cobertura(empresaId: string): Promise<{ min: string | null; max: string | null }>;
  pontualidade(ctx: ContextoDaConsulta, filtro: FiltroCtrc): Promise<ContagemPontualidade[]>;
  tdeAguardando(
    ctx: ContextoDaConsulta,
    filtro: FiltroCtrc,
    conjuntos: ConjuntosDoCatalogo,
  ): Promise<{ aguardando: number; valor: string; total: number }>;
  otif(
    ctx: ContextoDaConsulta,
    filtro: FiltroCtrc,
    codigosProblema: readonly number[],
  ): Promise<{ total: number; problemas: number }>;
  previstos(
    ctx: ContextoDaConsulta,
    filtro: FiltroCtrc,
    conjuntos: ConjuntosDoCatalogo,
  ): Promise<GrupoPrevisto[]>;
  alertasPorEmissao(
    ctx: ContextoDaConsulta,
    filtro: FiltroCtrc,
    janelas: JanelasDosAlertas,
    limites: LimitesDosAlertas,
    conjuntos: ConjuntosDoCatalogo,
  ): Promise<ContagemDosAlertas[]>;
  alertasEmAberto(
    ctx: ContextoDaConsulta,
    filtro: FiltroCtrc,
    limites: LimitesDosAlertas,
    conjuntos: ConjuntosDoCatalogo,
    limiteDeVencimento: string,
  ): Promise<ContagemDosAbertos[]>;
  codigosDisponiveis(
    ctx: ContextoDaConsulta,
    filtro: FiltroCtrc,
  ): Promise<{ codigo: number; qtd: number }[]>;
  tiposDocumento(ctx: ContextoDaConsulta, filtro: FiltroCtrc): Promise<ContagemTipo[]>;
  serie(
    ctx: ContextoDaConsulta,
    filtro: FiltroCtrc,
    granularidade: Granularidade,
  ): Promise<PontoSerie[]>;
  impacto(
    ctx: ContextoDaConsulta,
    filtro: FiltroCtrc,
    conjuntos: ConjuntosDoCatalogo,
  ): Promise<{ codigo: string | null; totalCtrcs: number; totalPenalizantes: number }[]>;
  producaoPorUnidade(ctx: ContextoDaConsulta, filtro: FiltroCtrc): Promise<ProducaoDaUnidade[]>;
  finalizadosPorCodigo(
    ctx: ContextoDaConsulta,
    filtro: FiltroCtrc,
    conjuntos: ConjuntosDoCatalogo,
  ): Promise<{ codigo: number; qtd: number }[]>;
  ctesParaExportar(
    ctx: ContextoDaConsulta,
    filtro: FiltroCtrc,
    limite: number,
  ): Promise<CteExportado[]>;
  ocorrenciasDosCtes(ids: readonly string[]): Promise<OcorrenciaExportada[]>;
}

/** Empresa ativa de quem pede (já validada pela rota). */
export interface ContextoPerformance {
  empresaId: string;
  fuso: string;
}

type Db = Executor<"performance">;
type Repo = RepositorioPerformance;

/** Cards do topo, tabela por unidade e linha de Produção do período. */
export interface ResumoDoPeriodo {
  periodo: { inicio: string; fim: string; dias: number };
  totais: TotaisResumo;
  metaTaxaRetorno: ReturnType<typeof metaPonderada>;
  porUnidade: ReturnType<typeof unidadesDoResumo>;
  producao: ReturnType<typeof agregadosDeProducao>;
  unidades: { id: string; nome: string }[];
  cobertura: { min: string | null; max: string | null };
}

export interface TdeAguardando {
  aguardando: number;
  /** Em reais, arredondado ao centavo. */
  valor: number;
  total: number;
}

export interface OtifDoPeriodo {
  total: number;
  problemas: number;
  /** Fração de problemas (4 casas); nulo sem CT-e. */
  pct: number | null;
}

export interface RelatorioDoPeriodo extends FotoDoPeriodo {
  comparativo: FotoDoPeriodo | null;
  limites: Pick<ConfiguracaoPerformance, "slaMetaPct" | "taxaRetornoMetaPct">;
}

/** CT-e da exportação com as ocorrências dele (pode não ter nenhuma). */
export interface CteComOcorrencias {
  cte: CteExportado;
  ocorrencias: OcorrenciaExportada[];
}

export interface ExportacaoDaTela {
  ctes: CteComOcorrencias[];
  /** Havia mais CT-e que o limite da exportação. */
  truncado: boolean;
}

/** Abre o contexto da consulta: filiais próprias, hoje no fuso e o filtro normalizado. */
async function preparar(
  performance: Repo,
  ctx: ContextoPerformance,
  entrada: FiltroPerformanceValidado,
  agora: Date,
): Promise<{ consulta: ContextoDaConsulta; filtro: FiltroCtrc }> {
  const filiaisProprias = await performance.filiaisProprias(ctx.empresaId);
  await performance.ampliarTempoLimite();
  return {
    consulta: {
      empresaId: ctx.empresaId,
      fuso: ctx.fuso,
      hoje: hojeNoFuso(ctx.fuso, agora),
      filiaisProprias,
    },
    filtro: normalizarFiltro(entrada, filiaisProprias),
  };
}

const porEmissao = (f: FiltroCtrc): FiltroCtrc => ({ ...f, baseData: "emissao" });

/** origem: useSlaThresholds / useOtifVisivel (sistema atual) */
export async function obterConfiguracao(
  db: Db,
  ctx: ContextoPerformance,
): Promise<ConfiguracaoPerformance> {
  return db(async ({ performance }) =>
    configuracaoDaTela(await performance.configuracoes(ctx.empresaId, CHAVES_DE_CONFIGURACAO)),
  );
}

/**
 * Cards do topo, tabela por unidade e agregados da linha de Produção, numa passada só.
 * origem: calcular_performance + relatorio_bloco_agregados + getPerformance (sistema atual)
 */
export async function obterResumo(
  db: Db,
  ctx: ContextoPerformance,
  entrada: FiltroPerformanceValidado,
  agora: Date,
): Promise<ResumoDoPeriodo> {
  return db(async ({ performance }) => {
    const { consulta, filtro } = await preparar(performance, ctx, entrada, agora);
    const catalogo = await performance.catalogo(ctx.empresaId);
    const grupos = await performance.contagensPorGrupo(
      consulta,
      filtro,
      conjuntosDoCatalogo(catalogo),
      codigosDePrejuizo(catalogo, filtro.codigos),
    );
    const metas = await performance.metasDeRetorno(ctx.empresaId, entrada.inicio, entrada.fim);
    return {
      periodo: {
        inicio: entrada.inicio,
        fim: entrada.fim,
        dias: Math.max(1, diferencaEmDias(entrada.inicio, entrada.fim) + 1),
      },
      totais: totaisDoResumo(grupos),
      metaTaxaRetorno: metaPonderada(grupos, metas),
      porUnidade: unidadesDoResumo(grupos),
      producao: agregadosDeProducao(grupos),
      unidades: await performance.unidadesAtivas(ctx.empresaId),
      cobertura: await performance.cobertura(ctx.empresaId),
    };
  });
}

/** origem: calcular_performance_pontualidade (sistema atual) */
export async function obterPontualidade(
  db: Db,
  ctx: ContextoPerformance,
  entrada: FiltroPerformanceValidado,
  agora: Date,
): Promise<ReturnType<typeof montarPontualidade>> {
  return db(async ({ performance }) => {
    const { consulta, filtro } = await preparar(performance, ctx, entrada, agora);
    return montarPontualidade(await performance.pontualidade(consulta, filtro));
  });
}

/** Os números da Performance de uma empresa no período, por emissão e sem os filtros da tela. */
export interface IndicadoresDoPeriodo {
  totais: TotaisResumo;
  entregues: number;
  pontualidade: Pontualidade["totais"];
  configuracao: ConfiguracaoPerformance;
}

/**
 * Cards do topo da Performance (CT-e, em atraso, SLA Operacional e metas) numa transação só: é o
 * que o Dashboard da Plataforma mostra de cada empresa.
 */
export async function obterIndicadoresDoPeriodo(
  db: Db,
  ctx: ContextoPerformance,
  periodo: { inicio: string; fim: string },
  agora: Date,
): Promise<IndicadoresDoPeriodo> {
  return db(async ({ performance }) => {
    const entrada = { ...periodo, baseData: "emissao" as const };
    const { consulta, filtro } = await preparar(performance, ctx, entrada, agora);
    const catalogo = await performance.catalogo(ctx.empresaId);
    const config = await performance.configuracoes(ctx.empresaId, CHAVES_DE_CONFIGURACAO);
    const grupos = await performance.contagensPorGrupo(
      consulta,
      filtro,
      conjuntosDoCatalogo(catalogo),
      codigosDePrejuizo(catalogo, filtro.codigos),
    );
    const pontualidade = await performance.pontualidade(consulta, filtro);
    return {
      totais: totaisDoResumo(grupos),
      entregues: agregadosDeProducao(grupos).entregues,
      pontualidade: montarPontualidade(pontualidade).totais,
      configuracao: configuracaoDaTela(config),
    };
  });
}

/**
 * CT-e com TDE ainda sem saída para entrega. Decisão Q13: usa o mesmo filtro dos cards (unidade
 * por cadastro vale; código pela ocorrência efetiva), não mais o da lista.
 * origem: performance_tde_aguardando (sistema atual)
 */
export async function obterTdeAguardando(
  db: Db,
  ctx: ContextoPerformance,
  entrada: FiltroPerformanceValidado,
  agora: Date,
): Promise<TdeAguardando> {
  return db(async ({ performance }) => {
    const { consulta, filtro } = await preparar(performance, ctx, entrada, agora);
    const conjuntos = conjuntosDoCatalogo(await performance.catalogo(ctx.empresaId));
    const r = await performance.tdeAguardando(consulta, filtro, conjuntos);
    return { aguardando: r.aguardando, valor: reais(centavos(r.valor)), total: r.total };
  });
}

/** Só com `otif_visivel` ligado na empresa; senão nulo. origem: performance_otif */
export async function obterOtif(
  db: Db,
  ctx: ContextoPerformance,
  entrada: FiltroPerformanceValidado,
  agora: Date,
): Promise<OtifDoPeriodo | null> {
  return db(async ({ performance }) => {
    const config = await performance.configuracoes(ctx.empresaId, ["otif_visivel"]);
    if (!configuracaoDaTela(config).otifVisivel) return null;
    const { consulta, filtro } = await preparar(performance, ctx, entrada, agora);
    const conjuntos = conjuntosDoCatalogo(await performance.catalogo(ctx.empresaId));
    const r = await performance.otif(consulta, filtro, codigosProblemaOtif(conjuntos));
    return { ...r, pct: r.total > 0 ? arredondarRazao(r.problemas, r.total, 4) : null };
  });
}

/**
 * Previstos sempre por emissão; `ignorarPeriodo` = todos em aberto.
 * origem: performance_previstos_breakdown (sistema atual)
 */
export async function obterPrevistos(
  db: Db,
  ctx: ContextoPerformance,
  entrada: FiltroPerformanceValidado & { ignorarPeriodo: boolean },
  agora: Date,
): Promise<ReturnType<typeof montarPrevistos>> {
  return db(async ({ performance }) => {
    const { consulta, filtro } = await preparar(performance, ctx, entrada, agora);
    const catalogo = await performance.catalogo(ctx.empresaId);
    const base = { ...porEmissao(filtro), periodo: entrada.ignorarPeriodo ? null : filtro.periodo };
    const grupos = await performance.previstos(consulta, base, conjuntosDoCatalogo(catalogo));
    return montarPrevistos(grupos, catalogo, agora);
  });
}

/** Dia (no fuso da empresa) de agora + `horas`. */
function diaDaqui(agora: Date, horas: number, fuso: string): string {
  return hojeNoFuso(fuso, new Date(agora.getTime() + horas * 3_600_000));
}

/**
 * Banner de alertas: sempre por emissão.
 * origem: performance_alertas + performance_alerta_ocorrencia_13(_multipla) (sistema atual)
 */
export async function obterAlertas(
  db: Db,
  ctx: ContextoPerformance,
  entrada: FiltroPerformanceValidado,
  agora: Date,
): Promise<ReturnType<typeof montarAlertas>> {
  return db(async ({ performance }) => {
    const config = await performance.configuracoes(ctx.empresaId, CHAVES_DE_CONFIGURACAO);
    const limites = limitesDosAlertas(config);
    const { consulta, filtro } = await preparar(performance, ctx, entrada, agora);
    const conjuntos = conjuntosDoCatalogo(await performance.catalogo(ctx.empresaId));
    const janelas = janelasDosAlertas(entrada.inicio, entrada.fim, limites);
    const f = porEmissao(filtro);
    const porSigla = await performance.alertasPorEmissao(consulta, f, janelas, limites, conjuntos);
    const vencimento = diaDaqui(agora, limites.janelaVencimentoH, ctx.fuso);
    const abertos = await performance.alertasEmAberto(consulta, f, limites, conjuntos, vencimento);
    return montarAlertas(porSigla, abertos, limites);
  });
}

/**
 * Opções do seletor Ocorrência: período sempre por emissão (a tela não manda a base), sem o
 * próprio filtro de códigos. origem: performance_codigos_disponiveis (sistema atual)
 */
export async function obterCodigosDisponiveis(
  db: Db,
  ctx: ContextoPerformance,
  entrada: FiltroPerformanceValidado,
  agora: Date,
): Promise<CodigoDisponivel[]> {
  return db(async ({ performance }) => {
    const { consulta, filtro } = await preparar(performance, ctx, entrada, agora);
    const catalogo = await performance.catalogo(ctx.empresaId);
    const linhas = await performance.codigosDisponiveis(consulta, {
      ...porEmissao(filtro),
      codigos: null,
    });
    return ordenarCodigosDisponiveis(
      linhas.map((l) => ({
        codigo: String(l.codigo),
        descricao: descricaoDoCodigo(catalogo, l.codigo),
        qtd: l.qtd,
      })),
    );
  });
}

/** Contagem do seletor Tipo documento (sem códigos nem tipos). origem: performance_tipos_documento */
export async function obterTiposDocumento(
  db: Db,
  ctx: ContextoPerformance,
  entrada: FiltroPerformanceValidado,
  agora: Date,
): Promise<ContagemTipo[]> {
  return db(async ({ performance }) => {
    const { consulta, filtro } = await preparar(performance, ctx, entrada, agora);
    return performance.tiposDocumento(consulta, { ...filtro, codigos: null, tipos: null });
  });
}

/** Série do gráfico de evolução (Performance e Ranking). origem: sla_serie (sistema atual) */
export async function obterSerie(
  db: Db,
  ctx: ContextoPerformance,
  entrada: FiltroPerformanceValidado & { granularidade: Granularidade },
  agora: Date,
): Promise<PontoSerie[]> {
  return db(async ({ performance }) => {
    const { consulta, filtro } = await preparar(performance, ctx, entrada, agora);
    const pontos = await performance.serie(consulta, filtro, entrada.granularidade);
    return completarSerie(pontos, entrada.inicio, entrada.fim, entrada.granularidade);
  });
}

/** Uma foto do período para o relatório (principal ou comparativo). origem: computeSnapshot */
async function fotoDoPeriodo(
  performance: Repo,
  ctx: ContextoPerformance,
  entrada: FiltroPerformanceValidado,
  catalogo: readonly CodigoDoCatalogo[],
  agora: Date,
): Promise<FotoDoPeriodo> {
  const { consulta, filtro } = await preparar(performance, ctx, entrada, agora);
  const conjuntos = conjuntosDoCatalogo(catalogo);
  const grupos = await performance.contagensPorGrupo(
    consulta,
    filtro,
    conjuntos,
    codigosDePrejuizo(catalogo, filtro.codigos),
  );
  const totais = totaisDoResumo(grupos);
  const pont = montarPontualidade(await performance.pontualidade(consulta, filtro));

  const brutos = await performance.impacto(consulta, { ...filtro, codigos: null }, conjuntos);
  const impactoBruto: ImpactoBruto[] = brutos.flatMap((l) => {
    if (l.codigo === null || !/^\d+$/.test(l.codigo)) return [];
    const doCatalogo = catalogo.find((c) => c.codigo === Number(l.codigo));
    return [
      {
        codigo: l.codigo,
        descricao: doCatalogo?.descricao ?? null,
        penaliza: doCatalogo?.penaliza ?? false,
        totalCtrcs: l.totalCtrcs,
        totalPenalizantes: l.totalPenalizantes,
      },
    ];
  });
  const impacto = impactoDosCodigos(impactoBruto, entrada.codigos ?? null);

  const producao = await performance.producaoPorUnidade(consulta, { ...filtro, tipos: null });
  const finalizados = await performance.finalizadosPorCodigo(consulta, filtro, conjuntos);
  const previstosDe = async (ignorarPeriodo: boolean) =>
    montarPrevistos(
      await performance.previstos(
        consulta,
        { ...porEmissao(filtro), periodo: ignorarPeriodo ? null : filtro.periodo },
        conjuntos,
      ),
      catalogo,
      agora,
    );

  return {
    periodo: { inicio: entrada.inicio, fim: entrada.fim },
    atual: montarBloco(agregadosDeProducao(grupos), totais, pont),
    porUnidade: unidadesDoRelatorio(unidadesDoResumo(grupos), pont.porUnidade, producao),
    impactoCodigos: impacto.linhas,
    impactoTotalPeriodo: brutos.reduce((s, l) => s + l.totalCtrcs, 0),
    impactoBaseComOcorrencia: impacto.base,
    penalizantes: {
      ocorrencias: totais.ocorrenciasPenalizantes,
      ctrcsAfetados: totais.ctrcsPenalizados,
    },
    finalizadoPorCodigo: finalizados
      .map((f) => ({ ...f, descricao: descricaoDoCodigo(catalogo, f.codigo) }))
      .sort((a, b) => b.qtd - a.qtd || a.codigo - b.codigo),
    previstosTodos: await previstosDe(true),
    previstosPeriodo: await previstosDe(false),
  };
}

/**
 * Relatório de período: foto do período e, se pedido, do comparativo, com os mesmos filtros.
 * origem: getRelatorioSemanal / computeSnapshot (sistema atual)
 */
export async function obterRelatorio(
  db: Db,
  ctx: ContextoPerformance,
  entrada: FiltroPerformanceValidado & {
    comparativoInicio?: string | null | undefined;
    comparativoFim?: string | null | undefined;
  },
  agora: Date,
): Promise<RelatorioDoPeriodo> {
  return db(async ({ performance }) => {
    const config = configuracaoDaTela(
      await performance.configuracoes(ctx.empresaId, CHAVES_DE_CONFIGURACAO),
    );
    const catalogo = await performance.catalogo(ctx.empresaId);
    const principal = await fotoDoPeriodo(performance, ctx, entrada, catalogo, agora);
    const { comparativoInicio, comparativoFim } = entrada;
    const comparativo =
      comparativoInicio && comparativoFim
        ? await fotoDoPeriodo(
            performance,
            ctx,
            { ...entrada, inicio: comparativoInicio, fim: comparativoFim },
            catalogo,
            agora,
          )
        : null;
    return {
      ...principal,
      comparativo,
      limites: { slaMetaPct: config.slaMetaPct, taxaRetornoMetaPct: config.taxaRetornoMetaPct },
    };
  });
}

/**
 * Exportação da tela: os CT-e com as ocorrências de cada um. Decisões Q13 e Q18: segue o filtro
 * dos cards (universo da tela, filial efetiva, código da ocorrência efetiva), então cancelados e
 * cópias não saem mais.
 * origem: getExportacaoCtrcs, caminho da tela Performance (sistema atual)
 */
export async function exportarTela(
  db: Db,
  ctx: ContextoPerformance,
  entrada: FiltroPerformanceValidado,
  agora: Date,
): Promise<ExportacaoDaTela> {
  return db(async ({ performance }) => {
    const { consulta, filtro } = await preparar(performance, ctx, entrada, agora);
    const ctes = await performance.ctesParaExportar(
      consulta,
      porEmissao(filtro),
      LIMITE_DA_EXPORTACAO + 1,
    );
    const lote = ctes.slice(0, LIMITE_DA_EXPORTACAO);
    const ocorrencias = await performance.ocorrenciasDosCtes(lote.map((c) => c.id));
    const porCte = new Map<string, OcorrenciaExportada[]>();
    for (const o of ocorrencias) porCte.set(o.cteId, [...(porCte.get(o.cteId) ?? []), o]);
    return {
      ctes: lote.map((cte) => ({ cte, ocorrencias: porCte.get(cte.id) ?? [] })),
      truncado: ctes.length > LIMITE_DA_EXPORTACAO,
    };
  });
}
