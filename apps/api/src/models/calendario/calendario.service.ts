import {
  anosAte,
  AVISO_FERIADO_NACIONAL,
  chaveDoFeriado,
  contarPorTipo,
  datasDaRecorrencia,
  feriadosNacionaisDoAno,
  type LocalDoFeriado,
  normalizarLocal,
} from "@erp/dominio/calendario";
import {
  type DadosDoFeriado,
  type Feriado,
  type TipoFeriado,
  type UnidadeDoCalendario,
} from "@erp/shared/contratos/calendario";
import { hojeNoFuso } from "@erp/shared/datas";

import { type Ator } from "../auditoria/auditoria.service";
import { conflito, naoEncontrado, semPermissao } from "../erros";
import { type Executor } from "../repositorios";

const FERIADO_REPETIDO = "Já existe um feriado igual nesta data.";

export interface FeriadoGravado extends Feriado {
  empresaId: string | null;
}

export interface NovoFeriado {
  empresaId: string | null;
  data: string;
  tipo: TipoFeriado;
  cidade: string | null;
  uf: string | null;
  descricao: string;
  geradoAutomaticamente: boolean;
}

/**
 * Os repositórios recebem a empresa (vê os gerais + os dela) ou `null` (só os gerais, de empresa
 * nula, que valem para todas as empresas).
 */
export interface RepositorioCalendario {
  /** Feriados gerais (empresa nula) e os da empresa, em ordem de data. */
  feriados(empresaId: string | null, de: string, ate: string): Promise<FeriadoGravado[]>;
  proximo(empresaId: string, aPartirDe: string): Promise<FeriadoGravado | null>;
  unidadesAtivas(empresaId: string): Promise<UnidadeDoCalendario[]>;
  feriado(empresaId: string | null, id: string): Promise<FeriadoGravado | null>;
  /** Chaves (`chaveDoFeriado`) que já existem para as datas e o tipo, entre os visíveis. */
  chavesExistentes(
    empresaId: string | null,
    datas: string[],
    tipo: TipoFeriado,
  ): Promise<Set<string>>;
  /** Insere ignorando os que já existem; devolve quantos entraram. */
  inserir(feriados: NovoFeriado[]): Promise<number>;
  alterar(id: string, dados: Omit<NovoFeriado, "empresaId">): Promise<void>;
  excluir(id: string): Promise<void>;
}

/** Empresa e permissões de quem pede, já validadas pela rota. */
export interface ContextoCalendario {
  empresaId: string;
  fuso: string;
  plataforma: boolean;
}

/**
 * Onde a escrita acontece: na empresa (que também enxerga os gerais) ou, com `empresaId` nulo,
 * nos feriados gerais (Plataforma › Configurações).
 */
export interface EscopoDoFeriado {
  empresaId: string | null;
  plataforma: boolean;
}

/** Feriados gerais: só a equipe da Plataforma chega aqui (a rota exige o admin da Plataforma). */
export const ESCOPO_GERAL: EscopoDoFeriado = { empresaId: null, plataforma: true };

type Db = Executor<"calendario" | "auditoria">;

/** Retrato do feriado para a auditoria (a empresa já vai na linha do registro). */
function semEmpresa({ empresaId: _empresaId, ...feriado }: FeriadoGravado): Feriado {
  return feriado;
}

export interface CalendarioDoAno {
  ano: number;
  feriados: FeriadoGravado[];
  unidades: UnidadeDoCalendario[];
  contagens: ReturnType<typeof contarPorTipo>;
  proximo: FeriadoGravado | null;
}

/**
 * Feriados do ano, unidades ativas (para "unidades impactadas"), contagem por tipo e o próximo.
 * origem: getCalendario (src/features/calendario, sistema atual)
 */
export async function obterCalendario(
  db: Executor<"calendario">,
  ctx: ContextoCalendario,
  ano: number,
  agora: Date,
): Promise<CalendarioDoAno> {
  return db(async ({ calendario }) => {
    const feriados = await calendario.feriados(ctx.empresaId, `${ano}-01-01`, `${ano}-12-31`);
    return {
      ano,
      feriados,
      unidades: await calendario.unidadesAtivas(ctx.empresaId),
      contagens: contarPorTipo(feriados),
      proximo: await calendario.proximo(ctx.empresaId, hojeNoFuso(ctx.fuso, agora)),
    };
  });
}

/** Feriados gerais do ano (empresa nula), em ordem de data. */
export async function listarFeriadosGerais(
  db: Executor<"calendario">,
  ano: number,
): Promise<FeriadoGravado[]> {
  return db(({ calendario }) => calendario.feriados(null, `${ano}-01-01`, `${ano}-12-31`));
}

/**
 * Feriado novo da empresa (ou geral, no escopo da Plataforma); recorrente repete o mesmo dia nos
 * anos seguintes. Datas que já têm o mesmo feriado são puladas.
 * origem: upsertFeriadoCal (src/features/calendario, sistema atual)
 */
