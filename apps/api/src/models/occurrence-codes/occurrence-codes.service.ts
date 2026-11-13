import {
  alteracaoDoLote,
  type ClassificacaoDoCodigo,
  diferencas,
  efeitoDaAlteracao,
  estatisticasDoCatalogo,
  historicoDoCodigo,
  registroAuditavel,
  type RegistroDeAuditoria,
  RESPONSAVEL_DA_LETRA,
} from "@erp/domain/occurrences/admin-codes";
import {
  type AlteracaoDoCodigo,
  type contratosCodigosOcorrencia,
  type EstatisticasDoCatalogo,
} from "@erp/shared/contracts/occurrence-codes";
import { JOB_PROPAGAR_CLASSIFICACAO, JOB_RECALCULAR_CTES_DO_CODIGO } from "@erp/shared/jobs";
import { type z } from "@erp/shared/zod";

import { type FilaDeJobs } from "../../infra/queue";
import { type Ator } from "../audit/audit.service";
import { type Executor } from "../repositories";

export interface CodigoGravado extends ClassificacaoDoCodigo {
  codigo: number;
  tipoSsw: string | null;
  processoSsw: string | null;
  atualizadoEm: Date;
  atualizadoPorNome: string | null;
}

export interface CodigoComFrequencia extends CodigoGravado {
  /** Ocorrências do código nos últimos 30 dias. */
  frequencia30d: number;
}

export interface CatalogoDeCodigos {
  codigos: CodigoComFrequencia[];
  estatisticas: EstatisticasDoCatalogo;
}

export interface RepositorioCodigosOcorrencia {
  listar(empresaId: string): Promise<CodigoGravado[]>;
  codigos(empresaId: string, codigos: number[]): Promise<CodigoGravado[]>;
  /** Ocorrências (fora de quarentena) desde `desde`, por código. */
  ocorrenciasPorCodigo(empresaId: string, desde: Date): Promise<Map<number, number>>;
  contarOcorrencias(empresaId: string, codigos: number[]): Promise<number>;
  /** Insere o código ou substitui a classificação (não mexe nos campos do SSW). */
  gravar(
    empresaId: string,
    codigo: number,
    dados: ClassificacaoDoCodigo,
    usuarioId: string,
    agora: Date,
  ): Promise<void>;
  /** Copia a classificação do catálogo para as ocorrências do código que estão diferentes. */
  propagarClassificacao(empresaId: string, codigo: number): Promise<number>;
  historico(empresaId: string, codigo: number, limite: number): Promise<RegistroDeAuditoria[]>;
}

export interface ContextoCodigos {
  empresaId: string;
  usuarioId: string;
}

/** Até aqui a cópia para as ocorrências vai na mesma transação; acima, vai para o worker. */
const LIMITE_DE_PROPAGACAO_IMEDIATA = 20_000;

type Db = Executor<"codigosOcorrencia" | "auditoria">;

const TRINTA_DIAS_MS = 30 * 86_400_000;

/**
 * Catálogo com frequência real dos últimos 30 dias (Q04 do dono) e os cards do topo.
 * origem: getCodigosOcorrencia + get_codigos_admin_stats (sistema atual)
 */
export async function listarCodigos(
  db: Executor<"codigosOcorrencia">,
  ctx: ContextoCodigos,
  agora: Date,
): Promise<CatalogoDeCodigos> {
  return db(async ({ codigosOcorrencia }) => {
    const catalogo = await codigosOcorrencia.listar(ctx.empresaId);
    const frequencia = await codigosOcorrencia.ocorrenciasPorCodigo(
      ctx.empresaId,
      new Date(agora.getTime() - TRINTA_DIAS_MS),
    );
    return {
      codigos: catalogo.map((c) => ({ ...c, frequencia30d: frequencia.get(c.codigo) ?? 0 })),
      estatisticas: estatisticasDoCatalogo(catalogo, frequencia),
    };
  });
}

/** Histórico do código só na empresa ativa, mesmo para a Plataforma (Q31 do dono). */
export async function historicoDoCodigoNaEmpresa(
  db: Executor<"codigosOcorrencia">,
  ctx: ContextoCodigos,
  codigo: number,
): Promise<AlteracaoDoCodigo[]> {
  return db(async ({ codigosOcorrencia }) =>
    historicoDoCodigo(await codigosOcorrencia.historico(ctx.empresaId, codigo, 200)),
  );
}

export interface DependenciasCodigos {
  /**
   * Desligada sem Redis (desenvolvimento): a cópia vai sempre na transação e os CT-e não são
   * recalculados (o recálculo é do worker).
   */
  fila: FilaDeJobs;
}

/**
 * Regrava penaliza/responsável nas ocorrências dos códigos cuja classificação mudou: na própria
 * transação se for pouco, no worker se for muito.
 * origem: propagate_codigo_changes (sistema atual)
 */
