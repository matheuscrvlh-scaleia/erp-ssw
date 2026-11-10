/**
 * Regras dos seletores de filtro (busca, nomes nas etiquetas).
 * origem: PagadorPicker.tsx e FiltrosAvancados.tsx (sistema atual)
 */
import { type PagadorOpcao } from "@erp/shared/contratos/filtros";

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
