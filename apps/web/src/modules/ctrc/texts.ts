/**
 * Textos do detalhe do CT-e que têm regra (testados à parte).
 * origem: src/routes/_authenticated/ctrc.$numero.tsx e src/lib/ctrc.ts (sistema atual)
 */

const dias = (n: number) => `${n} ${Math.abs(n) === 1 ? "dia" : "dias"}`;

/** Título: a NF quando houver (com o CTRC ao lado); senão o CTRC. */
export function identificacao(
  numeroNf: number | null,
  numero: string,
): { rotulo: "NF" | "CTRC"; principal: string; secundario: string | null } {
  if (numeroNf !== null) return { rotulo: "NF", principal: String(numeroNf), secundario: numero };
  return { rotulo: "CTRC", principal: numero, secundario: null };
}

export function formatarCep(cep: string | null): string {
  if (!cep) return "—";
  const d = cep.replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep.trim();
}

export function formatarCnpjOuTraco(cnpj: string | null): string {
  if (!cnpj) return "—";
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Chave de 44 dígitos em grupos de 4. */
export function formatarChave(chave: string): string {
  const d = chave.replace(/\D/g, "");
  if (d.length !== 44) return chave;
  return d.match(/.{1,4}/g)?.join(" ") ?? d;
}

/** Dica da previsão de entrega: de onde veio o prazo. */
export function origemDaPrevisao(fonte: string | null, dataPrevista: string | null): string {
  switch (fonte) {
    case "bi2":
      return "📊 Calculada pelo SSW BI2 — previsão oficial da transportadora";
    case "xml_dprog":
      return "📄 Data prevista informada no XML CT-e (campo dProg)";
    case "consulta_prazo":
    case "consulta_prazo_emissao":
      return "🔍 Calculado via SSW: data de emissão + prazo por rota";
    case "consulta_prazo_oc80":
      return "🔍 Calculado via SSW: início do transporte + prazo por rota";
    case "regra_unidade":
      return "⚙️ Regra configurada por unidade";
    case "regra_parceiro":
      return "⚙️ Regra configurada por parceiro";
    case "regra_transbordo":
      return "⚙️ Regra de transbordo configurada";
    case "fora_malha":
      return dataPrevista
        ? "📄 Data prevista informada no XML CT-e (campo dProg)"
        : "ℹ️ Prazo não disponível para esta rota";
    default:
      return "ℹ️ Origem do prazo não identificada";
  }
}

/** Linha "Prazo mínimo (48h)". */
export function textoDoPrazoMinimo(
  prazoPadraoData: string | null,
  prazoPadraoDias: number | null,
  formatarData: (iso: string) => string,
): string {
  if (prazoPadraoData) return `${formatarData(prazoPadraoData)} (emissão + 48 horas corridas)`;
  return prazoPadraoDias !== null
    ? "não avaliado (previsão anterior à emissão)"
    : "não avaliado (TROCA)";
}

/** "+2 dias", "-1 dia", "0 dias". */
export function textoDaPerformance(performanceDias: number | null): string {
  if (performanceDias === null) return "—";
  return `${performanceDias > 0 ? "+" : ""}${dias(performanceDias)}`;
}

/** Atraso zero ou sem cálculo = traço. */
export function textoDoAtraso(atrasoDias: number | null): string {
  return atrasoDias === null || atrasoDias === 0 ? "—" : dias(atrasoDias);
}

/** Emitido a menos de 48 h da previsão: a previsão cai antes do prazo mínimo. */
export function nasceuEmAtraso(previsao: string | null, prazoPadraoData: string | null): boolean {
  if (!previsao || !prazoPadraoData) return false;
  return previsao.slice(0, 10) < prazoPadraoData.slice(0, 10);
}

export function rotuloDaFonte(fonte: string | null): string {
  if (fonte === "bi2_0174") return "BI2 0174 (movimentação)";
  if (fonte === "bi2_0013") return "BI2 0013 (posição)";
  if (fonte === "webhook") return "Webhook SSW";
  if (fonte === "ssw_036") return "SSW 036 (romaneio)";
  return "—";
}

export type Pontualidade =
  | "responsabilidade_cliente"
  | "baixado"
  | "no_prazo"
  | "fora_do_prazo"
  | "em_transito"
  | "em_apuracao";

/** Selo "Pontualidade": baixado sem entrega não tem pontualidade. */
export function pontualidade(ctrc: {
  noPrazo: boolean | null;
  responsabilidadeCliente: boolean | null;
  dataEntrega: string | null;
  baixado: boolean;
}): Pontualidade {
  if (ctrc.responsabilidadeCliente) return "responsabilidade_cliente";
  if (ctrc.baixado && ctrc.noPrazo === null) return "baixado";
  if (ctrc.noPrazo === true) return "no_prazo";
  if (ctrc.noPrazo === false) return "fora_do_prazo";
  return ctrc.dataEntrega ? "em_apuracao" : "em_transito";
}
