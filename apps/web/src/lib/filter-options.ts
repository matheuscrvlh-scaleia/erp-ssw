/**
 * Regras dos seletores de filtro (busca, nomes nas etiquetas).
 * origem: PagadorPicker.tsx e FiltrosAvancados.tsx (sistema atual)
 */
import { type PagadorOpcao } from "@erp/shared/contracts/filters";

/** Nomes dos parceiros marcados; CNPJ que não está nas opções do período aparece como CNPJ. */
export function nomesDosPagadores(
  opcoes: readonly PagadorOpcao[],
  marcados: readonly string[],
): string[] {
  const porId = new Map(opcoes.map((o) => [o.id, o.nome]));
  const nomes: string[] = [];
  for (const id of marcados) {
    const nome = porId.get(id) ?? id;
    if (!nomes.includes(nome)) nomes.push(nome);
  }
  return nomes;
}

/** Parceiros de mesmo nome (matriz e filiais, CNPJs diferentes) reunidos numa opção só. */
export interface GrupoDePagadores {
  /** Valor da opção no seletor: os CNPJs do grupo (assim a busca por CNPJ também casa). */
  valor: string;
  nome: string;
  /** CNPJs do grupo: são eles que vão para o filtro `parceiros`. */
  ids: string[];
  /** CNPJ formatado quando o grupo tem um só. */
  cnpjFormatado: string | null;
}

/**
 * Nome sem acento, minúsculo, com espaços únicos: a chave do agrupamento. Tira só as marcas
 * combinantes (U+0300–U+036F), como hoje: "^" e "`" soltos continuam no nome.
 */
function chaveDoNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Seletor "Parceiros agrupados": uma opção por nome; marcar o nome marca todos os CNPJs que o usam.
 * Ordem alfabética sem acento. origem: agruparPagadoresPorNome (PagadorPicker.tsx, sistema atual)
 */
export function agruparPagadoresPorNome(opcoes: readonly PagadorOpcao[]): GrupoDePagadores[] {
  return [...gruposNaOrdemDasOpcoes(opcoes).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, g]) => ({
      valor: g.opcoes.map((o) => o.id).join(","),
      nome: g.nome,
      ids: g.opcoes.map((o) => o.id),
      cnpjFormatado: g.opcoes.length === 1 ? (g.opcoes[0]?.cnpjFormatado ?? null) : null,
    }));
}

/** Grupos pela chave do nome, na ordem em que o primeiro CNPJ de cada um aparece nas opções. */
function gruposNaOrdemDasOpcoes(
  opcoes: readonly PagadorOpcao[],
): Map<string, { nome: string; opcoes: PagadorOpcao[] }> {
  const grupos = new Map<string, { nome: string; opcoes: PagadorOpcao[] }>();
  for (const o of opcoes) {
    const chave = chaveDoNome(o.nome || o.id);
    const grupo = grupos.get(chave);
    if (grupo) grupo.opcoes.push(o);
    else grupos.set(chave, { nome: o.nome || o.id, opcoes: [o] });
  }
  return grupos;
}

/** Opções marcadas no seletor agrupado a partir dos CNPJs marcados (CNPJ fora do período fica). */
export function gruposMarcados(
  grupos: readonly GrupoDePagadores[],
  marcados: readonly string[],
): string[] {
  const grupoDe = new Map(grupos.flatMap((g) => g.ids.map((id) => [id, g.valor] as const)));
  return [...new Set(marcados.map((id) => grupoDe.get(id) ?? id))];
}

/**
 * CNPJs depois de mudar as opções marcadas no seletor agrupado: o grupo desmarcado sai inteiro, o
 * recém-marcado entra com todos os CNPJs e os demais ficam como estavam.
 */
export function cnpjsDosGrupos(
  grupos: readonly GrupoDePagadores[],
  marcados: readonly string[],
  valores: readonly string[],
): string[] {
  const escolhidos = new Set(valores);
  const anteriores = new Set(gruposMarcados(grupos, marcados));
  const grupoDe = new Map(grupos.flatMap((g) => g.ids.map((id) => [id, g.valor] as const)));
  const ficam = marcados.filter((id) => escolhidos.has(grupoDe.get(id) ?? id));
  const novos = grupos.filter((g) => escolhidos.has(g.valor) && !anteriores.has(g.valor));
  return [...ficam, ...novos.flatMap((g) => g.ids)];
}

/**
 * Nomes dos parceiros marcados com os CNPJs de mesmo nome (sem acento/caixa/espaço extra) contados
 * como um, na ordem das opções; CNPJ fora do período aparece como CNPJ. Vale para os dois
 * seletores do Ranking e para o escopo do gráfico mês a mês.
 * origem: nomesPagadoresSelecionados (PagadorPicker.tsx)
 */
export function nomesDosPagadoresAgrupados(
  opcoes: readonly PagadorOpcao[],
  marcados: readonly string[],
): string[] {
  if (marcados.length === 0) return [];
  const marcado = new Set(marcados);
  const nomes = [...gruposNaOrdemDasOpcoes(opcoes).values()]
    .filter((g) => g.opcoes.some((o) => marcado.has(o.id)))
    .map((g) => g.nome);
  const conhecidos = new Set(opcoes.map((o) => o.id));
  return [...nomes, ...marcados.filter((id) => !conhecidos.has(id))];
}

/** Filtro de parceiros da tela: a união dos CNPJs dos dois seletores, sem repetição. */
export function unirParceiros(porCnpj: readonly string[], agrupados: readonly string[]): string[] {
  return [...new Set([...porCnpj, ...agrupados])].sort();
}

/**
 * Siglas do seletor "Unidade responsável": as do período mais as já marcadas que sejam filiais
 * próprias (a marcada continua visível para poder desmarcar).
 */
export function siglasDoSeletor(
  doPeriodo: readonly string[],
  marcadas: readonly string[],
  proprias: readonly string[],
): string[] {
  const siglas = new Set(doPeriodo);
  const ehPropria = new Set(proprias.map((s) => s.toUpperCase()));
  for (const s of marcadas) {
    const sigla = s.trim().toUpperCase();
    if (sigla && ehPropria.has(sigla)) siglas.add(sigla);
  }
  return [...siglas].sort((a, b) => a.localeCompare(b));
}
