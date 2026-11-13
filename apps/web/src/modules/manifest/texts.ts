/** Rótulos, dicas, formatação e classes de exibição da tela Romaneio. */
import { type CampoData, type FaixaDoDia, type Recorte } from "@erp/shared/contracts/manifest";

/** "Cidade/UF" (ou só a cidade); vazio vira null. */
export const cidadeUf = (cidade: string | null, uf: string | null) =>
  cidade ? `${cidade}${uf ? `/${uf}` : ""}` : null;

export const CLASSE_TD = "px-4 py-2.5 whitespace-nowrap";
export const CLASSE_NUMERO = "px-4 py-2.5 text-right tabular-nums whitespace-nowrap";
/** Documento, placa, sigla. */
export const CLASSE_CODIGO = "px-4 py-2.5 font-mono text-[12px] whitespace-nowrap";

/** Códigos que contam como prejuízo: os do filtro, senão o 13. */
const codigosDoPrejuizo = (codigos: readonly number[] | undefined) =>
  codigos && codigos.length > 0 ? codigos : [13];

/** "código 13" ou "códigos 13, 69". */
export function textoDoPrejuizo(codigos: readonly number[] | undefined): string {
  const lista = codigosDoPrejuizo(codigos);
  return `${lista.length > 1 ? "códigos" : "código"} ${lista.join(", ")}`;
}

export const TIP_RETORNO =
  "CTRC com ocorrência 13 que ainda estão em aberto (nem entregues nem baixados) — acompanhamento do que precisa de ação. Para o total histórico do período, veja a aba Prejuízo.";
export const TIP_PERFORMANCE =
  "(CTRC levados − CTRC prejudicados pelo código 13) ÷ CTRC levados × 100. Só a ocorrência 13 (Entrega Prejudicada) entra na conta, qualquer que seja o filtro de código da tela. Ex.: 709 levados e 2 prejudicados = 99,72%.";
export const TIP_VIAGENS =
  "Quantas vezes saiu para entrega no período: cada romaneio de entrega conta uma viagem, mesmo quando sai de novo com a mesma placa.";
export const TIP_PREJUDICADAS =
  "Cargas com prejuízo atribuído ao(s) código(s) indicado(s) abaixo, no mesmo critério das demais telas. Só aparecem aqui as cargas com motorista identificado no romaneio, então a soma da coluna pode ficar abaixo do total geral.";

/** Total de colunas da tabela da aba Total; as 18 primeiras vêm antes de Peso (subtotal do grupo). */
export const COLUNAS_DA_TABELA = 24;
export const COLUNAS_ANTES_DO_PESO = 18;

export const ETIQUETA_EM_ROTA_AGORA = {
  sim: "só em rota agora",
  nao: "só fora de rota agora",
} as const;

export const ROTULO_FONTE = {
  bi2_0174: "BI2 0174 (movimentação)",
  bi2_0013: "BI2 0013 (posição)",
  webhook: "Webhook SSW",
} as const;

export const diasPorExtenso = (dias: number) => `${dias} ${dias === 1 ? "dia" : "dias"}`;

export type Faixa = Exclude<FaixaDoDia, "todas">;

export const ROTULO_FAIXA: Record<Faixa, string> = {
  vencida: "Prazo vencido",
  hoje: "Vencendo no dia",
  futuro: "Vencimento futuro",
  sem_prev: "Sem prazo definido",
};

export const BASES_DATA: readonly { valor: CampoData; rotulo: string }[] = [
  { valor: "emissao", rotulo: "Emissão" },
  { valor: "saida", rotulo: "Saída para entrega" },
];

/** Texto da base de data escolhida (seletor "Contar as cargas pela" e dica do período). */
export function baseAtual(ver: CampoData): { curto: string; ajuda: string; texto: string } {
  switch (ver) {
    case "saida":
      return {
        curto: "por data de saída para entrega",
        ajuda: "dia em que o CTRC saiu no romaneio",
        texto:
          "O período filtra pelo dia em que o CTRC saiu para entrega no romaneio, em todas as abas desta tela.",
      };
    case "conclusao":
      return {
        curto: "por data de conclusão",
        ajuda: "dia em que a carga foi concluída",
        texto:
          "O período filtra pelo dia da conclusão da carga (entrega ou outro encerramento), em todas as abas desta tela.",
      };
    case "embarque":
      return {
        curto: "por data de embarque",
        ajuda: "data de embarque",
        texto: "O período filtra pela data de embarque.",
      };
    case "prevista":
      return {
        curto: "por data prevista",
        ajuda: "data prevista de entrega",
        texto: "O período filtra pela data prevista de entrega.",
      };
    case "emissao":
      return {
        curto: "por data de emissão",
        ajuda: "data de emissão do CT-e",
        texto: "O período filtra pela data de emissão do CT-e, em todas as abas desta tela.",
      };
  }
}

export const ROTULO_RECORTE: Record<Recorte, string> = {
  todos: "Todos",
  entregues: "Entregues",
  em_rota: "Em rota de entrega",
  devolvido: "Baixado sem entrega",
  travado: "Travado em ocorrência",
  parado: "Parado, sem saída para entrega",
  romaneados: "Somente romaneados (saíram para entrega)",
  otif: "CTRC com problema no percurso",
  prejuizo: "CTRC com prejuízo",
  em_rota_vencida: "Em rota · prazo vencido",
  em_rota_hoje: "Em rota · vence hoje",
  em_rota_futuro: "Em rota · vencimento futuro",
  em_rota_sem_prev: "Em rota · sem prazo definido",
  tde_romaneado: "TDE romaneado (em rota ou entregue)",
};

export const ROTULO_EM_ROTA_AGORA = { todos: "Todos", sim: "Sim", nao: "Não" } as const;

export const ROTULO_AGRUPAMENTO = {
  none: "Nenhum",
  parceiro: "Parceiro",
  unidade: "Unidade",
  cidade: "Cidade de destino",
  setor: "Setor de entrega",
} as const;
