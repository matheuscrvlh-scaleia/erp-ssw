import { calcularPermissoes } from "@erp/dominio/acesso";
import {
  type Acao,
  ACOES_DA_TELA,
  chavesDoItem,
  type Efeito,
  ehPermissao,
  type Permissao,
  permissao,
} from "@erp/shared/acesso/permissoes";
import { type Tela } from "@erp/shared/acesso/telas";
import { type ExcecaoDePermissaoGravada } from "@erp/shared/contratos/admin";

/*
 * Peças das telas de Usuários e cargos: um item do editor é uma tela (o Ranking leva junto a chave
 * gêmea `ranking_novo`); cada item tem as ações dele (tela só de leitura: só "Ver").
 */

/** Permissões que um item (tela) liga para a ação: o Ranking liga as duas chaves. */
export function permissoesDoItem(tela: Tela, acao: Acao): Permissao[] {
  return chavesDoItem(tela)
    .filter((t) => ACOES_DA_TELA[t].includes(acao))
    .map((t) => permissao(t, acao));
}

export function temAcao(conjunto: ReadonlySet<string>, tela: Tela, acao: Acao): boolean {
  return conjunto.has(permissao(tela, acao));
}

/**
 * Liga ou desliga uma ação no editor do cargo. Ligar Criar/Editar ou Excluir liga o Ver (não dá
 * para editar o que não se vê); desligar o Ver desliga o resto.
 */
export function alternarAcao(
  conjunto: ReadonlySet<Permissao>,
  tela: Tela,
  acao: Acao,
  ligar: boolean,
): Set<Permissao> {
  const proximo = new Set(conjunto);
  const acoes: readonly Acao[] = ligar
    ? acao === "ver"
      ? ["ver"]
      : ["ver", acao]
    : acao === "ver"
      ? ACOES_DA_TELA[tela]
      : [acao];
  for (const a of acoes) {
    for (const p of permissoesDoItem(tela, a)) {
      if (ligar) proximo.add(p);
      else proximo.delete(p);
    }
  }
  return proximo;
}

/**
 * Célula da matriz: liga Ver e Criar/Editar; desligar tira tudo da tela. Excluir só no editor do
 * cargo, para um clique na matriz nunca liberar exclusão.
 */
export function alternarNaMatriz(
  conjunto: ReadonlySet<Permissao>,
  tela: Tela,
  ligar: boolean,
): Set<Permissao> {
  if (!ligar) return alternarAcao(conjunto, tela, "ver", false);
  return ACOES_DA_TELA[tela].includes("editar")
    ? alternarAcao(conjunto, tela, "editar", true)
    : alternarAcao(conjunto, tela, "ver", true);
}

/** A célula da matriz está marcada quando o cargo vê a tela. */
export function marcadoNaMatriz(conjunto: ReadonlySet<string>, tela: Tela): boolean {
  return temAcao(conjunto, tela, "ver");
}

/** Exceção por permissão: "Sim" (concede) ou "Não" (nega); ausente = "Padrão". */
export type MapaDeExcecoes = Partial<Record<Permissao, Efeito>>;

export function mapaDasExcecoes(lista: readonly ExcecaoDePermissaoGravada[]): MapaDeExcecoes {
  return Object.fromEntries(lista.map((e) => [e.permissao, e.efeito]));
}

export function listaDasExcecoes(mapa: MapaDeExcecoes): ExcecaoDePermissaoGravada[] {
  return Object.entries(mapa).flatMap(([p, efeito]) =>
    ehPermissao(p) ? [{ permissao: p, efeito }] : [],
  );
}

/** Define a exceção de um item (o Ranking grava as duas chaves); `undefined` volta ao padrão. */
export function definirExcecao(
  mapa: MapaDeExcecoes,
  tela: Tela,
  acao: Acao,
  efeito: Efeito | undefined,
): MapaDeExcecoes {
  const doItem = new Set<string>(permissoesDoItem(tela, acao));
  const proximo: MapaDeExcecoes = Object.fromEntries(
    Object.entries(mapa).filter(([p]) => !doItem.has(p)),
  );
  if (efeito) for (const p of permissoesDoItem(tela, acao)) proximo[p] = efeito;
  return proximo;
}

/** Acesso efetivo com as exceções escolhidas: a mesma regra da API (`calcularPermissoes`). */
export function permissoesEfetivas(
  papel: string | null,
  doCargo: readonly string[],
  mapa: MapaDeExcecoes,
): Set<Permissao> {
  return new Set(calcularPermissoes({ papel, doCargo, excecoes: listaDasExcecoes(mapa) }));
}

/** "{n} exceções · {m} permissões ativas" (contagem por item do editor, como a tela mostra). */
export function resumoDoAcesso(mapa: MapaDeExcecoes, efetivas: ReadonlySet<Permissao>): string {
  const excecoes = listaDasExcecoes(mapa).filter((e) => !e.permissao.startsWith("ranking_novo."));
  const ativas = [...efetivas].filter((p) => !p.startsWith("ranking_novo.")).length;
  const n = excecoes.length;
  return `${String(n)} ${n === 1 ? "exceção" : "exceções"} · ${String(ativas)} ${ativas === 1 ? "permissão ativa" : "permissões ativas"}`;
}
