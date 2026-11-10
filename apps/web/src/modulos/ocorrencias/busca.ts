import {
  CAMPOS_DATA,
  type FaixaAtraso,
  FAIXAS_ATRASO,
  type FiltroPrazo,
  type FiltrosDeCte,
  type OrdemDaLista,
  ORDENS_DA_LISTA,
  PRAZOS,
  type Recortes,
  type Responsabilidade,
  RESPONSABILIDADES,
  RESPONSAVEIS_DO_FILTRO,
  SEM_TIPO_DOCUMENTO,
  TAMANHOS_DE_PAGINA,
} from "@erp/shared/contratos/ocorrencias";
import { lerFiltroTexto } from "@erp/shared/filtro-texto";
import { z } from "@erp/shared/zod";

import { type EtiquetaDaBusca, resumirNomes } from "@/componentes/comum/FiltrosAvancados";
import { type Intervalo } from "@/componentes/comum/periodo";
import { campoFiltro } from "@/hooks/use-filtros-na-url";

const PERIODOS = ["hoje", "7d", "30d", "mes", "mes_anterior", "custom"] as const;

const comoLista = (v: unknown): unknown[] =>
  Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v];

/**
 * Parâmetros da URL de /ocorrencias — os mesmos nomes do sistema atual (links salvos valem).
 * Valor inválido volta ao padrão (campos do kit e os três abaixo, que o kit não tem).
 */
export const esquemaDaBusca = z.object({
  periodo: campoFiltro.opcao(PERIODOS, "mes"),
  de: campoFiltro.data(),
  ate: campoFiltro.data(),
  campoData: campoFiltro.opcao(CAMPOS_DATA, "emissao"),
  unidades: campoFiltro.lista(),
  parceiros: campoFiltro.lista(),
  filiais: campoFiltro.lista(),
  remetente: campoFiltro.texto(),
  destino: campoFiltro.texto(),
  ctrc: campoFiltro.texto(60),
  nf: campoFiltro.texto(60),
  tipos: campoFiltro.lista(),
  conferentes: campoFiltro.lista(),
  resp: campoFiltro.opcao(RESPONSABILIDADES, "todas"),
  codigos: z
    .preprocess(
      (v) => [...new Set(comoLista(v).map(Number).filter(Number.isInteger))],
      z.array(z.number().int()),
    )
    .catch([]),
  responsaveis: z
    .preprocess(
      (v) => comoLista(v).filter((r) => RESPONSAVEIS_DO_FILTRO.some((x) => x === r)),
      z.array(z.enum(RESPONSAVEIS_DO_FILTRO)),
    )
    .catch([]),
  prazo: z.enum(PRAZOS).nullable().catch(null),
  faixa: z.enum(FAIXAS_ATRASO).nullable().catch(null),
  pagador: z.string().min(1).max(300).nullable().catch(null),
  unidadeResp: z.string().min(1).max(20).nullable().catch(null),
  ordem: campoFiltro.opcao(ORDENS_DA_LISTA, "data_hora"),
  dir: campoFiltro.opcao(["asc", "desc"], "desc"),
  page: campoFiltro.pagina(),
  size: z.coerce
    .number()
    .refine((n) => TAMANHOS_DE_PAGINA.some((t) => t === n))
    .catch(50),
});
export type BuscaOcorrencias = z.output<typeof esquemaDaBusca>;

/** Link antigo usa `?codigo=13` (um só): vira `codigos`. */
export function migrarBuscaAntiga(bruta: Record<string, unknown>): Record<string, unknown> {
  if (bruta.codigo === undefined) return bruta;
  const { codigo, ...resto } = bruta;
  return resto.codigos === undefined ? { ...resto, codigos: codigo } : resto;
}

/** Filtros que escolhem os CT-e (sem os recortes dos cards e blocos). */
export function filtrosDeCteDaBusca(b: BuscaOcorrencias, periodo: Intervalo): FiltrosDeCte {
  return {
    inicio: periodo.inicio,
    fim: periodo.fim,
    campoData: b.campoData,
    unidades: b.unidades,
    conferentes: b.conferentes,
    parceiros: b.parceiros,
    filiais: b.filiais,
    remetente: b.remetente,
    destino: b.destino,
    ctrc: b.ctrc,
    nf: b.nf,
    tipos: b.tipos,
  };
}

export function recortesDaBusca(b: BuscaOcorrencias): Recortes {
  return {
    codigos: b.codigos,
    responsaveis: b.responsaveis,
    responsabilidade: b.resp,
    prazo: b.prazo,
    faixaAtraso: b.faixa,
    pagador: b.pagador,
    unidadeResp: b.unidadeResp,
  };
}

/** Ordenação, paginação e a base de data não contam como filtro ("Limpar filtros"). */
export const NAO_SAO_FILTRO = ["campoData", "ordem", "dir", "page", "size"] as const;

/** "Limpar filtros" mantém a base de data, a ordenação e o atalho de período (não o intervalo). */
export function camposMantidosAoLimpar(b: BuscaOcorrencias): (keyof BuscaOcorrencias)[] {
  const mantidos: (keyof BuscaOcorrencias)[] = ["campoData", "ordem", "dir", "size"];
  return b.periodo === "custom" ? mantidos : [...mantidos, "periodo"];
}

export type RecorteFinalizacao =
  "ocorr_entregues" | "ocorr_baixados" | "ocorr_abertos" | "ocorr_em_atraso";

