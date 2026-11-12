import { createHash, randomBytes } from "node:crypto";

import { type LiberacaoDeModulo, modulosVigentes } from "@erp/dominio/acesso";
import { type FiltroCtrc, normalizarFiltro } from "@erp/dominio/performance/filtro";
import {
  agregarRanking,
  type BaldeRanking,
  type GrupoRanking,
  type RotuloRanking,
} from "@erp/dominio/ranking";
import {
  calcularBonificacaoDaEquipe,
  compararMembros,
  type CriterioDaRegra,
  posicaoDoNovoMembro,
  ranquearEquipes,
  regraVigente,
  type TotaisDaEquipe,
} from "@erp/dominio/ranking-equipes";
import { MODULOS } from "@erp/shared/acesso/modulos";
import { type EntradaDe, type SaidaDe } from "@erp/shared/contrato";
import {
  type CalculoDaEquipe,
  type contratosRanking,
  type Equipe,
  type LinhaDoRanking,
  type Membro,
  type Regra,
} from "@erp/shared/contratos/ranking";
import { hojeNoFuso } from "@erp/shared/datas";
import { type z } from "@erp/shared/zod";

import { type Ator } from "../auditoria/auditoria.service";
import { naoEncontrado } from "../erros";
import { type ContextoDaConsulta } from "../performance/consultas";
import { type Executor, type ExecutorComContexto } from "../repositorios";

type C = typeof contratosRanking;

export interface EquipeGravada {
  id: string;
  nome: string;
  unidadeId: string | null;
  ativo: boolean;
  tokenPublicoHash: string | null;
  tokenPublicoRevogado: boolean;
}

export interface MembroGravado extends Membro {
  dataSaida: string | null;
}

export interface FiltroDeAtribuicao {
  inicio: string;
  fim: string;
  somenteSemEquipe: boolean;
  unidadeId: string | null;
}

export interface DadosDaRegra {
  nome: string;
  descricao: string | null;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  ativo: boolean;
}

/** Filtro da tela Performance (mesmo universo e filtros) e quem consulta. */
export interface ConsultaDoRanking {
  filtro: FiltroCtrc;
  contexto: ContextoDaConsulta;
}

export interface RepositorioRanking {
  filiaisProprias(empresaId: string): Promise<string[]>;
  /** Códigos do catálogo da empresa com tipo BAIXA. */
  codigosBaixa(empresaId: string): Promise<number[]>;
  baldes(consulta: ConsultaDoRanking, grupo: GrupoRanking): Promise<BaldeRanking[]>;
  rotulos(consulta: ConsultaDoRanking, grupo: GrupoRanking): Promise<RotuloRanking[]>;

  equipes(empresaId: string): Promise<EquipeGravada[]>;
  equipe(empresaId: string, id: string): Promise<EquipeGravada | null>;
  membrosAtivos(empresaId: string): Promise<MembroGravado[]>;
  membro(empresaId: string, id: string): Promise<MembroGravado | null>;
  unidades(empresaId: string): Promise<{ id: string; nome: string }[]>;
  inserirEquipe(empresaId: string, dados: Omit<Equipe, "id" | "linkAtivo">): Promise<string>;
  alterarEquipe(id: string, dados: Omit<Equipe, "id" | "linkAtivo">): Promise<void>;
  inserirMembro(empresaId: string, dados: Omit<Membro, "id">): Promise<void>;
  encerrarMembro(id: string, dataSaida: string): Promise<void>;
  gravarLink(equipeId: string, link: { hash: string | null; revogado: boolean }): Promise<void>;
  ctesParaAtribuir(
    empresaId: string,
    filtro: FiltroDeAtribuicao,
  ): Promise<SaidaDe<C["ctesParaAtribuir"]>["ctes"]>;
  atribuirEquipe(empresaId: string, cteIds: string[], equipeId: string | null): Promise<number>;

