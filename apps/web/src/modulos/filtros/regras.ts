/**
 * Regras dos seletores de filtro (busca, nomes nas etiquetas).
 * origem: PagadorPicker.tsx e FiltrosAvancados.tsx (sistema atual)
 */
import { type PagadorOpcao } from "@erp/shared/contratos/filtros";

/** Sem acento, minúsculo, sem espaço nas pontas. */
export const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const digitos = (texto: string) => texto.replace(/\D+/g, "");

/** Pagadores em ordem alfabética, filtrados por nome (sem acento) ou CNPJ (com ou sem pontuação). */
export function filtrarPagadores(opcoes: readonly PagadorOpcao[], termo: string): PagadorOpcao[] {
  const ordenados = [...opcoes].sort((a, b) =>
    normalizar(a.nome).localeCompare(normalizar(b.nome)),
  );
  const t = termo.trim();
  if (!t) return ordenados;
  const nome = normalizar(t);
  const numeros = digitos(t);
  return ordenados.filter(
    (o) =>
      (nome !== "" && normalizar(o.nome).includes(nome)) ||
      (numeros !== "" && digitos(o.id).includes(numeros)) ||
      o.cnpjFormatado.toLowerCase().includes(t.toLowerCase()),
  );
}

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
