import {
  type CadastrosDoNucleo,
  type CteGravado,
  regravarCte,
  type RepositorioCteNucleo,
} from "@erp/dominio/nucleo";

export interface RepositorioRecalculo {
  /**
   * Regrava `penaliza`/`responsavel` de até `limite` ocorrências do código que divergem do
   * catálogo; devolve quantas regravou (zero = acabou).
   */
  propagarClassificacao(empresaId: string, codigo: number, limite: number): Promise<number>;
  /**
   * CT-e da empresa com o código numa ocorrência ou como efetiva, em ordem de id a partir de
   * `aposId`.
   */
  ctesDoCodigo(
    empresaId: string,
    codigo: number,
    aposId: string | null,
    limite: number,
  ): Promise<CteGravado[]>;
}

type ExecutorDoRecalculo = <T>(
  fn: (repositorios: {
    recalculo: RepositorioRecalculo;
    cteNucleo: RepositorioCteNucleo<CteGravado>;
  }) => Promise<T>,
) => Promise<T>;

/** Lote por transação: curto o bastante para não segurar trava nem estourar o timeout. */
export const TAMANHO_DO_LOTE = 10_000;

/**
 * Propaga a classificação do código do catálogo para as ocorrências, em lotes de transações
 * curtas; devolve quantas regravou. Lê o catálogo no momento, então repetir é seguro.
 * origem: propagate_codigo_changes (sistema atual)
 */
export async function propagarClassificacaoDoCodigo(
  db: ExecutorDoRecalculo,
  empresaId: string,
  codigo: number,
): Promise<number> {
  let total = 0;
  for (;;) {
    const regravadas = await db(({ recalculo }) =>
      recalculo.propagarClassificacao(empresaId, codigo, TAMANHO_DO_LOTE),
    );
    total += regravadas;
    if (regravadas < TAMANHO_DO_LOTE) break;
  }
  return total;
}

/** CT-e por transação no recálculo: cada um lê as ocorrências e pode gravar. */
export const LOTE_DE_CTES = 500;

/** Cadastros que o núcleo usa no recálculo (catálogo, filiais, regras...), lidos uma vez. */
export function cadastrosDoRecalculo(db: ExecutorDoRecalculo): Promise<CadastrosDoNucleo> {
  return db(({ cteNucleo }) => cteNucleo.cadastrosDoNucleo());
}

/**
 * Recalcula pelo núcleo (como numa gravação, fonte "outra") os CT-e que têm o código: a situação,
 * a descrição da efetiva e o status atual acompanham o catálogo (Q20). CT-e igual não é regravado.
 * Lotes de 500, cada um numa transação; devolve quantos gravou.
 */
export async function recalcularCtesPeloCodigo(
  db: ExecutorDoRecalculo,
  cadastros: CadastrosDoNucleo,
  empresaId: string,
  codigo: number,
  agora: () => Date,
): Promise<number> {
  let aposId: string | null = null;
  let gravados = 0;
  for (;;) {
    const lote: { ultimo: string | null; gravados: number } = await db(
      async ({ recalculo, cteNucleo }) => {
        const ctes = await recalculo.ctesDoCodigo(empresaId, codigo, aposId, LOTE_DE_CTES);
        const ocorrencias = await cteNucleo.ocorrenciasDosCtes(ctes.map((c) => c.id));
        let alterados = 0;
        for (const antigo of ctes) {
          const resultado = await regravarCte(
            cteNucleo,
            cadastros,
            antigo,
            {},
            ocorrencias.get(antigo.id) ?? [],
            agora(),
            { ocorrenciasMudaram: true },
          );
          if (resultado.tipo === "gravado") alterados++;
        }
        return { ultimo: ctes.at(-1)?.id ?? null, gravados: alterados };
      },
    );
    gravados += lote.gravados;
    if (!lote.ultimo) break;
    aposId = lote.ultimo;
  }
  return gravados;
}
