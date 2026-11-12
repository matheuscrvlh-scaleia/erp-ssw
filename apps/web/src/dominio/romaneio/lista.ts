/**
 * Lista da aba Total do Romaneio: filtros próprios da lista, totais, subtotais por grupo, ordem
 * pela coluna e página. A API lê a base e os detalhes da página; a regra fica aqui.
 * origem: get_romaneio_v3 + getRomaneio (sistema atual)
 */
import {
  type Agrupamento,
  type EmRotaAgora,
  LIMITE_AGRUPADO,
  type OrdemLista,
  type Recorte,
} from "@erp/shared/contratos/romaneio";

import { centavos, reais } from "../performance/numeros";
import { type CamposDoGrupo, grupoDaLinha } from "./linha";
import { COLLATOR } from "./normalizacao";
import { type AnaliseCte, casaRecorte, estaSemMovimento, type FatoCte } from "./situacao";

/** CT-e da consulta-base, com o que a lista ordena e agrupa. */
export interface FatoDaLista extends FatoCte, CamposDoGrupo {
  numeroNf: number | null;
  dataEmbarque: string | null;
  remetente: string | null;
  statusAtual: string | null;
}

export interface ItemDaLista<F extends FatoCte = FatoDaLista> {
  fato: F;
  analise: AnaliseCte;
}

interface FiltrosProprios {
  emRotaAgora: EmRotaAgora;
  status: "todos" | "andamento";
  semMovimento: boolean;
  recorte: Recorte;
}

/**
 * Filtros que só a lista tem (Em rota agora, status, sem movimento) e o recorte do card clicado,
 * com a mesma regra do card (Q13).
 */
export function casaFiltrosDaLista(
  { fato, analise }: ItemDaLista<FatoCte>,
  f: FiltrosProprios,
  ctx: { diasSemMovimento: number; agora: Date; hoje: string },
): boolean {
  return (
    (f.emRotaAgora === "todos" || (f.emRotaAgora === "sim") === analise.emRotaAgora) &&
    (f.status !== "andamento" || (!analise.entregue && !analise.finalizado)) &&
    (!f.semMovimento || estaSemMovimento(fato, analise, ctx.diasSemMovimento, ctx.agora)) &&
    casaRecorte(fato, analise, f.recorte, ctx.hoje)
  );
}

type Comparavel = string | number | null;

function valorDaOrdem(f: FatoDaLista, ordem: OrdemLista): Comparavel {
  switch (ordem) {
    case "numero_nf":
      return f.numeroNf;
    case "numero_ctrc":
      return Number(f.numero);
    case "data_emissao":
      return f.dataEmissao;
    case "data_embarque":
      return f.dataEmbarque;
    case "parceiro":
      return f.parceiroNome;
    case "unidade":
      return f.filial;
    case "remetente":
      return f.remetente;
    case "cidade_destino":
      return f.cidadeDestino;
    case "peso":
      return f.peso;
    case "volumes":
      return f.volumes;
    case "valor_frete":
      return f.valorFrete;
    case "status_atual":
      return f.statusAtual;
  }
}

/** Nulos por último nos dois sentidos; texto pela collation do banco atual. */
function comparar(a: Comparavel, b: Comparavel, direcao: "asc" | "desc"): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const r =
    typeof a === "number" && typeof b === "number" ? a - b : COLLATOR.compare(String(a), String(b));
  return direcao === "asc" ? r : -r;
}

/** Pela coluna clicada (Q03); sem coluna, previsão crescente (a ordem de hoje). Desempate: id. */
export function ordenarLista<I extends ItemDaLista>(
  itens: readonly I[],
  ordem: OrdemLista | undefined,
  direcao: "asc" | "desc",
): I[] {
  return [...itens].sort(
    (x, y) =>
      (ordem
        ? comparar(valorDaOrdem(x.fato, ordem), valorDaOrdem(y.fato, ordem), direcao)
        : comparar(x.fato.dataPrevista, y.fato.dataPrevista, "asc")) ||
      x.fato.id.localeCompare(y.fato.id),
  );
}

interface Soma {
  ctes: number;
  peso: number;
  volumes: number;
  frete: number;
}

interface ResumoDaLista {
  totais: Soma & { entregues: number };
  /** Subtotais por grupo (vazio sem agrupamento), do maior para o menor. */
  grupos: (Soma & { chave: string; rotulo: string })[];
}

/** Totais e subtotais por grupo de TODOS os CT-e filtrados (não só da página). */
export function resumirLista(itens: readonly ItemDaLista[], agrupar: Agrupamento): ResumoDaLista {
  // Frete em centavos inteiros até a saída (como o `sum(numeric)` do banco).
  const vazia = (): Soma => ({ ctes: 0, peso: 0, volumes: 0, frete: 0 });
  const somar = (s: Soma, f: FatoDaLista) => {
    s.ctes += 1;
    s.peso += f.peso;
    s.volumes += f.volumes;
    s.frete += centavos(f.valorFrete);
  };
  const totais = { ...vazia(), entregues: 0 };
  const grupos = new Map<string, Soma & { chave: string; rotulo: string }>();
  for (const { fato, analise } of itens) {
    somar(totais, fato);
    if (analise.entregue) totais.entregues += 1;
    if (agrupar === "none") continue;
    const g = grupoDaLinha(agrupar, fato);
    const soma = grupos.get(g.chave) ?? { ...g, ...vazia() };
    somar(soma, fato);
    grupos.set(g.chave, soma);
  }
  return {
    totais: { ...totais, frete: reais(totais.frete) },
    grupos: [...grupos.values()]
      .map((g) => ({ ...g, frete: reais(g.frete) }))
      .sort((a, b) => b.ctes - a.ctes || COLLATOR.compare(a.rotulo, b.rotulo)),
  };
}

/** Página pedida; com agrupamento, até `LIMITE_AGRUPADO` linhas sem paginação (Q04). */
export function paginaDaLista<I extends ItemDaLista>(
  itens: readonly I[],
  pedido: {
    agrupar: Agrupamento;
    ordem?: OrdemLista | undefined;
    direcao: "asc" | "desc";
    pagina: number;
    tamanho: number;
  },
): I[] {
  const [inicio, quantos] =
    pedido.agrupar === "none"
      ? [(pedido.pagina - 1) * pedido.tamanho, pedido.tamanho]
      : [0, LIMITE_AGRUPADO];
  return ordenarLista(itens, pedido.ordem, pedido.direcao).slice(inicio, inicio + quantos);
}
