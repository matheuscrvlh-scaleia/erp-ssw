import { ErroDeNegocio } from "@erp/dominio/erros";
import {
  diasComContexto,
  garantirQuePodeAlterarAnotacao,
  nacionaisFixosDoAno,
} from "@erp/dominio/historico";
import { type SaidaDe } from "@erp/shared/contrato";
import { type Feriado, type TipoFeriado } from "@erp/shared/contratos/calendario";
import {
  type Anotacao,
  type contratosHistorico,
  type DadosDaAnotacao,
  LIMITE_DO_HISTORICO,
  type TipoAnotacao,
} from "@erp/shared/contratos/historico";

import { naoEncontrado } from "../../http/erros";
import { type Executor } from "../../repositorios";
import { type Ator } from "../auditoria/auditoria";
import { type FeriadoGravado } from "../calendario/casos-de-uso";

export interface AnotacaoGravada {
  id: string;
  data: string;
  tipo: TipoAnotacao;
  texto: string;
  autorId: string | null;
  unidadeId: string | null;
}

export interface FiltroDeFeriados {
  de: string;
  ate: string;
  tipo?: TipoFeriado;
  uf?: string;
}

export interface RepositorioHistorico {
  anotacoes(
    empresaId: string,
    filtro: { inicio: string; fim: string; unidades: string[] },
    limite: number,
  ): Promise<Anotacao[]>;
  /** Feriados visíveis (nacionais globais + os da empresa), da data mais recente. */
  feriados(empresaId: string, filtro: FiltroDeFeriados, limite: number): Promise<FeriadoGravado[]>;
  unidadesAtivas(empresaId: string): Promise<{ id: string; nome: string }[]>;
  unidadeDaEmpresa(empresaId: string, unidadeId: string): Promise<boolean>;
  /** Usuários da empresa com nome (filtro "Autor"). */
  autores(empresaId: string): Promise<{ id: string; nome: string }[]>;
  anotacao(empresaId: string, id: string): Promise<AnotacaoGravada | null>;
  criarAnotacao(nova: Omit<AnotacaoGravada, "id"> & { empresaId: string }): Promise<string>;
  alterarAnotacao(
    id: string,
    dados: Omit<AnotacaoGravada, "id" | "autorId">,
    agora: Date,
  ): Promise<void>;
  excluirAnotacao(id: string): Promise<void>;
}

export interface ContextoHistorico {
  empresaId: string;
  usuarioId: string;
  papel: string | null;
}

const PRIMEIRO_DIA = "0001-01-01";
const ULTIMO_DIA = "9999-12-31";

const semEmpresa = ({ empresaId: _empresaId, ...feriado }: FeriadoGravado): Feriado => feriado;

/** Corta no teto e diz se cortou (Q04 do dono: aviso em vez de corte silencioso). */
function noTeto<T>(linhas: T[]): { linhas: T[]; truncado: boolean } {
  return {
    linhas: linhas.slice(0, LIMITE_DO_HISTORICO),
    truncado: linhas.length > LIMITE_DO_HISTORICO,
  };
}

/**
 * Anotações e feriados do período (feriados não são filtrados por unidade), com unidades e
 * autores para os filtros. Tipo, autor, texto e presença são filtrados na tela.
 * origem: getHistorico (src/features/historico, sistema atual)
 */
export async function obterHistorico(
  db: Executor<"historico">,
  ctx: ContextoHistorico,
  filtro: { inicio: string; fim: string; unidades: string[] },
): Promise<SaidaDe<typeof contratosHistorico.obter>> {
  return db(async ({ historico }) => {
    const anotacoes = noTeto(
      await historico.anotacoes(ctx.empresaId, filtro, LIMITE_DO_HISTORICO + 1),
    );
    const feriados = noTeto(
      await historico.feriados(
        ctx.empresaId,
        { de: filtro.inicio, ate: filtro.fim },
        LIMITE_DO_HISTORICO + 1,
      ),
    );
    return {
      anotacoes: anotacoes.linhas,
      feriados: feriados.linhas.map(semEmpresa),
      unidades: await historico.unidadesAtivas(ctx.empresaId),
      autores: await historico.autores(ctx.empresaId),
      totais: {
        anotacoes: anotacoes.linhas.length,
        feriados: feriados.linhas.length,
        diasComContexto: diasComContexto(anotacoes.linhas, feriados.linhas),
      },
      truncado: anotacoes.truncado || feriados.truncado,
    };
  });
}

async function garantirUnidade(
  historico: RepositorioHistorico,
  empresaId: string,
  unidadeId: string | null,
): Promise<void> {
  if (unidadeId !== null && !(await historico.unidadeDaEmpresa(empresaId, unidadeId))) {
    throw new ErroDeNegocio("ENTRADA_INVALIDA", "Unidade não encontrada.");
  }
}

const resumo = (texto: string) => (texto.length > 120 ? `${texto.slice(0, 117)}...` : texto);

