/**
 * Gravação de CT-e pelo núcleo (`prepararGravacaoDoCte`): trava do BI2, data mínima, derivados,
 * "não grava linha igual" e histórico de previsão na mesma transação. Usada pelos jobs de recálculo
 * do ERP e copiada no worker-ssw (ADR 0012): mudança de regra aqui vai aos dois.
 */
import { type FonteDaEscrita } from "./bi2";
import { type FilialCadastrada } from "./cadastros";
import { type CatalogoDeCodigos } from "./codigos";
import { type ConfiguracaoDoNucleo } from "./configuracao";
import { type CteNucleo, type MotivoDoDescarte, prepararGravacaoDoCte } from "./derivar-cte";
import { type OcorrenciaDoCte } from "./ocorrencia";
import { type RegraDePrazo, type TrocaDePrevisao } from "./prazo";

/** Linha de `ctes` como o repositório a lê: o núcleo e a identidade. */
export interface CteGravado extends CteNucleo {
  id: string;
  empresaId: string;
  sigla: string;
  numero: string;
  atualizadoEm: Date;
}

/** Campos que a gravação pode mudar (identidade e empresa ficam de fora). */
export type CamposDoCte<C extends CteGravado> = Partial<Omit<C, "id" | "empresaId" | "criadoEm">>;

/** Cadastros da empresa que o núcleo lê antes de gravar. */
export interface CadastrosDoNucleo {
  catalogo: CatalogoDeCodigos;
  filiais: readonly FilialCadastrada[];
  regrasDePrazo: readonly RegraDePrazo[];
  config: ConfiguracaoDoNucleo;
  /** CNPJs (dígitos) da própria empresa: `empresas.cnpj` + `cnpjs_emitentes` da integração XML. */
  cnpjsProprios: readonly string[];
  /** Domínio da empresa no SSW (a ocorrência do webhook decide a filial por ele). */
  dominioSsw: string | null;
}

/** O que a gravação pede ao banco, preso a uma transação no contexto da empresa (RLS). */
export interface RepositorioCteNucleo<C extends CteGravado> {
  cadastrosDoNucleo(): Promise<CadastrosDoNucleo>;
  ocorrenciasDosCtes(ids: readonly string[]): Promise<Map<string, OcorrenciaDoCte[]>>;
  /** INSERT ... ON CONFLICT (empresa, sigla, número) DO NOTHING; devolve os que entraram. */
  inserirCtes(ctes: readonly C[]): Promise<C[]>;
  /** Grava só as colunas dadas (o caso de uso já tirou as iguais). */
  atualizarCte(id: string, campos: CamposDoCte<C>): Promise<void>;
  registrarTrocaDePrevisao(cteId: string, troca: TrocaDePrevisao): Promise<void>;
}

function igual(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => igual(v, b[i]));
  }
  return a === b;
}

/** Só as colunas que mudaram (o UPDATE não regrava o que está igual). */
function camposQueMudaram<C extends CteGravado>(antigo: C, novo: C): CamposDoCte<C> {
  const saida: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(novo)) {
    if (campo === "id" || campo === "empresaId" || campo === "criadoEm") continue;
    if (!igual(antigo[campo as keyof C], valor)) saida[campo] = valor;
  }
  return saida as CamposDoCte<C>;
}

type ResultadoDaGravacao<C extends CteGravado> =
  { tipo: "descartado"; motivo: MotivoDoDescarte } | { tipo: "igual" | "gravado"; cte: C };

/**
 * Aplica `campos` no CT-e já gravado pelo núcleo e grava a diferença (com `atualizado_em`) e o
 * histórico de previsão. `fonte` decide o que o BI2 pode mudar (padrão: arquivos do SSW, webhook,
 * XML); `ajustar` mexe no resultado do núcleo antes de gravar (ex.: `campos_ssw`);
 * `ocorrenciasMudaram` = esta gravação mexeu nas ocorrências do CT-e (refaz o `status_atual`).
 */
export async function regravarCte<C extends CteGravado>(
  repo: RepositorioCteNucleo<C>,
  cad: CadastrosDoNucleo,
  antigo: C,
  campos: CamposDoCte<C>,
  ocorrencias: readonly OcorrenciaDoCte[],
  agora: Date,
  opcoes: {
    fonte?: FonteDaEscrita;
    ajustar?: (cte: C) => CamposDoCte<C>;
    ocorrenciasMudaram?: boolean;
  } = {},
): Promise<ResultadoDaGravacao<C>> {
  const g = prepararGravacaoDoCte({
    antigo,
    novo: { ...antigo, ...campos },
    fonte: opcoes.fonte ?? "outra",
    contexto: { ...cad, ocorrencias, ocorrenciasMudaram: opcoes.ocorrenciasMudaram ?? false },
  });
  if (g.tipo === "descartar") return { tipo: "descartado", motivo: g.motivo };
  const final = opcoes.ajustar ? { ...g.cte, ...opcoes.ajustar(g.cte) } : g.cte;
  const mudou = camposQueMudaram(antigo, final);
  if (Object.keys(mudou).length === 0) return { tipo: "igual", cte: antigo };
  await repo.atualizarCte(antigo.id, { ...mudou, atualizadoEm: agora });
  if (g.trocaDePrevisao) await repo.registrarTrocaDePrevisao(antigo.id, g.trocaDePrevisao);
  return { tipo: "gravado", cte: { ...final, atualizadoEm: agora } };
}