  regras(empresaId: string): Promise<Regra[]>;
  regra(empresaId: string, id: string): Promise<Regra | null>;
  inserirRegra(empresaId: string, dados: DadosDaRegra): Promise<string>;
  alterarRegra(id: string, dados: DadosDaRegra): Promise<void>;
  substituirCriterios(
    empresaId: string,
    regraId: string,
    criterios: CriterioDaRegra[],
  ): Promise<void>;
  excluirRegra(id: string): Promise<void>;
  /** Totais por equipe (CT-e emitidos no período); equipe sem CT-e não aparece. */
  totaisPorEquipe(
    empresaId: string,
    equipeIds: string[],
    periodo: { inicio: string; fim: string; fuso: string },
  ): Promise<Map<string, TotaisDaEquipe>>;

  /** Rota pública: a equipe do link (a política RLS só mostra link não revogado). */
  equipePorToken(hash: string): Promise<{ id: string; empresaId: string } | null>;
}

/** Empresa e quem pede, já validados pela rota. */
export interface ContextoRanking {
  empresaId: string;
  fuso: string;
}

type Db = Executor<"ranking" | "auditoria">;

/* ============== Ranking operacional ============== */

const ESPERA_ANTES_DE_REPETIR_MS = 1_200;

export interface DependenciasOperacional {
  agora: Date;
  esperar: (ms: number) => Promise<void>;
  ehTempoEsgotado: (erro: unknown) => boolean;
}

/**
 * SLA por parceiro (pagador) ou por cidade, no universo e com os filtros da Performance. Timeout
 * da consulta: tenta de novo uma vez; se estourar de novo, devolve lista vazia (igual a hoje).
 * origem: getRankingOperacional + ranking_operacional (sistema atual)
 */
export async function rankingOperacional(
  db: Executor<"ranking">,
  ctx: ContextoRanking,
  entrada: z.output<C["operacional"]["entrada"]>,
  deps: DependenciasOperacional,
): Promise<LinhaDoRanking[]> {
  const consultar = () =>
    db(async ({ ranking }) => {
      const proprias = await ranking.filiaisProprias(ctx.empresaId);
      const consulta: ConsultaDoRanking = {
        // origem: _perf_filtro_ctrcs (o ranking_operacional usa o filtro da Performance)
        filtro: normalizarFiltro(
          {
            inicio: entrada.inicio,
            fim: entrada.fim,
            baseData: entrada.baseData,
            filiais: entrada.filiais,
            parceiros: entrada.pagadores,
            remetente: entrada.remetente,
            destino: entrada.destino,
            tipos: entrada.tipos,
          },
          proprias,
        ),
        contexto: {
          empresaId: ctx.empresaId,
          fuso: ctx.fuso,
          hoje: hojeNoFuso(ctx.fuso, deps.agora),
          filiaisProprias: proprias,
        },
      };
      const [baldes, rotulos, baixas] = await Promise.all([
        ranking.baldes(consulta, entrada.grupo),
        ranking.rotulos(consulta, entrada.grupo),
        ranking.codigosBaixa(ctx.empresaId),
      ]);
      return agregarRanking(baldes, rotulos, new Set(baixas));
    });
  try {
    return await consultar();
  } catch (erro) {
    if (!deps.ehTempoEsgotado(erro)) throw erro;
  }
  await deps.esperar(ESPERA_ANTES_DE_REPETIR_MS);
  try {
    return await consultar();
  } catch (erro) {
    if (deps.ehTempoEsgotado(erro)) return [];
    throw erro;
  }
}

/* ============== Equipes e membros ============== */

const EQUIPE_NAO_ENCONTRADA = "Equipe não encontrada.";

function paraEquipe(e: EquipeGravada): Equipe {
  return {
    id: e.id,
    nome: e.nome,
    unidadeId: e.unidadeId,
    ativo: e.ativo,
    linkAtivo: e.tokenPublicoHash !== null && !e.tokenPublicoRevogado,
  };
}

/**
 * Equipes, membros ativos (motorista primeiro, ajudantes pela posição) e unidades ativas. Escopo
 * por unidade/equipe desligado (Q26): quem tem a tela vê as equipes da empresa.
 * origem: listEquipes (ranking.functions.ts)
 */