/** Anotação nova da empresa, com o usuário como autor. Auditada (Q32 do dono). */
export async function criarAnotacao(
  db: Executor<"historico" | "auditoria">,
  ctx: ContextoHistorico,
  ator: Ator,
  dados: DadosDaAnotacao,
): Promise<{ id: string }> {
  return db(async ({ historico, auditoria }) => {
    await garantirUnidade(historico, ctx.empresaId, dados.unidadeId);
    const nova = { ...dados, empresaId: ctx.empresaId, autorId: ctx.usuarioId };
    const id = await historico.criarAnotacao(nova);
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "criar",
      entidade: "anotacao",
      entidadeId: id,
      resumo: resumo(dados.texto),
      antes: null,
      depois: { ...dados },
    });
    return { id };
  });
}

async function anotacaoAlteravel(
  historico: RepositorioHistorico,
  ctx: ContextoHistorico,
  id: string,
): Promise<AnotacaoGravada> {
  const anotacao = await historico.anotacao(ctx.empresaId, id);
  if (!anotacao) throw naoEncontrado("Anotação não encontrada.");
  garantirQuePodeAlterarAnotacao(anotacao.autorId, ctx.usuarioId, ctx.papel);
  return anotacao;
}

/** Só o autor ou um administrador (Q09); o autor não muda. Auditada (Q32). */
export async function alterarAnotacao(
  db: Executor<"historico" | "auditoria">,
  ctx: ContextoHistorico,
  ator: Ator,
  id: string,
  dados: DadosDaAnotacao,
  agora: Date,
): Promise<void> {
  await db(async ({ historico, auditoria }) => {
    const { id: _id, autorId: _autorId, ...antes } = await anotacaoAlteravel(historico, ctx, id);
    await garantirUnidade(historico, ctx.empresaId, dados.unidadeId);
    await historico.alterarAnotacao(id, dados, agora);
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "alterar",
      entidade: "anotacao",
      entidadeId: id,
      resumo: resumo(dados.texto),
      antes: { ...antes },
      depois: { ...dados },
    });
  });
}

export async function excluirAnotacao(
  db: Executor<"historico" | "auditoria">,
  ctx: ContextoHistorico,
  ator: Ator,
  id: string,
): Promise<void> {
  await db(async ({ historico, auditoria }) => {
    const { id: _id, ...antes } = await anotacaoAlteravel(historico, ctx, id);
    await historico.excluirAnotacao(id);
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "excluir",
      entidade: "anotacao",
      entidadeId: id,
      resumo: resumo(antes.texto),
      antes: { ...antes },
      depois: null,
    });
  });
}

/**
 * Histórico › Feriados: feriados visíveis com filtro de ano, tipo e UF, do mais recente.
 * origem: listFeriados (src/features/historico, sistema atual)
 */
export async function listarFeriados(
  db: Executor<"historico">,
  ctx: ContextoHistorico,
  filtro: {
    ano?: number | undefined;
    tipo?: "nacional" | "municipal" | undefined;
    uf?: string | undefined;
  },
): Promise<SaidaDe<typeof contratosHistorico.listarFeriados>> {
  return db(async ({ historico }) => {
    const { linhas, truncado } = noTeto(
      await historico.feriados(
        ctx.empresaId,
        {
          de: filtro.ano ? `${filtro.ano}-01-01` : PRIMEIRO_DIA,
          ate: filtro.ano ? `${filtro.ano}-12-31` : ULTIMO_DIA,
          ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
          ...(filtro.uf ? { uf: filtro.uf } : {}),
        },
        LIMITE_DO_HISTORICO + 1,
      ),
    );
    return {
      feriados: linhas.map((f) => ({ ...semEmpresa(f), global: f.empresaId === null })),
      truncado,
    };
  });
}

/**
 * Grava na empresa os 9 nacionais fixos do ano que ainda não existem (mesma data e descrição
 * entre os nacionais visíveis).
 * origem: importarFeriadosNacionais (src/features/historico, sistema atual)
 */
export async function importarNacionaisFixos(
  db: Executor<"historico" | "calendario" | "auditoria">,
  ctx: ContextoHistorico,
  ator: Ator,
  ano: number,
): Promise<{ inseridos: number }> {
  return db(async ({ historico, calendario, auditoria }) => {
    const existentes = new Set(
      (
        await historico.feriados(
          ctx.empresaId,
          { de: `${ano}-01-01`, ate: `${ano}-12-31`, tipo: "nacional" },
          LIMITE_DO_HISTORICO,
        )
      ).map((f) => `${f.data}|${f.descricao}`),
    );
    const novos = nacionaisFixosDoAno(ano)
      .filter((f) => !existentes.has(`${f.data}|${f.descricao}`))
      .map((f) => ({
        ...f,
        empresaId: ctx.empresaId,
        tipo: "nacional" as const,
        cidade: null,
        uf: null,
        geradoAutomaticamente: false,
      }));
    const inseridos = novos.length > 0 ? await calendario.inserir(novos) : 0;
    if (inseridos > 0) {
      await auditoria.registrar(ator, {
        empresaId: ctx.empresaId,
        acao: "importar_nacionais",
        entidade: "feriado",
        entidadeId: null,
        resumo: `${inseridos} feriado(s) nacional(is) de ${ano} importado(s) na empresa`,
        antes: null,
        depois: { datas: novos.map((n) => n.data) },
      });
    }
    return { inseridos };
  });
}
