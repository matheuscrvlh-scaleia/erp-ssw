import { mudancaParaAuditoria, type Registro } from "@erp/dominio/auditoria";
import { chaveDaRegra, normalizarRegra } from "@erp/dominio/prazos-configurados";
import { type SaidaDe } from "@erp/shared/contrato";
import {
  type contratosAdmin,
  type DadosDoPrazo,
  type PrazoConfigurado,
} from "@erp/shared/contratos/admin";
import { JOB_RECALCULAR_PRAZOS } from "@erp/shared/jobs";

import { conflito, naoEncontrado } from "../../http/erros";
import type { FilaDeJobs } from "../../infra/fila";
import { type Executor } from "../../repositorios";
import { type Ator, type RepositorioAuditoria } from "../auditoria/auditoria";

/*
 * Admin › Configurações › Prazos configurados. Gravar uma regra só grava a regra; a previsão dos
 * CT-e é recalculada pelo worker (job da empresa), que aplica todas as regras ativas de uma vez:
 * vale para regra nova, alterada, ligada, desligada ou apagada (sem regra, volta a previsão do
 * SSW — decisão Q19). CT-e e chegada novos recebem a regra na ingestão, pela mesma função do
 * núcleo (`definirPrevisao`).
 * origem: prazos.functions.ts (sistema atual)
 */

export type RegraGravada = Omit<PrazoConfigurado, "atualizadoEm"> & {
  criadoEm: Date;
  atualizadoEm: Date;
};

export interface RepositorioPrazos {
  regras(empresaId: string): Promise<RegraGravada[]>;
  regra(empresaId: string, id: string): Promise<RegraGravada | null>;
  criar(empresaId: string, dados: DadosDoPrazo): Promise<string>;
  alterar(empresaId: string, id: string, dados: DadosDoPrazo): Promise<void>;
  ligar(empresaId: string, id: string, ativo: boolean): Promise<void>;
  excluir(empresaId: string, id: string): Promise<void>;
  /** Filiais dos CT-e da empresa, com a cidade (a primeira não vazia), em ordem de código. */
  unidadesDosCtes(empresaId: string): Promise<{ codigo: string; cidade: string }[]>;
  /** Parceiros dos CT-e da empresa (CNPJ distinto, nome não vazio), em ordem de nome. */
  parceirosDosCtes(empresaId: string): Promise<{ cnpj: string; nome: string }[]>;
}

type Db = Executor<"prazos" | "auditoria">;
type Resultado = SaidaDe<typeof contratosAdmin.criarPrazo>;

const naoAchada = () => naoEncontrado("Regra não encontrada nesta empresa.");

const ORDEM_DO_TIPO = { unidade: 1, transbordo: 2, parceiro: 3 } as const;

function paraSaida({ criadoEm: _criadoEm, ...r }: RegraGravada): PrazoConfigurado {
  return { ...r, atualizadoEm: r.atualizadoEm.toISOString() };
}

function registroDaRegra(r: DadosDoPrazo): Registro {
  return {
    tipo: r.tipo,
    unidade_codigo: r.unidadeCodigo,
    unidade_destino_codigo: r.unidadeDestinoCodigo,
    parceiro_cnpj: r.parceiroCnpj,
    parceiro_nome: r.parceiroNome,
    prazo_horas: r.prazoHoras,
    prazo_dias: r.prazoDias,
    ativo: r.ativo,
  };
}

async function registrar(
  auditoria: RepositorioAuditoria,
  ator: Ator,
  empresaId: string,
  id: string,
  acao: "criar" | "alterar" | "excluir",
  antes: DadosDoPrazo | null,
  depois: DadosDoPrazo | null,
): Promise<void> {
  const mudanca = mudancaParaAuditoria({
    acao,
    antes: antes && registroDaRegra(antes),
    depois: depois && registroDaRegra(depois),
  });
  if (!mudanca) return;
  await auditoria.registrar(ator, {
    empresaId,
    acao,
    entidade: "prazo_configurado",
    entidadeId: id,
    resumo: null,
    ...mudanca,
  });
}

