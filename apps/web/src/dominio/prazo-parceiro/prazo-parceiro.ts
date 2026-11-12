/**
 * Prazo do parceiro: o CT-e "nasce atrasado" quando a previsão do SSW é anterior ao prazo padrão
 * (emissão + 48 h). Parceiro = expedidor do CT-e. Spec: docs/regras/03-romaneio-prazo-parceiro.md §6.
 *
 * Decisões do dono: Q08 (uma linha por CNPJ, nome do cadastro mais recente, detalhe pelo CNPJ
 * quando não há cadastro) e Q13 (a lista usa o mesmo universo dos cards). "Penalizado" continua
 * pela coluna da ocorrência (Q17 ainda sem confirmação).
 */
import { diferencaEmDias, somarDias } from "@erp/shared/datas";

/** O que a tela lê de cada CT-e do período. */
export interface FatoPrazo {
  prazoOrigem: "proprio" | "parceiro";
  dataPrevista: string | null;
  prazoPadraoData: string | null;
  parceiroId: string | null;
  /** Só dígitos. */
  parceiroCnpj: string | null;
  parceiroNome: string | null;
  /** Existe ocorrência do CT-e marcada `penaliza` (qualquer código, data ou responsável). */
  penalizado: boolean;
}

export interface Periodo {
  inicio: string;
  fim: string;
}

/** Período anterior de mesmo tamanho, colado antes do atual. */
export function periodoAnterior(p: Periodo): Periodo {
  const dias = Math.max(1, diferencaEmDias(p.inicio, p.fim) + 1);
  return { inicio: somarDias(p.inicio, -dias), fim: somarDias(p.inicio, -1) };
}

export const nasceuAtrasado = (c: Pick<FatoPrazo, "dataPrevista" | "prazoPadraoData">) =>
  c.dataPrevista !== null && c.prazoPadraoData !== null && c.dataPrevista < c.prazoPadraoData;

const avaliado = (c: FatoPrazo) => c.prazoPadraoData !== null && c.dataPrevista !== null;

interface TotaisPrazo {
  totalCtes: number;
  totalProprio: number;
  totalParceiro: number;
  nascidosAtrasados: number;
  nascidosAvaliados: number;
  pctNascidos: number | null;
  performanceTotal: number;
  performancePropria: number;
  diferencaPp: number;
  pctPrazoProprio: number;
  pctPrazoParceiro: number;
}

interface Contagem {
  total: number;
  proprio: number;
  parceiro: number;
  penalizados: number;
  penalizadosProprios: number;
  nascidos: number;
  avaliados: number;
}

function contar(base: readonly FatoPrazo[]): Contagem {
  const c: Contagem = {
    total: 0,
    proprio: 0,
    parceiro: 0,
    penalizados: 0,
    penalizadosProprios: 0,
    nascidos: 0,
    avaliados: 0,
  };
  for (const x of base) {
    c.total += 1;
    if (x.prazoOrigem === "proprio") c.proprio += 1;
    else c.parceiro += 1;
    if (x.penalizado) {
      c.penalizados += 1;
      if (x.prazoOrigem === "proprio") c.penalizadosProprios += 1;
    }
    if (nasceuAtrasado(x)) c.nascidos += 1;
    if (avaliado(x)) c.avaliados += 1;
  }
  return c;
}

/** origem: calcular_prazo_parceiro (totais) */
export function totaisDoPrazo(base: readonly FatoPrazo[]): TotaisPrazo {
  const c = contar(base);
  const performanceTotal = c.total > 0 ? 1 - c.penalizados / c.total : 1;
  const performancePropria = c.proprio > 0 ? 1 - c.penalizadosProprios / c.proprio : 1;
  return {
    totalCtes: c.total,
    totalProprio: c.proprio,
    totalParceiro: c.parceiro,
    nascidosAtrasados: c.nascidos,
    nascidosAvaliados: c.avaliados,
    pctNascidos: c.avaliados > 0 ? c.nascidos / c.avaliados : null,
    performanceTotal,
    performancePropria,
    diferencaPp: performancePropria - performanceTotal,
    pctPrazoProprio: c.total > 0 ? c.proprio / c.total : 0,
    pctPrazoParceiro: c.total > 0 ? c.parceiro / c.total : 0,
  };
}

