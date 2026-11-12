import {
  apurarBonificacao,
  type BaldeDaViagem,
  type EfeitoBonificacao,
  type Falta as FaltaDoCalculo,
  type HoraExtraDoDia,
  parametrosVigentes,
} from "@erp/dominio/bonificacao-entrega";
import {
  type Falta,
  type ParametrosDeBonificacao,
} from "@erp/shared/contratos/bonificacao-entrega";

import { type ClienteAhgora } from "../../infra/ahgora";
import { calcularHorasExtras } from "../ahgora/ahgora.service";
import { type Ator } from "../auditoria/auditoria.service";
import { naoEncontrado } from "../erros";
import { type Executor } from "../repositorios";

export interface PeriodoDaApuracao {
  inicio: string;
  fim: string;
  /** Siglas de unidade do romaneio (3 letras); nulo = todas. */
  unidades: string[] | null;
  fuso: string;
}

/** Unidade com romaneio 036, quantos e o último dia (seletor da apuração). */
export interface UnidadeDoRomaneio {
  unidade: string;
  romaneios: number;
  ultimoDia: string;
}

export interface PedidoDeApuracao {
  inicio: string;
  fim: string;
  unidades?: string[] | undefined;
  usarPonto: boolean;
}

export type NovaFalta = Pick<Falta, "colaboradorNome" | "dataFalta" | "tipo"> & {
  observacao?: string | null | undefined;
};

export interface RepositorioBonificacaoEntrega {
  unidades(empresaId: string): Promise<UnidadeDoRomaneio[]>;
  parametros(empresaId: string): Promise<ParametrosDeBonificacao[]>;
  /** Nomes distintos (sem espaços nas pontas) de motorista e ajudantes do 036 no período. */
  colaboradores(empresaId: string, periodo: PeriodoDaApuracao): Promise<string[]>;
  /** CT-e distintos por viagem e código da ocorrência do dia (no fuso da empresa). */
  baldes(empresaId: string, periodo: PeriodoDaApuracao): Promise<BaldeDaViagem[]>;
  efeitos(empresaId: string): Promise<{ codigo: number; efeito: EfeitoBonificacao }[]>;
  todasAsFaltas(empresaId: string): Promise<FaltaDoCalculo[]>;
  faltas(empresaId: string, inicio: string, fim: string): Promise<Falta[]>;
  falta(empresaId: string, id: string): Promise<Falta | null>;
  /** Uma falta por pessoa e dia: registrar de novo atualiza tipo e observação. */
  gravarFalta(empresaId: string, dados: Omit<Falta, "id">, registradoPor: string): Promise<string>;
  excluirFalta(id: string): Promise<void>;
}

export interface ContextoBonificacao {
  empresaId: string;
  fuso: string;
}

export async function listarUnidades(
  db: Executor<"bonificacaoEntrega">,
  ctx: ContextoBonificacao,
): Promise<UnidadeDoRomaneio[]> {
  return db(({ bonificacaoEntrega }) => bonificacaoEntrega.unidades(ctx.empresaId));
}

export async function listarParametros(
  db: Executor<"bonificacaoEntrega">,
  ctx: ContextoBonificacao,
): Promise<ParametrosDeBonificacao[]> {
  return db(({ bonificacaoEntrega }) => bonificacaoEntrega.parametros(ctx.empresaId));
}

/**
 * Apuração do bônus. Com o ponto ligado, descobre quem rodou no período (consulta leve), pergunta
 * ao Ahgora a hora extra de cada um e só então calcula; sem o ponto ninguém chega a Turbo.
 * origem: apurarBonificacao (bonificacao.functions.ts) + bonificacao_apurar (sistema atual)
 */
export async function apurar(
  db: Executor<"bonificacaoEntrega">,
  ctx: ContextoBonificacao,
  entrada: PedidoDeApuracao,
  ahgora: () => Promise<ClienteAhgora>,
): Promise<ReturnType<typeof apurarBonificacao>> {
  const periodo: PeriodoDaApuracao = {
    inicio: entrada.inicio,
    fim: entrada.fim,
    unidades: entrada.unidades?.length ? entrada.unidades.map((u) => u.toUpperCase()) : null,
    fuso: ctx.fuso,
  };
  let horasExtras: HoraExtraDoDia[] = [];
  if (entrada.usarPonto) {
    const nomes = await db(({ bonificacaoEntrega }) =>
      bonificacaoEntrega.colaboradores(ctx.empresaId, periodo),
    );
    horasExtras = await calcularHorasExtras(await ahgora(), { ...periodo, nomes });
  }
  return db(async ({ bonificacaoEntrega: repo }) => {
    const parametros = parametrosVigentes(
      await repo.parametros(ctx.empresaId),
      periodo.inicio,
      periodo.fim,
    );
    const [baldes, efeitos, faltas] = await Promise.all([
      repo.baldes(ctx.empresaId, periodo),
      repo.efeitos(ctx.empresaId),
      repo.todasAsFaltas(ctx.empresaId),
    ]);
    return apurarBonificacao({
      baldes,
      efeitos: new Map(efeitos.map((e) => [e.codigo, e.efeito])),
      parametros,
      horasExtras,
      faltas,
    });
  });
}

export async function listarFaltas(
  db: Executor<"bonificacaoEntrega">,
  ctx: ContextoBonificacao,
  periodo: { inicio: string; fim: string },
): Promise<Falta[]> {
  return db(({ bonificacaoEntrega }) =>
    bonificacaoEntrega.faltas(ctx.empresaId, periodo.inicio, periodo.fim),
  );
}

/** Falta registrada pela tela (hoje não havia tela: a regra nunca agia — Q47). */
export async function registrarFalta(
  db: Executor<"bonificacaoEntrega" | "auditoria">,
  ctx: ContextoBonificacao,
  ator: Ator,
  entrada: NovaFalta,
): Promise<{ id: string }> {
  const dados = {
    colaboradorNome: entrada.colaboradorNome.toUpperCase(),
    dataFalta: entrada.dataFalta,
    tipo: entrada.tipo,
    observacao: entrada.observacao || null,
  };
  return db(async ({ bonificacaoEntrega, auditoria }) => {
    const id = await bonificacaoEntrega.gravarFalta(ctx.empresaId, dados, ator.usuarioId);
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "registrar_falta",
      entidade: "bonificacao_falta",
      entidadeId: id,
      resumo: `${dados.colaboradorNome} em ${dados.dataFalta}`,
      antes: null,
      depois: dados,
    });
    return { id };
  });
}

export async function excluirFalta(
  db: Executor<"bonificacaoEntrega" | "auditoria">,
  ctx: ContextoBonificacao,
  ator: Ator,
  id: string,
): Promise<void> {
  await db(async ({ bonificacaoEntrega, auditoria }) => {
    const antes = await bonificacaoEntrega.falta(ctx.empresaId, id);
    if (!antes) throw naoEncontrado("Falta não encontrada.");
    await bonificacaoEntrega.excluirFalta(id);
    await auditoria.registrar(ator, {
      empresaId: ctx.empresaId,
      acao: "excluir",
      entidade: "bonificacao_falta",
      entidadeId: id,
      resumo: `${antes.colaboradorNome} em ${antes.dataFalta}`,
      antes: { ...antes },
      depois: null,
    });
  });
}