export async function listarEquipes(
  db: Executor<"ranking">,
  ctx: ContextoRanking,
): Promise<SaidaDe<C["equipes"]>> {
  return db(async ({ ranking }) => {
    const [equipes, membros, unidades] = await Promise.all([
      ranking.equipes(ctx.empresaId),
      ranking.membrosAtivos(ctx.empresaId),
      ranking.unidades(ctx.empresaId),
    ]);
    return {
      equipes: equipes.map(paraEquipe),
      membros: [...membros].sort(compararMembros).map(({ dataSaida: _dataSaida, ...m }) => m),
      unidades,
    };
  });
}

async function equipeDaEmpresa(ranking: RepositorioRanking, ctx: ContextoRanking, id: string) {
  const equipe = await ranking.equipe(ctx.empresaId, id);
  if (!equipe) throw naoEncontrado(EQUIPE_NAO_ENCONTRADA);
  return equipe;
}

async function garantirUnidade(
  ranking: RepositorioRanking,
  ctx: ContextoRanking,
  unidadeId: string | null,
) {
  if (unidadeId === null) return;
  const unidades = await ranking.unidades(ctx.empresaId);
  if (!unidades.some((u) => u.id === unidadeId)) throw naoEncontrado("Unidade não encontrada.");
}

export async function salvarEquipe(
  db: Db,
  ctx: ContextoRanking,
  ator: Ator,
  entrada: z.output<C["salvarEquipe"]["entrada"]>,
): Promise<{ id: string }> {
  const dados = { nome: entrada.nome, unidadeId: entrada.unidadeId ?? null, ativo: entrada.ativo };
  return db(async ({ ranking, auditoria }) => {
    await garantirUnidade(ranking, ctx, dados.unidadeId);
    let id = entrada.id;
    let antes: EquipeGravada | null = null;
    if (id) {
      antes = await equipeDaEmpresa(ranking, ctx, id);
      await ranking.alterarEquipe(id, dados);
    } else {
      id = await ranking.inserirEquipe(ctx.empresaId, dados);
    }
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: antes ? "alterar" : "criar",
      entidade: "equipe",
      entidadeId: id,
      resumo: dados.nome,
      antes: antes ? { nome: antes.nome, unidadeId: antes.unidadeId, ativo: antes.ativo } : null,
      depois: dados,
    });
    return { id };
  });
}

/** origem: addMembro (ranking.functions.ts) */
export async function incluirMembro(
  db: Db,
  ctx: ContextoRanking,
  ator: Ator,
  equipeId: string,
  entrada: z.output<C["incluirMembro"]["entrada"]>,
): Promise<void> {
  await db(async ({ ranking, auditoria }) => {
    await equipeDaEmpresa(ranking, ctx, equipeId);
    const ocupadas = (await ranking.membrosAtivos(ctx.empresaId))
      .filter((m) => m.equipeId === equipeId && m.papel === "ajudante" && m.posicao !== null)
      .map((m) => m.posicao ?? 0);
    const posicao = posicaoDoNovoMembro(entrada.papel, ocupadas, entrada.posicao ?? null);
    const dados = {
      equipeId,
      nome: entrada.nome,
      papel: entrada.papel,
      cpf: entrada.cpf ?? null,
      posicao,
    };
    await ranking.inserirMembro(ctx.empresaId, dados);
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "incluir_membro",
      entidade: "equipe",
      entidadeId: equipeId,
      resumo: `${entrada.nome} (${entrada.papel})`,
      antes: null,
      depois: { nome: dados.nome, papel: dados.papel, posicao },
    });
  });
}

/** Saída do membro no dia de hoje no fuso da empresa (Q11; hoje gravava o dia UTC). */
export async function removerMembro(
  db: Db,
  ctx: ContextoRanking,
  ator: Ator,
  id: string,
  agora: Date,
): Promise<void> {
  await db(async ({ ranking, auditoria }) => {
    const membro = await ranking.membro(ctx.empresaId, id);
    if (!membro || membro.dataSaida !== null) throw naoEncontrado("Membro não encontrado.");
    const dataSaida = hojeNoFuso(ctx.fuso, agora);
    await ranking.encerrarMembro(id, dataSaida);
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "remover_membro",
      entidade: "equipe",
      entidadeId: membro.equipeId,
      resumo: membro.nome,
      antes: { nome: membro.nome, papel: membro.papel, posicao: membro.posicao },
      depois: { dataSaida },
    });
  });
}

