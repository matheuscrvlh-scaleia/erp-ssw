/**
 * Regras do detalhe do CT-e (`/ctrc/$numero`): identificação pela série + número, ocorrências
 * exibidas, localização, finalização, link do SSW e o selo do status do prazo.
 * origem: ctrc.functions.ts, ctrc.$numero.tsx, src/lib/ssw.ts (sistema atual)
 */
import { lerCtrcProcurado } from "../listagem/texto";
import { CODIGOS_ENTREGA, diaSp, estaEntregue } from "../nucleo";

/**
 * Número do endereço (`33214`, `033214`, `CAP033214`) + série opcional da query. A série da
 * query vale mais que a do caminho. Sem dígitos → `null` (não há o que procurar).
 */
export function lerIdentificacao(
  numero: string,
  sigla?: string,
): { sigla: string | null; numero: string } | null {
  const lido = lerCtrcProcurado(numero);
  if (lido.numero === "") return null;
  const daQuery = sigla?.trim().toUpperCase();
  return { sigla: daQuery ? daQuery : lido.sigla, numero: lido.numero };
}

/**
 * Ocorrências que o detalhe mostra: fora as de dia (Brasília) anterior à emissão (ciclo antigo
 * do mesmo número), da mais recente para a mais antiga. As em quarentena já não vêm do banco.
 * origem: getCtrcByNumero (sistema atual)
 */
export function ocorrenciasExibidas<T extends { dataHora: Date; criadoEm: Date }>(
  ocorrencias: readonly T[],
  dataEmissao: string,
): T[] {
  return ocorrencias
    .filter((o) => diaSp(o.dataHora) >= dataEmissao)
    .sort(
      (a, b) =>
        b.dataHora.getTime() - a.dataHora.getTime() || b.criadoEm.getTime() - a.criadoEm.getTime(),
    );
}

/** Rótulos truncados do 0013 que não são localização de verdade. */
const LOCALIZACOES_FALSAS = ["ROMANE", "MANIFE", "SEGREG"];

/**
 * Localização: a do 0013; se for um rótulo truncado (ou vazia), a instrução do 0174.
 * origem: getCtrcByNumero (sistema atual)
 */
export function localizacaoExibida(
  localizacaoAtual: string | null,
  instrucao0174: string | null,
): string | null {
  const atual = localizacaoAtual?.trim() ? localizacaoAtual : null;
  const falsa =
    atual !== null && LOCALIZACOES_FALSAS.some((r) => atual.toUpperCase().startsWith(r));
  return (falsa ? null : atual) ?? instrucao0174;
}

/**
 * Entregue (data de entrega ou efetiva 1/18/67) ou baixado sem entrega (efetiva de baixa do
 * cadastro, Q22); senão em aberto.
 */
export function finalizacaoDoCtrc(
  dataEntrega: Date | null,
  efetiva: { codigoTexto: string | null; codigo: number | null; descricao: string | null },
  codigosBaixa: ReadonlySet<number>,
): { entregue: boolean; baixa: { codigo: number; descricao: string | null } | null } {
  const entregue = estaEntregue(dataEntrega, efetiva.codigoTexto);
  const baixa =
    !entregue && efetiva.codigo !== null && codigosBaixa.has(efetiva.codigo)
      ? { codigo: efetiva.codigo, descricao: efetiva.descricao }
      : null;
  return { entregue, baixa };
}

/**
 * Link do CT-e no SSW (consulta pela série, número com 6 dígitos e o dia da emissão). Falta
 * série, número ou emissão → sem link.
 * origem: sswCtrcUrl (src/lib/ssw.ts, sistema atual)
 */
