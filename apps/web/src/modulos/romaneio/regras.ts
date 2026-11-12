/**
 * Regras da tela Romaneio: situação, seleção e ordenação da lista da aba Total, percentuais
 * das abas de desempenho e a entrada da aba Hoje.
 */
import { type LinhaSituacao } from "@erp/dominio/romaneio/linha";
import { type LinhaDoDia, type LinhaLista, type OrdemLista } from "@erp/shared/contratos/romaneio";

export const situacaoDe = (l: LinhaLista): LinhaSituacao => ({
  ...l,
  ultimaOcorrenciaCodigo: l.ultimaOcorrencia?.codigo ?? null,
});

// ---------------------------------------------------------------------------------------------
// Seleção para exportar

/**
 * Guardada por id (sobrevive à troca de página). "todas": tudo marcado, `ids` são as desmarcadas;
 * "somente": a caixa do cabeçalho desmarcou tudo, `ids` são as marcadas depois. `chave` são os
 * filtros em que a seleção foi feita: mudou o filtro, volta para "todas".
 */
export interface Selecao {
  chave: string;
  modo: "todas" | "somente";
  ids: ReadonlySet<string>;
}

export const selecaoInicial = (chave: string): Selecao => ({
  chave,
  modo: "todas",
  ids: new Set(),
});

export const estaMarcada = (s: Selecao, id: string) =>
  s.modo === "todas" ? !s.ids.has(id) : s.ids.has(id);

export function alternarLinha(s: Selecao, id: string): Selecao {
  const ids = new Set(s.ids);
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  return { ...s, ids };
}

/** Quantas linhas da lista inteira (todas as páginas) saem no arquivo. */
export const quantasMarcadas = (s: Selecao, total: number) =>
  s.modo === "todas" ? Math.max(0, total - s.ids.size) : s.ids.size;

/** Caixa do cabeçalho: vale para a lista inteira, não só a página visível. */
export const estadoDoCabecalho = (s: Selecao): boolean | "indeterminate" =>
  s.ids.size === 0 ? s.modo === "todas" : "indeterminate";

export const alternarTodas = (s: Selecao): Selecao => ({
  chave: s.chave,
  modo: estadoDoCabecalho(s) === true ? "somente" : "todas",
  ids: new Set(),
});

// ---------------------------------------------------------------------------------------------
// Ordenação

/** Clicar na coluna já ordenada inverte o sentido; outra coluna começa crescente. */
export function proximaOrdem(
  atual: { ordem?: OrdemLista | undefined; dir: "asc" | "desc" },
  coluna: OrdemLista,
): { ordem: OrdemLista; dir: "asc" | "desc" } {
  if (atual.ordem === coluna) return { ordem: coluna, dir: atual.dir === "asc" ? "desc" : "asc" };
  return { ordem: coluna, dir: "asc" };
}

export const pctDe = (parte: number, todo: number) => (todo > 0 ? (parte / todo) * 100 : null);

/** % de entregas prejudicadas; a Performance é o complemento (100 − %). */
export const pctPrejudicada = (r: { romaneados: number; prejudicadas: number }) =>
  r.romaneados > 0 ? (100 * r.prejudicadas) / r.romaneados : 0;

/** Unidade e tipo de documento da aba Hoje (ficam só na visita à aba, fora da URL). */
export interface FiltrosHoje {
  filiais: string[];
  tipos: string[];
}

export const FILTROS_DA_HOJE_VAZIOS: FiltrosHoje = { filiais: [], tipos: [] };

export const entradaDaHoje = ({ filiais, tipos }: FiltrosHoje) => ({
  ...(filiais.length > 0 ? { filiais } : {}),
  ...(tipos.length > 0 ? { tipos } : {}),
});

/**
 * Bairros em no máximo 3 linhas: a coluna cresce até 60ch; passou disso, a célula mostra 3
 * linhas e o clique abre a lista inteira.
 */
export function larguraBairros(textos: readonly (string | null)[]): string {
  const maior = Math.max(0, ...textos.map((t) => t?.length ?? 0));
  return `${Math.min(60, Math.max(18, Math.ceil(maior / 3) + 4))}ch`;
}

export const ajudantesDa = (l: LinhaDoDia) =>
  [l.ajudante, l.ajudante2, l.ajudante3].filter((a): a is string => !!a);
