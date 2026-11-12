/**
 * Atraso e recortes de situação do CT-e: faixa e status do previsto.
 */
import { CODIGOS_ENTREGA, normCodigoOcorr, TIPOS_PENDENCIA, type TipoSsw } from "./codigos";
import { type DataIso, diaSp, difDias, hojeSp, somarDiasCorridos } from "./tempo";

/** Colunas do CT-e que as regras de situação leem. */
interface CteParaSituacao {
  dataEmissao: DataIso;
  criadoEm: Date;
  dataPrevistaEntrega: DataIso | null;
  dataEntregaRealizada: Date | null;
  ocorrEfetivaCodigo: string | null;
  ocorrEfetivaData: Date | null;
  performanceDias: number | null;
  responsabilidadeCliente: boolean | null;
  ultimaOcorrCodigo0013: string | null;
  ultOcorrCodigo0174: string | null;
}

/**
 * Atraso pela previsão atual: entregue = dia da entrega (Brasília) − previsão; efetiva de entrega
 * sem data = `performance_dias`; baixado = vazio; aberto = hoje (Brasília) − previsão. Negativo =
 * ainda no prazo. `ctes.atraso_dias` (foto do 0013) não entra.
 * origem: atraso_lista_dias (sistema atual) e src/lib/atraso.ts; decisão atraso-pela-previsao-atual-2026-11-05
 */
export function atrasoDias(
  cte: Pick<
    CteParaSituacao,
    "dataPrevistaEntrega" | "dataEntregaRealizada" | "ocorrEfetivaCodigo" | "performanceDias"
  >,
  codigosBaixa: ReadonlySet<number>,
  agora: Date,
): number | null {
  const prevista = cte.dataPrevistaEntrega;
  if (prevista === null) return null;
  if (cte.dataEntregaRealizada !== null) return difDias(diaSp(cte.dataEntregaRealizada), prevista);
  const codigo = normCodigoOcorr(cte.ocorrEfetivaCodigo);
  if (codigo !== null && CODIGOS_ENTREGA.has(codigo)) return cte.performanceDias;
  if (codigo !== null && codigosBaixa.has(codigo)) return null;
  return difDias(hojeSp(agora), prevista);
}

type FaixaPrevisao = "sem_prev" | "vencido" | "hoje" | "d1" | "d2" | "d3_mais";

/**
 * Faixa de vencimento do bloco "Previstos". "Hoje" é o dia de Brasília (Q11 do dono; hoje o SQL
 * usa o dia UTC da sessão).
 * origem: _bucket_faixa_prev (sistema atual)
 */
export function faixaPrevisao(previsao: DataIso | null, agora: Date): FaixaPrevisao {
  if (previsao === null) return "sem_prev";
  const hoje = hojeSp(agora);
  if (previsao < hoje) return "vencido";
  if (previsao === hoje) return "hoje";
  if (previsao === somarDiasCorridos(hoje, 1)) return "d1";
  if (previsao === somarDiasCorridos(hoje, 2)) return "d2";
  return "d3_mais";
}

type StatusPrevisto = "agendamento" | "rota" | "pendencia" | "programacao" | "outros";

/**
 * Status do previsto pela efetiva (a ordem importa: 35 com tipo pendência é agendamento).
 * origem: _bucket_status_previsto (sistema atual)
 */
export function statusPrevisto(codigo: number | null, tipoSsw: TipoSsw | null): StatusPrevisto {
  if (codigo === 35) return "agendamento";
  if (codigo === 85 || codigo === 7) return "rota";
  if (tipoSsw !== null && TIPOS_PENDENCIA.has(tipoSsw)) return "pendencia";
  if (codigo === null || [80, 82, 83, 84].includes(codigo)) return "programacao";
  return "outros";
}