async function agendarRecalculo(fila: FilaDeJobs, empresaId: string): Promise<boolean> {
  return fila.enfileirar(JOB_RECALCULAR_PRAZOS, { empresaId }).catch(() => false);
}

/** Uma regra por unidade, por parceiro e por rota: a repetida vira aviso, não erro técnico. */
async function exigirSemRepeticao(
  prazos: RepositorioPrazos,
  empresaId: string,
  dados: DadosDoPrazo,
  exceto: string | null,
): Promise<void> {
  const chave = chaveDaRegra(dados);
  const repetida = (await prazos.regras(empresaId)).some(
    (r) => r.id !== exceto && chaveDaRegra(r) === chave,
  );
  if (repetida) throw conflito("Já existe uma regra para esta unidade, parceiro ou rota.");
}

/**
 * Regras da empresa (por tipo e mais recentes antes) e as opções de unidade e parceiro, de todos
 * os CT-e da empresa (decisão P10: hoje saíam de só 1000 CT-e).
 */
export async function listarPrazos(
  db: Executor<"prazos">,
  empresaId: string,
): Promise<SaidaDe<typeof contratosAdmin.listarPrazos>> {
  return db(async ({ prazos }) => {
    const regras = (await prazos.regras(empresaId)).sort(
      (a, b) =>
        ORDEM_DO_TIPO[a.tipo] - ORDEM_DO_TIPO[b.tipo] ||
        b.atualizadoEm.getTime() - a.atualizadoEm.getTime(),
    );
    return {
      regras: regras.map(paraSaida),
      unidades: await prazos.unidadesDosCtes(empresaId),
      parceiros: await prazos.parceirosDosCtes(empresaId),
    };
  });
}

export async function criarPrazo(
  db: Db,
  fila: FilaDeJobs,
  empresaId: string,
  ator: Ator,
  entrada: DadosDoPrazo,
): Promise<Resultado> {
  const dados = normalizarRegra(entrada);
  const id = await db(async ({ prazos, auditoria }) => {
    await exigirSemRepeticao(prazos, empresaId, dados, null);
    const novo = await prazos.criar(empresaId, dados);
    await registrar(auditoria, ator, empresaId, novo, "criar", null, dados);
    return novo;
  });
  return { id, recalculoAgendado: await agendarRecalculo(fila, empresaId) };
}

export async function alterarPrazo(
  db: Db,
  fila: FilaDeJobs,
  empresaId: string,
  ator: Ator,
  id: string,
  entrada: DadosDoPrazo,
): Promise<Resultado> {
  const dados = normalizarRegra(entrada);
  await db(async ({ prazos, auditoria }) => {
    const antes = await prazos.regra(empresaId, id);
    if (!antes) throw naoAchada();
    await exigirSemRepeticao(prazos, empresaId, dados, id);
    await prazos.alterar(empresaId, id, dados);
    await registrar(auditoria, ator, empresaId, id, "alterar", antes, dados);
  });
  return { id, recalculoAgendado: await agendarRecalculo(fila, empresaId) };
}

export async function ligarPrazo(
  db: Db,
  fila: FilaDeJobs,
  empresaId: string,
  ator: Ator,
  id: string,
  ativo: boolean,
): Promise<Resultado> {
  await db(async ({ prazos, auditoria }) => {
    const antes = await prazos.regra(empresaId, id);
    if (!antes) throw naoAchada();
    await prazos.ligar(empresaId, id, ativo);
    await registrar(auditoria, ator, empresaId, id, "alterar", antes, { ...antes, ativo });
  });
  return { id, recalculoAgendado: await agendarRecalculo(fila, empresaId) };
}

export async function excluirPrazo(
  db: Db,
  fila: FilaDeJobs,
  empresaId: string,
  ator: Ator,
  id: string,
): Promise<Resultado> {
  await db(async ({ prazos, auditoria }) => {
    const antes = await prazos.regra(empresaId, id);
    if (!antes) throw naoAchada();
    await prazos.excluir(empresaId, id);
    await registrar(auditoria, ator, empresaId, id, "excluir", antes, null);
  });
  return { id, recalculoAgendado: await agendarRecalculo(fila, empresaId) };
}