/** SHA-256 do token do link: o banco nunca guarda o token. */
export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Link público novo (24 bytes aleatórios em hex). Gerar de novo troca o link: o anterior deixa
 * de abrir. O token só é devolvido agora; o banco guarda o hash.
 * origem: gerar_token_equipe (sistema atual)
 */
export async function gerarLink(
  db: Db,
  ctx: ContextoRanking,
  ator: Ator,
  equipeId: string,
): Promise<{ token: string }> {
  const token = randomBytes(24).toString("hex");
  await db(async ({ ranking, auditoria }) => {
    const equipe = await equipeDaEmpresa(ranking, ctx, equipeId);
    await ranking.gravarLink(equipeId, { hash: hashDoToken(token), revogado: false });
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "gerar_link",
      entidade: "equipe",
      entidadeId: equipeId,
      resumo: equipe.nome,
      antes: null,
      depois: null,
    });
  });
  return { token };
}

export async function revogarLink(
  db: Db,
  ctx: ContextoRanking,
  ator: Ator,
  equipeId: string,
): Promise<void> {
  await db(async ({ ranking, auditoria }) => {
    const equipe = await equipeDaEmpresa(ranking, ctx, equipeId);
    await ranking.gravarLink(equipeId, { hash: equipe.tokenPublicoHash, revogado: true });
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "revogar_link",
      entidade: "equipe",
      entidadeId: equipeId,
      resumo: equipe.nome,
      antes: null,
      depois: null,
    });
  });
}

/** origem: listCtrcsParaAtribuir (ranking.functions.ts) — até 500, emissão mais recente primeiro */
export async function ctesParaAtribuir(
  db: Executor<"ranking">,
  ctx: ContextoRanking,
  entrada: z.output<C["ctesParaAtribuir"]["entrada"]>,
): Promise<SaidaDe<C["ctesParaAtribuir"]>> {
  return db(async ({ ranking }) => ({
    ctes: await ranking.ctesParaAtribuir(ctx.empresaId, {
      inicio: entrada.inicio,
      fim: entrada.fim,
      somenteSemEquipe: entrada.somenteSemEquipe,
      unidadeId: entrada.unidadeId ?? null,
    }),
  }));
}

/**
 * Atribui (ou tira) a equipe dos CT-e escolhidos. Hoje não gravava nada (Q47); agora grava e
 * devolve quantos CT-e da empresa foram de fato alterados.
 */
export async function atribuirEquipe(
  db: Db,
  ctx: ContextoRanking,
  ator: Ator,
  entrada: EntradaDe<C["atribuir"]>,
): Promise<{ quantidade: number }> {
  return db(async ({ ranking, auditoria }) => {
    const equipe = entrada.equipeId ? await equipeDaEmpresa(ranking, ctx, entrada.equipeId) : null;
    const quantidade = await ranking.atribuirEquipe(
      ctx.empresaId,
      [...new Set(entrada.cteIds)],
      entrada.equipeId,
    );
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "atribuir_equipe",
      entidade: "cte",
      entidadeId: null,
      resumo: `${quantidade} CT-e ${equipe ? `atribuído(s) a ${equipe.nome}` : "sem equipe"}`,
      antes: null,
      depois: { equipeId: entrada.equipeId, cteIds: entrada.cteIds },
    });
    return { quantidade };
  });
}

/* ============== Regras e cálculo ============== */

export async function listarRegras(
  db: Executor<"ranking">,
  ctx: ContextoRanking,
): Promise<Regra[]> {
  return db(({ ranking }) => ranking.regras(ctx.empresaId));
}

/**
 * Grava a regra e troca os critérios (ordem = posição na lista), numa transação só (hoje o
 * delete dos critérios não era transacional e o erro dele era ignorado).
 * origem: upsertRegra (ranking.functions.ts)
 */