interface ComparacaoAnterior {
  deltaNascidos: number;
  deltaGapPp: number | null;
}

/** Só os deltas que a tela mostra. origem: calcular_prazo_parceiro (comparacao_anterior) */
export function comparacaoComAnterior(
  atual: TotaisPrazo,
  anterior: readonly FatoPrazo[],
): ComparacaoAnterior {
  const c = contar(anterior);
  const total = c.total > 0 ? 1 - c.penalizados / c.total : null;
  const propria = c.proprio > 0 ? 1 - c.penalizadosProprios / c.proprio : null;
  const gapAnterior = total !== null && propria !== null ? propria - total : null;
  return {
    deltaNascidos: atual.nascidosAtrasados - c.nascidos,
    deltaGapPp: gapAnterior === null ? null : atual.diferencaPp - gapAnterior,
  };
}

/** Cadastro de parceiro (para nome e "usa SSW"). */
export interface ParceiroCadastrado {
  id: string;
  nome: string;
  cnpj: string | null;
  usaSsw: boolean;
  criadoEm: Date;
}

interface LinhaRanking {
  /** uuid do cadastro, ou `cnpj:<dígitos>` para parceiro sem cadastro (Q08). */
  id: string;
  nome: string;
  usaSsw: boolean | null;
  total: number;
  qtdParceiro: number;
  pctParceiro: number;
  nascidosAtrasados: number;
  pctNascidos: number;
  performanceComParceiro: number;
}

export const PREFIXO_CNPJ = "cnpj:";

const digitos = (cnpj: string | null | undefined) => cnpj?.replace(/\D/g, "") || null;

interface GrupoDoRanking<F> {
  /** uuid do cadastro, senão a chave do grupo (`cnpj:<dígitos>` ou o parceiro_id). */
  id: string;
  cadastro: ParceiroCadastrado | undefined;
  cnpj: string | null;
  itens: F[];
}

/**
 * Grupos do ranking: um por CNPJ (o do CT-e, senão o do cadastro); sem CNPJ, pelo cadastro.
 * Cadastro do grupo: o mais recente daquele CNPJ (Q08).
 */
function gruposDoRanking<F extends FatoPrazo>(
  base: readonly F[],
  cadastros: readonly ParceiroCadastrado[],
): GrupoDoRanking<F>[] {
  const porId = new Map(cadastros.map((p) => [p.id, p]));
  const porCnpj = new Map<string, ParceiroCadastrado>();
  for (const p of [...cadastros].sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime())) {
    const cnpj = digitos(p.cnpj);
    if (cnpj) porCnpj.set(cnpj, p);
  }
  const grupos = new Map<string, GrupoDoRanking<F>>();
  for (const c of base) {
    const cnpj =
      digitos(c.parceiroCnpj) ?? (c.parceiroId ? digitos(porId.get(c.parceiroId)?.cnpj) : null);
    const chave = cnpj ? `${PREFIXO_CNPJ}${cnpj}` : c.parceiroId;
    if (!chave) continue;
    let g = grupos.get(chave);
    if (!g) {
      const cadastro =
        (cnpj ? porCnpj.get(cnpj) : undefined) ??
        (c.parceiroId ? porId.get(c.parceiroId) : undefined);
      g = { id: cadastro?.id ?? chave, cadastro, cnpj, itens: [] };
      grupos.set(chave, g);
    }
    g.itens.push(c);
  }
  return [...grupos.values()];
}

/**
 * Ranking por parceiro: uma linha por CNPJ (sem CNPJ, pelo cadastro). Nome e "usa SSW" do
 * cadastro mais recente daquele CNPJ; sem cadastro, o menor nome do CT-e (fixo entre consultas).
 * origem: calcular_prazo_parceiro (ranking), com Q08
 */