export function linkDoSsw(
  sigla: string | null | undefined,
  numero: string | null | undefined,
  dataEmissao: string | null | undefined,
): string | null {
  if (!sigla || !numero || !dataEmissao) return null;
  const data = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataEmissao);
  if (!data) return null;
  const [, ano = "", mes = "", dia = ""] = data;
  const ddmmaa = `${dia}${mes}${ano.slice(2)}`;
  const nro = numero.replace(/\D+/g, "").padStart(6, "0");
  return (
    `https://sistema.ssw.inf.br/bin/ssw0053?act=P1` +
    `&t_ser_ctrc=${encodeURIComponent(sigla)}` +
    `&t_nro_ctrc=${nro}` +
    `&t_data_ini=${ddmmaa}` +
    `&t_data_fin=${ddmmaa}`
  );
}

const MS_POR_DIA = 86_400_000;

/** Instante do horário de parede `dia hora` no fuso dado. */
function instanteNoFuso(dia: string, hora: string, fuso: string): Date {
  const comoUtc = new Date(`${dia}T${hora}Z`);
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(comoUtc);
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  const vistoNoFuso = Date.UTC(
    valor("year"),
    valor("month") - 1,
    valor("day"),
    valor("hour"),
    valor("minute"),
    valor("second"),
  );
  return new Date(comoUtc.getTime() - (vistoNoFuso - comoUtc.getTime()));
}

export type StatusDoPrazo =
  | { tipo: "sem_previsao" }
  | { tipo: "baixado" }
  | { tipo: "entregue_no_prazo" }
  | { tipo: "entregue_com_atraso"; dias: number }
  | { tipo: "no_prazo" }
  | { tipo: "atrasado"; dias: number };

/**
 * Selo "Status do prazo", pelo relógio e fuso de quem olha (como hoje: o navegador).
 * A entrega é a 1ª ocorrência de entrega da lista (a mais recente), senão a data de entrega,
 * senão a efetiva quando é de entrega. Entregue até 23:59:59 do dia previsto = no prazo.
 * origem: PrazoStatusBadge (ctrc.$numero.tsx, sistema atual)
 */
export function statusDoPrazo(
  ctrc: {
    dataPrevista: string | null;
    dataEntrega: string | null;
    efetiva: { codigo: number | null; dataHora: string | null };
    ocorrencias: readonly { codigo: number; dataHora: string }[];
    codigosBaixa: readonly number[];
  },
  agora: Date,
  fuso: string,
): StatusDoPrazo {
  const previsao = ctrc.dataPrevista?.slice(0, 10);
  if (!previsao) return { tipo: "sem_previsao" };
  const baixas = new Set(ctrc.codigosBaixa);
  const entrega = ctrc.ocorrencias.find((o) => CODIGOS_ENTREGA.has(o.codigo));
  const efetivaDeEntrega = ctrc.efetiva.codigo !== null && CODIGOS_ENTREGA.has(ctrc.efetiva.codigo);
  const algumaBaixa =
    (ctrc.efetiva.codigo !== null && baixas.has(ctrc.efetiva.codigo)) ||
    ctrc.ocorrencias.some((o) => baixas.has(o.codigo));
  if (!entrega && !ctrc.dataEntrega && algumaBaixa) return { tipo: "baixado" };

  const entregaTs =
    entrega?.dataHora ?? ctrc.dataEntrega ?? (efetivaDeEntrega ? ctrc.efetiva.dataHora : null);
  if (entregaTs) {
    const limite = instanteNoFuso(previsao, "23:59:59", fuso).getTime();
    const instante = new Date(entregaTs).getTime();
    if (instante <= limite) return { tipo: "entregue_no_prazo" };
    return {
      tipo: "entregue_com_atraso",
      dias: Math.max(1, Math.ceil((instante - limite) / MS_POR_DIA)),
    };
  }
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(agora);
  if (previsao >= hoje) return { tipo: "no_prazo" };
  const dias = Math.round(
    (new Date(`${hoje}T00:00:00Z`).getTime() - new Date(`${previsao}T00:00:00Z`).getTime()) /
      MS_POR_DIA,
  );
  return { tipo: "atrasado", dias };
}