export async function salvarRegra(
  db: Db,
  ctx: ContextoRanking,
  ator: Ator,
  entrada: z.output<C["salvarRegra"]["entrada"]>,
): Promise<{ id: string }> {
  const dados: DadosDaRegra = {
    nome: entrada.nome,
    descricao: entrada.descricao || null,
    vigenciaInicio: entrada.vigenciaInicio,
    vigenciaFim: entrada.vigenciaFim ?? null,
    ativo: entrada.ativo,
  };
  return db(async ({ ranking, auditoria }) => {
    let id = entrada.id;
    let antes: Regra | null = null;
    if (id) {
      antes = await ranking.regra(ctx.empresaId, id);
      if (!antes) throw naoEncontrado("Regra não encontrada.");
      await ranking.alterarRegra(id, dados);
    } else {
      id = await ranking.inserirRegra(ctx.empresaId, dados);
    }
    await ranking.substituirCriterios(ctx.empresaId, id, entrada.criterios);
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: antes ? "alterar" : "criar",
      entidade: "regra_bonificacao",
      entidadeId: id,
      resumo: dados.nome,
      antes: antes ? { ...antes } : null,
      depois: { ...dados, criterios: entrada.criterios },
    });
    return { id };
  });
}

export async function excluirRegra(
  db: Db,
  ctx: ContextoRanking,
  ator: Ator,
  id: string,
): Promise<void> {
  await db(async ({ ranking, auditoria }) => {
    const antes = await ranking.regra(ctx.empresaId, id);
    if (!antes) throw naoEncontrado("Regra não encontrada.");
    await ranking.excluirRegra(id);
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "excluir",
      entidade: "regra_bonificacao",
      entidadeId: id,
      resumo: antes.nome,
      antes: { ...antes },
      depois: null,
    });
  });
}

const VAZIO: TotaisDaEquipe = { totalEntregas: 0, entregasNoPrazo: 0, penalizantes: 0 };

function criteriosDa(regra: Regra): CriterioDaRegra[] {
  return [...regra.criterios]
    .sort((a, b) => a.ordem - b.ordem)
    .map((c) => ({ criterio: c.criterio, parametros: c.parametros }));
}

function calculo(
  equipeId: string,
  regra: Regra,
  periodo: { inicio: string; fim: string },
  totais: TotaisDaEquipe,
): CalculoDaEquipe {
  return {
    equipeId,
    regraId: regra.id,
    periodoInicio: periodo.inicio,
    periodoFim: periodo.fim,
    ...calcularBonificacaoDaEquipe(totais, criteriosDa(regra)),
  };
}

async function regraDaEmpresa(ranking: RepositorioRanking, ctx: ContextoRanking, id: string) {
  const regra = await ranking.regra(ctx.empresaId, id);
  if (!regra) throw naoEncontrado("Regra não encontrada.");
  return regra;
}

/**
 * Cálculo da regra para cada equipe ativa (simulador e ranking do link público).
 * origem: calcular_bonificacao_lote (sistema atual)
 */
async function loteDaRegra(
  ranking: RepositorioRanking,
  ctx: ContextoRanking,
  regra: Regra,
  periodo: { inicio: string; fim: string },
): Promise<SaidaDe<C["simularRegra"]>> {
  const [equipes, membros, unidades] = await Promise.all([
    ranking.equipes(ctx.empresaId),
    ranking.membrosAtivos(ctx.empresaId),
    ranking.unidades(ctx.empresaId),
  ]);
  const ativas = equipes.filter((e) => e.ativo);
  const totais = await ranking.totaisPorEquipe(
    ctx.empresaId,
    ativas.map((e) => e.id),
    { ...periodo, fuso: ctx.fuso },
  );
  return {
    periodoInicio: periodo.inicio,
    periodoFim: periodo.fim,
    regraId: regra.id,
    equipes: ativas.map((e) => ({
      ...calculo(e.id, regra, periodo, totais.get(e.id) ?? VAZIO),
      nome: e.nome,
      unidadeId: e.unidadeId,
      unidadeNome: unidades.find((u) => u.id === e.unidadeId)?.nome ?? null,
      membros: membros
        .filter((m) => m.equipeId === e.id)
        .sort(compararMembros)
        .map((m) => ({ nome: m.nome, papel: m.papel })),
    })),
  };
}

export async function simularRegra(
  db: Executor<"ranking">,
  ctx: ContextoRanking,
  regraId: string,
  periodo: { inicio: string; fim: string },
): Promise<SaidaDe<C["simularRegra"]>> {
  return db(async ({ ranking }) =>
    loteDaRegra(ranking, ctx, await regraDaEmpresa(ranking, ctx, regraId), periodo),
  );
}