export function rankingDoPrazo(
  base: readonly FatoPrazo[],
  cadastros: readonly ParceiroCadastrado[],
): LinhaRanking[] {
  return gruposDoRanking(base, cadastros)
    .map((g): LinhaRanking => {
      const c = contar(g.itens);
      return {
        id: g.id,
        nome: g.cadastro?.nome ?? nomeDoCte(g.itens) ?? g.cnpj ?? "— sem nome —",
        usaSsw: g.cadastro?.usaSsw ?? null,
        total: c.total,
        qtdParceiro: c.parceiro,
        pctParceiro: c.total > 0 ? c.parceiro / c.total : 0,
        nascidosAtrasados: c.nascidos,
        pctNascidos: c.avaliados > 0 ? c.nascidos / c.avaliados : 0,
        performanceComParceiro: c.total > 0 ? 1 - c.penalizados / c.total : 1,
      };
    })
    .sort(
      (a, b) =>
        b.nascidosAtrasados - a.nascidosAtrasados ||
        a.performanceComParceiro - b.performanceComParceiro ||
        b.total - a.total ||
        a.nome.localeCompare(b.nome),
    );
}

/** Menor nome do expedidor nos CT-e (fixo entre consultas). */
export function nomeDoCte(itens: readonly Pick<FatoPrazo, "parceiroNome">[]): string | undefined {
  return itens
    .map((x) => x.parceiroNome)
    .filter((n): n is string => !!n)
    .sort()[0];
}

/**
 * CT-e da linha do ranking com este id (o detalhe abre exatamente o que a linha contou).
 * origem: calcular_prazo_parceiro_detalhe, com Q08
 */
export function fatosDoParceiro<F extends FatoPrazo>(
  base: readonly F[],
  cadastros: readonly ParceiroCadastrado[],
  id: string,
): { cadastro: ParceiroCadastrado | undefined; itens: F[] } {
  const grupos = gruposDoRanking(base, cadastros).filter((g) => g.id === id);
  return { cadastro: grupos[0]?.cadastro, itens: grupos.flatMap((g) => g.itens) };
}

/** Dias que o CT-e nasceu abaixo do padrão (positivo = atrasado); sem as datas, nulo. */
export function diasAbaixoDoPadrao(
  c: Pick<FatoPrazo, "dataPrevista" | "prazoPadraoData">,
): number | null {
  return c.dataPrevista !== null && c.prazoPadraoData !== null
    ? diferencaEmDias(c.dataPrevista, c.prazoPadraoData)
    : null;
}

const FAIXAS_DO_HISTOGRAMA = [
  "1 dia",
  "2 dias",
  "3 dias",
  "4-5 dias",
  "6-10 dias",
  "11+ dias",
] as const;
type FaixaDoHistograma = (typeof FAIXAS_DO_HISTOGRAMA)[number];

function faixaDe(dias: number): FaixaDoHistograma {
  if (dias <= 1) return "1 dia";
  if (dias <= 2) return "2 dias";
  if (dias <= 3) return "3 dias";
  if (dias <= 5) return "4-5 dias";
  if (dias <= 10) return "6-10 dias";
  return "11+ dias";
}

/** "Atraso na origem" do detalhe: só faixas com CT-e, na ordem. origem: calcular_prazo_parceiro_detalhe */
export function histogramaDeAtraso(
  base: readonly FatoPrazo[],
): { faixa: FaixaDoHistograma; qtd: number }[] {
  const contagem = new Map<FaixaDoHistograma, number>();
  for (const c of base) {
    if (!nasceuAtrasado(c)) continue;
    const faixa = faixaDe(diasAbaixoDoPadrao(c) ?? 0);
    contagem.set(faixa, (contagem.get(faixa) ?? 0) + 1);
  }
  return FAIXAS_DO_HISTOGRAMA.filter((f) => contagem.has(f)).map((faixa) => ({
    faixa,
    qtd: contagem.get(faixa) ?? 0,
  }));
}
