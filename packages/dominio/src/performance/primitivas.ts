import { type FaixaPrevisto, type StatusPrevisto } from "@erp/shared/contratos/performance";
import { diaDaSemana, somarDias } from "@erp/shared/datas";

/*
 * Primitivas do núcleo do CT-e que a Performance usa. Ficam aqui até o núcleo
 * (`packages/dominio/src/nucleo/`) chegar à main; cada uma diz por qual será trocada.
 */

/** Códigos de entrega do SSW (fixos). TODO(nucleo): trocar por nucleo/CODIGOS_ENTREGA */
export const CODIGOS_ENTREGA = [1, 18, 67] as const;

/** Só os dígitos. origem: regexp_replace(x, '\D', '', 'g') (sistema atual) */
export function digitos(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

/** Mesmo `btrim` do Postgres: tira só espaço (não tab nem quebra de linha). */
export function btrim(valor: string): string {
  return valor.replace(/^ +| +$/g, "");
}

/**
 * Padrões `ILIKE` do filtro de texto com vários valores ("a|b"). `%` e `_` digitados continuam
 * curinga, como hoje; `"a||b"` gera `%%`, que casa tudo (a tela nunca manda).
 * origem: texto_casa_filtro (sistema atual). TODO(nucleo): trocar por nucleo/padroesTextoFiltro
 */
export function padroesTextoFiltro(filtro: string): string[] {
  const t = btrim(filtro);
  if (!filtro.includes("|")) return [`%${t}%`];
  return `%${t.replace(/\s*\|\s*/g, "%|%")}%`.split("|");
}

/**
 * Faixa de vencimento do previsto. `hoje` é o dia no fuso da empresa (decisão Q11: o sistema
 * atual usava o dia UTC, que vira "amanhã" depois das 21h de Brasília).
 * origem: _bucket_faixa_prev (sistema atual). TODO(nucleo): trocar por nucleo/faixaPrevisao
 */
export function faixaPrevisao(prevista: string | null, hoje: string): FaixaPrevisto {
  if (prevista === null) return "sem_prev";
  if (prevista < hoje) return "vencido";
  if (prevista === hoje) return "hoje";
  if (prevista === somarDias(hoje, 1)) return "d1";
  if (prevista === somarDias(hoje, 2)) return "d2";
  return "d3_mais";
}

/**
 * Status do previsto pela ocorrência efetiva. A ordem importa: 35 com tipo pendência é
 * agendamento. origem: _bucket_status_previsto (sistema atual).
 * TODO(nucleo): trocar por nucleo/statusPrevisto
 */
export function statusPrevisto(codigo: number | null, ehPendencia: boolean): StatusPrevisto {
  if (codigo === 35) return "agendamento";
  if (codigo === 85 || codigo === 7) return "rota";
  if (ehPendencia) return "pendencia";
  if (codigo === null || [80, 82, 83, 84].includes(codigo)) return "programacao";
  return "outros";
}

/**
 * Dias úteis em (menor, maior], com sinal; útil = segunda a sexta e não feriado nacional.
 * origem: _dias_uteis_sla (sistema atual). TODO(nucleo): trocar por nucleo/diasUteisEntre
 */
export function diasUteisEntre(
  prevista: string,
  entrega: string,
  feriadosNacionais: ReadonlySet<string>,
): number {
  if (prevista === entrega) return 0;
  const [de, ate] = prevista < entrega ? [prevista, entrega] : [entrega, prevista];
  let uteis = 0;
  for (let d = somarDias(de, 1); d <= ate; d = somarDias(d, 1)) {
    const semana = diaDaSemana(d);
    if (semana !== 0 && semana !== 6 && !feriadosNacionais.has(d)) uteis += 1;
  }
  return entrega > prevista ? uteis : -uteis;
}

/** Ordenação de texto igual ao `ORDER BY` do banco (collation en_US). */
const colador = new Intl.Collator("en-US", { sensitivity: "variant" });
export const compararTexto = (a: string, b: string): number => colador.compare(a, b);