/** origem: calcEquipe + calcular_bonificacao (sistema atual) */
export async function calcularEquipe(
  db: Executor<"ranking">,
  ctx: ContextoRanking,
  equipeId: string,
  entrada: z.output<C["calculoDaEquipe"]["entrada"]>,
): Promise<SaidaDe<C["calculoDaEquipe"]>> {
  return db(async ({ ranking }) => {
    const equipe = await equipeDaEmpresa(ranking, ctx, equipeId);
    const regra = await regraDaEmpresa(ranking, ctx, entrada.regra);
    const periodo = { inicio: entrada.inicio, fim: entrada.fim };
    const totais = await ranking.totaisPorEquipe(ctx.empresaId, [equipeId], {
      ...periodo,
      fuso: ctx.fuso,
    });
    return {
      equipeNome: equipe.nome,
      totalEquipes: (await ranking.equipes(ctx.empresaId)).length,
      calculo: calculo(equipeId, regra, periodo, totais.get(equipeId) ?? VAZIO),
    };
  });
}

/* ============== Link público ============== */

const LINK_INVALIDO = "Link inválido ou expirado.";

export interface DependenciasPublico {
  executar: ExecutorComContexto<"ranking" | "acesso">;
  agora: () => Date;
}

/**
 * Ranking da equipe pelo link público, sem login. Acha a equipe pelo hash do token (contexto só
 * com o hash), confere o módulo Ranking da empresa dela e calcula no contexto dessa empresa.
 * origem: getRankingPublico + get_ranking_publico_por_token (sistema atual)
 */
export async function rankingPublico(
  deps: DependenciasPublico,
  token: string,
  periodo: { inicio: string; fim: string },
): Promise<SaidaDe<C["publico"]>> {
  const hash = hashDoToken(token);
  const achada = await deps.executar(
    { empresaId: null, usuarioId: null, plataforma: false, tokenPublicoHash: hash },
    ({ ranking }) => ranking.equipePorToken(hash),
  );
  if (!achada) throw naoEncontrado(LINK_INVALIDO);
  return deps.executar(
    { empresaId: achada.empresaId, usuarioId: null, plataforma: false },
    async ({ ranking, acesso }) => {
      const empresa = await acesso.empresa(achada.empresaId);
      if (!empresa) throw naoEncontrado(LINK_INVALIDO);
      if (!moduloRankingLiberado(await acesso.liberacoes(empresa.id), empresa.fuso, deps.agora())) {
        throw naoEncontrado("Este ranking não está disponível no momento. Fale com a sua empresa.");
      }
      const ctx = { empresaId: empresa.id, fuso: empresa.fuso };
      const equipe = await ranking.equipe(ctx.empresaId, achada.id);
      if (!equipe?.ativo) throw naoEncontrado(LINK_INVALIDO);
      const regra = regraVigente(await ranking.regras(ctx.empresaId), periodo.inicio, periodo.fim);
      if (!regra) throw naoEncontrado("Nenhuma regra vigente.");
      const lote = await loteDaRegra(ranking, ctx, regra, periodo);
      const ranqueadas = ranquearEquipes(lote.equipes);
      const indice = ranqueadas.findIndex((e) => e.equipeId === equipe.id);
      const daEquipe = ranqueadas[indice];
      if (!daEquipe) throw naoEncontrado(LINK_INVALIDO);
      const {
        nome: _nome,
        unidadeId: _u,
        unidadeNome: _un,
        membros: _m,
        ...calculoDaEquipe
      } = daEquipe;
      return {
        equipe: { id: equipe.id, nome: equipe.nome },
        periodo,
        calculo: calculoDaEquipe,
        posicao: indice + 1,
        totalEquipes: ranqueadas.length,
        top3: ranqueadas.slice(0, 3).map((e, i) => ({ posicao: i + 1, nome: e.nome })),
      };
    },
  );
}

function moduloRankingLiberado(liberacoes: LiberacaoDeModulo[], fuso: string, agora: Date) {
  return modulosVigentes(MODULOS, liberacoes, hojeNoFuso(fuso, agora)).includes("ranking");
}