async function propagar(
  repo: RepositorioCodigosOcorrencia,
  deps: DependenciasCodigos,
  empresaId: string,
  codigos: number[],
): Promise<() => Promise<void>> {
  if (codigos.length === 0) return () => Promise.resolve();
  const afetadas = await repo.contarOcorrencias(empresaId, codigos);
  const { fila } = deps;
  if (fila.ligada && afetadas > LIMITE_DE_PROPAGACAO_IMEDIATA) {
    // Enfileira depois do commit: o worker precisa ler o catálogo já gravado.
    return async () => {
      await fila.enfileirar(JOB_PROPAGAR_CLASSIFICACAO, { empresaId, codigos });
    };
  }
  for (const codigo of codigos) await repo.propagarClassificacao(empresaId, codigo);
  return () => Promise.resolve();
}

/**
 * Salva a classificação de um código (modal e classificação rápida). Sempre limpa "pendente de
 * classificação"; "novo código" com número existente substitui o existente (como hoje).
 * origem: updateCodigoOcorrencia (src/features/admin/codigos, sistema atual)
 */
export async function salvarCodigo(
  db: Db,
  deps: DependenciasCodigos,
  ctx: ContextoCodigos,
  ator: Ator,
  codigo: number,
  entrada: z.output<typeof contratosCodigosOcorrencia.salvar.entrada>,
  agora: Date,
): Promise<{ afetadas: number }> {
  const depois: ClassificacaoDoCodigo = {
    descricao: entrada.descricao,
    responsavel: RESPONSAVEL_DA_LETRA[entrada.letra],
    penaliza: entrada.penaliza,
    letraResponsavel: entrada.letra,
    ativo: entrada.ativo,
    pendenteClassificacao: false,
    notas: entrada.notas,
  };
  const { afetadas, depoisDoCommit } = await db(async ({ codigosOcorrencia, auditoria }) => {
    const [antes] = await codigosOcorrencia.codigos(ctx.empresaId, [codigo]);
    await codigosOcorrencia.gravar(ctx.empresaId, codigo, depois, ctx.usuarioId, agora);
    const mudou = antes ? diferencas(registroAuditavel(antes), registroAuditavel(depois)) : null;
    if (!antes || mudou) {
      await auditoria.registrar(ator, {
        empresaId: ctx.empresaId,
        acao: antes ? "alterar" : "criar",
        entidade: "codigo_ocorrencia",
        entidadeId: String(codigo),
        resumo: `Código ${codigo}: ${depois.descricao}`,
        antes: mudou?.antes ?? null,
        depois: mudou?.depois ?? { codigo, ...registroAuditavel(depois) },
      });
    }
    // Código novo ainda não tem ocorrência (a ocorrência exige o código no catálogo).
    const efeito = antes ? efeitoDaAlteracao(codigo, antes, depois) : null;
    const precisaPropagar = efeito?.regravarOcorrencias != null;
    const propagacao = await propagar(
      codigosOcorrencia,
      deps,
      ctx.empresaId,
      precisaPropagar ? [codigo] : [],
    );
    return {
      afetadas: await codigosOcorrencia.contarOcorrencias(ctx.empresaId, [codigo]),
      // Depois do commit: o worker lê o catálogo já gravado. A propagação (mesma fila) vem antes.
      depoisDoCommit: async () => {
        await propagacao();
        if (efeito?.recalcularCtes) {
          await deps.fila.enfileirar(JOB_RECALCULAR_CTES_DO_CODIGO, {
            empresaId: ctx.empresaId,
            codigos: [codigo],
          });
        }
      },
    };
  });
  await depoisDoCommit();
  return { afetadas };
}

/**
 * Ativar/desativar ou ligar/desligar "penaliza" em vários códigos da empresa. Auditoria por
 * código alterado.
 * origem: bulkUpdateCodigos (src/features/admin/codigos, sistema atual)
 */
export async function alterarEmLote(
  db: Db,
  deps: DependenciasCodigos,
  ctx: ContextoCodigos,
  ator: Ator,
  entrada: z.output<typeof contratosCodigosOcorrencia.lote.entrada>,
  agora: Date,
): Promise<{ alterados: number }> {
  const alteracao = alteracaoDoLote(entrada.acao);
  const { alterados, depoisDoCommit } = await db(async ({ codigosOcorrencia, auditoria }) => {
    const atuais = await codigosOcorrencia.codigos(ctx.empresaId, entrada.codigos);
    const mudancas = atuais.flatMap((antes) => {
      const depois = { ...antes, ...alteracao };
      const mudou = diferencas(registroAuditavel(antes), registroAuditavel(depois));
      return mudou ? [{ antes, depois, mudou }] : [];
    });
    for (const { antes, depois, mudou } of mudancas) {
      await codigosOcorrencia.gravar(ctx.empresaId, antes.codigo, depois, ctx.usuarioId, agora);
      await auditoria.registrar(ator, {
        empresaId: ctx.empresaId,
        acao: "alterar",
        entidade: "codigo_ocorrencia",
        entidadeId: String(antes.codigo),
        resumo: `Código ${antes.codigo}: ${entrada.acao}`,
        antes: mudou.antes,
        depois: mudou.depois,
      });
    }
    const aPropagar = mudancas
      .filter(
        ({ antes, depois }) => efeitoDaAlteracao(antes.codigo, antes, depois).regravarOcorrencias,
      )
      .map(({ antes }) => antes.codigo);
    return {
      alterados: mudancas.length,
      depoisDoCommit: await propagar(codigosOcorrencia, deps, ctx.empresaId, aPropagar),
    };
  });
  await depoisDoCommit();
  return { alterados };
}