export async function criarFeriado(
  db: Db,
  ctx: EscopoDoFeriado,
  ator: Ator,
  entrada: DadosDoFeriado & { recorrente: boolean; anosAFrente: number },
): Promise<{ inseridos: number; atualizados: number }> {
  const local = normalizarLocal(entrada.tipo, entrada.cidade, entrada.uf);
  const datas = datasDaRecorrencia(entrada.data, entrada.recorrente ? entrada.anosAFrente : 0);
  return db(async ({ calendario, auditoria }) => {
    const existentes = await calendario.chavesExistentes(ctx.empresaId, datas, entrada.tipo);
    const novos = datas
      .map((data) => ({ data, tipo: entrada.tipo, ...local }))
      .filter((f) => !existentes.has(chaveDoFeriado(f)))
      .map((f) => ({
        ...f,
        empresaId: ctx.empresaId,
        descricao: entrada.descricao,
        geradoAutomaticamente: false,
      }));
    if (novos.length === 0) throw conflito(FERIADO_REPETIDO);
    const inseridos = await calendario.inserir(novos);
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "criar",
      entidade: "feriado",
      entidadeId: null,
      resumo: `${inseridos} feriado(s) inserido(s): ${entrada.descricao}`,
      antes: null,
      depois: { datas: novos.map((n) => n.data), tipo: entrada.tipo, ...local },
    });
    return { inseridos, atualizados: 0 };
  });
}

/** Feriado nacional (empresa nula) vale para todas as empresas: só a Plataforma mexe. */
async function feriadoEditavel(
  calendario: RepositorioCalendario,
  ctx: EscopoDoFeriado,
  id: string,
): Promise<FeriadoGravado> {
  const feriado = await calendario.feriado(ctx.empresaId, id);
  if (!feriado) throw naoEncontrado("Feriado não encontrado.");
  if (feriado.empresaId === null && !ctx.plataforma) throw semPermissao(AVISO_FERIADO_NACIONAL);
  return feriado;
}

/** Mudar data/tipo/local para os de outro feriado do mesmo escopo daria duplicata. */
async function garantirQueNaoRepete(
  calendario: RepositorioCalendario,
  ctx: EscopoDoFeriado,
  antes: FeriadoGravado,
  depois: { data: string; tipo: TipoFeriado } & LocalDoFeriado,
): Promise<void> {
  const chave = chaveDoFeriado(depois);
  if (chave === chaveDoFeriado(antes)) return;
  const existentes = await calendario.chavesExistentes(ctx.empresaId, [depois.data], depois.tipo);
  if (existentes.has(chave)) throw conflito(FERIADO_REPETIDO);
}

export async function alterarFeriado(
  db: Db,
  ctx: EscopoDoFeriado,
  ator: Ator,
  id: string,
  dados: DadosDoFeriado,
): Promise<{ inseridos: number; atualizados: number }> {
  const local = normalizarLocal(dados.tipo, dados.cidade, dados.uf);
  return db(async ({ calendario, auditoria }) => {
    const antes = await feriadoEditavel(calendario, ctx, id);
    await garantirQueNaoRepete(calendario, ctx, antes, {
      data: dados.data,
      tipo: dados.tipo,
      ...local,
    });
    const depois = {
      data: dados.data,
      tipo: dados.tipo,
      ...local,
      descricao: dados.descricao,
      geradoAutomaticamente: false,
    };
    await calendario.alterar(id, depois);
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "alterar",
      entidade: "feriado",
      entidadeId: id,
      resumo: dados.descricao,
      antes: semEmpresa(antes),
      depois,
    });
    return { inseridos: 0, atualizados: 1 };
  });
}

export async function excluirFeriado(
  db: Db,
  ctx: EscopoDoFeriado,
  ator: Ator,
  id: string,
): Promise<void> {
  await db(async ({ calendario, auditoria }) => {
    const antes = await feriadoEditavel(calendario, ctx, id);
    await calendario.excluir(id);
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "excluir",
      entidade: "feriado",
      entidadeId: id,
      resumo: antes.descricao,
      antes: semEmpresa(antes),
      depois: null,
    });
  });
}

/**
 * Gera os feriados nacionais do ano e dos seguintes (empresa nula: valem para todas). Os que já
 * existem ficam como estão.
 * origem: gerarNacionaisLote + gerar_feriados_nacionais (sistema atual)
 */
export async function gerarNacionais(
  db: Db,
  ator: Ator,
  ano: number,
  anosAFrente: number,
): Promise<{ inseridos: number; existiam: number; anos: number[] }> {
  const anos = anosAte(ano, anosAFrente);
  const feriados = anos.flatMap(feriadosNacionaisDoAno).map((f) => ({
    ...f,
    empresaId: null,
    tipo: "nacional" as const,
    cidade: null,
    uf: null,
    geradoAutomaticamente: true,
  }));
  return db(async ({ calendario, auditoria }) => {
    const inseridos = await calendario.inserir(feriados);
    // Nacional vale para todas as empresas: o registro é da Plataforma (empresa nula).
    await auditoria.registrar(ator, {
      empresaId: null,
      acao: "gerar_nacionais",
      entidade: "feriado",
      entidadeId: null,
      resumo: `${inseridos} feriado(s) nacional(is) gerado(s) para ${anos.join(", ")}`,
      antes: null,
      depois: null,
    });
    return { inseridos, existiam: feriados.length - inseridos, anos };
  });
}