/**
 * Atalho do card "CT-e finalizados e em aberto" para a Listagem detalhada (mesma lista com KPIs
 * das demais telas). Leva só os filtros que a Listagem entende.
 */
export function linkDaListagem(
  b: BuscaOcorrencias,
  periodo: Intervalo,
  tipo: RecorteFinalizacao,
): string {
  const busca = new URLSearchParams({
    tipo,
    periodo: "custom",
    de: periodo.inicio,
    ate: periodo.fim,
    base: b.campoData,
  });
  const listas = { filiais: b.filiais, parceiros: b.parceiros, tipos: b.tipos };
  for (const [chave, valores] of Object.entries(listas)) {
    for (const v of valores) busca.append(chave, v);
  }
  const textos = { remetente: b.remetente, destino: b.destino, ctrc: b.ctrc, nf: b.nf };
  for (const [chave, valor] of Object.entries(textos)) if (valor.trim()) busca.set(chave, valor);
  return `/performance/lista?${busca.toString()}`;
}

export const ROTULO_DA_RESPONSABILIDADE: Record<Responsabilidade, string> = {
  todas: "Todas",
  penalizantes: "Penalizantes",
  externas: "Não penalizantes",
  pendentes: "Pendentes de classificação",
};

export const ROTULO_DO_PRAZO: Record<FiltroPrazo, string> = {
  no_prazo: "No prazo",
  fora_prazo: "Fora do prazo",
  sem_prazo: "Prazo não apurado",
};

export const ROTULO_DA_FAIXA: Record<FaixaAtraso, string> = {
  ate_3: "Até 3 dias",
  de_4_8: "4 a 8 dias",
  de_9_15: "9 a 15 dias",
  de_16_30: "16 a 30 dias",
  acima_30: "Acima de 30 dias",
};

export const ROTULO_DA_ORDEM: Record<OrdemDaLista, string> = {
  data_hora: "Data/hora",
  codigo: "Código",
  responsavel: "Responsável",
  numero_ctrc: "NF / CTRC",
  parceiro_nome: "Parceiro",
  atraso_dias: "Atraso",
};

/**
 * Faixa "Filtrando por": tudo o que recorta a tela, inclusive os recortes dos blocos. Período,
 * base de data e paginação ficam de fora (já aparecem nos próprios botões).
 */
export function etiquetasDaBusca(
  b: BuscaOcorrencias,
  nomes: {
    parceiro: (cnpj: string) => string | undefined;
    unidade: (id: string) => string | undefined;
    codigo: (codigo: number) => string | undefined;
    responsavel: (r: (typeof RESPONSAVEIS_DO_FILTRO)[number]) => string;
  },
): EtiquetaDaBusca<BuscaOcorrencias>[] {
  const lista = (rotulo: string, valores: readonly string[], limpar: Partial<BuscaOcorrencias>) =>
    valores.length > 0 ? [{ rotulo, ...resumirNomes(valores), limpar }] : [];
  const texto = (rotulo: string, valor: string | null, limpar: Partial<BuscaOcorrencias>) =>
    valor !== null && valor.trim() !== "" ? [{ rotulo, valor: valor.trim(), limpar }] : [];
  const unidades = b.unidades.flatMap((u) => nomes.unidade(u) ?? []);
  return [
    ...lista(
      "Parceiros",
      b.parceiros.map((p) => nomes.parceiro(p) ?? p),
      { parceiros: [] },
    ),
    ...(b.unidades.length === 0
      ? []
      : unidades.length === b.unidades.length
        ? lista("Unidades", unidades, { unidades: [] })
        : // Enquanto as opções não chegam, só a quantidade (nunca o id).
          texto(
            "Unidades",
            b.unidades.length === 1 ? "1 selecionada" : `${String(b.unidades.length)} selecionadas`,
            { unidades: [] },
          )),
    ...lista("Unidade responsável", b.filiais, { filiais: [] }),
    ...lista("Remetente", lerFiltroTexto(b.remetente), { remetente: "" }),
    ...lista("Destino", lerFiltroTexto(b.destino), { destino: "" }),
    ...texto("CTRC", b.ctrc, { ctrc: "" }),
    ...texto("Nota fiscal", b.nf, { nf: "" }),
    ...lista(
      "Tipo documento",
      b.tipos.map((t) => (t === SEM_TIPO_DOCUMENTO ? "sem tipo" : t)),
      { tipos: [] },
    ),
    ...lista("Conferente", b.conferentes, { conferentes: [] }),
    ...lista(
      "Códigos",
      b.codigos.map((c) => {
        const descricao = nomes.codigo(c);
        return descricao ? `#${String(c)} ${descricao}` : `#${String(c)}`;
      }),
      { codigos: [] },
    ),
    ...lista("Responsável", b.responsaveis.map(nomes.responsavel), { responsaveis: [] }),
    ...texto("Prazo", b.prazo && ROTULO_DO_PRAZO[b.prazo], { prazo: null }),
    ...texto("Faixa de atraso", b.faixa && ROTULO_DA_FAIXA[b.faixa], { faixa: null }),
    ...texto("Pagador", b.pagador, { pagador: null }),
    ...texto("Card", b.resp === "todas" ? null : ROTULO_DA_RESPONSABILIDADE[b.resp], {
      resp: "todas",
    }),
    ...texto("Onde atuar", b.unidadeResp, { unidadeResp: null }),
  ];
}
