import { type TipoFeriado } from "@erp/shared/contratos/calendario";
import { montarDataIso, somarAnos, somarDias } from "@erp/shared/datas";

import { ErroDeNegocio } from "./erros";

/**
 * Domingo de Páscoa (algoritmo anônimo gregoriano, o mesmo da função SQL de hoje).
 * origem: gerar_feriados_nacionais (função SQL, sistema atual)
 */
export function domingoDePascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return montarDataIso(ano, mes, dia);
}

/**
 * Os 13 feriados nacionais gerados automaticamente (com os pontos facultativos que a operação
 * trata como feriado), com as descrições de hoje.
 * origem: gerar_feriados_nacionais (função SQL, sistema atual)
 */
export function feriadosNacionaisDoAno(ano: number): { data: string; descricao: string }[] {
  const pascoa = domingoDePascoa(ano);
  const fixo = (mes: number, dia: number) => montarDataIso(ano, mes, dia);
  return [
    { data: fixo(1, 1), descricao: "Confraternização Universal" },
    { data: fixo(4, 21), descricao: "Tiradentes" },
    { data: fixo(5, 1), descricao: "Dia do Trabalho" },
    { data: fixo(9, 7), descricao: "Independência do Brasil" },
    { data: fixo(10, 12), descricao: "Nossa Senhora Aparecida" },
    { data: fixo(11, 2), descricao: "Finados" },
    { data: fixo(11, 15), descricao: "Proclamação da República" },
    { data: fixo(11, 20), descricao: "Consciência Negra" },
    { data: fixo(12, 25), descricao: "Natal" },
    { data: somarDias(pascoa, -48), descricao: "Carnaval (segunda) — ponto facultativo" },
    { data: somarDias(pascoa, -47), descricao: "Carnaval (terça) — ponto facultativo" },
    { data: somarDias(pascoa, -2), descricao: "Sexta-feira Santa" },
    { data: somarDias(pascoa, 60), descricao: "Corpus Christi (ponto facultativo)" },
  ];
}

/** `ano`, `ano+1` … `ano+anosAFrente`. */
export function anosAte(ano: number, anosAFrente: number): number[] {
  return Array.from({ length: anosAFrente + 1 }, (_, i) => ano + i);
}

/** Datas de um feriado recorrente: a própria e o mesmo dia nos `anos` seguintes. */
export function datasDaRecorrencia(data: string, anos: number): string[] {
  return anosAte(0, anos).map((i) => somarAnos(data, i));
}

export interface LocalDoFeriado {
  cidade: string | null;
  uf: string | null;
}

/**
 * Cidade só para municipal, UF para municipal e estadual, nada para nacional.
 * origem: upsertFeriadoCal (src/features/calendario, sistema atual)
 */
export function normalizarLocal(
  tipo: TipoFeriado,
  cidade: string | null | undefined,
  uf: string | null | undefined,
): LocalDoFeriado {
  const cidadeLimpa = cidade?.trim() ?? "";
  if (tipo === "municipal" && (!cidadeLimpa || !uf)) {
    throw new ErroDeNegocio(
      "ENTRADA_INVALIDA",
      "Cidade e UF são obrigatórios para feriado municipal",
    );
  }
  if (tipo === "estadual" && !uf) {
    throw new ErroDeNegocio("ENTRADA_INVALIDA", "UF é obrigatório para feriado estadual");
  }
  return {
    cidade: tipo === "municipal" ? cidadeLimpa : null,
    uf: tipo === "nacional" ? null : (uf ?? null),
  };
}

/** Identidade de um feriado para não duplicar (a mesma do índice único). */
export function chaveDoFeriado(f: { data: string; tipo: TipoFeriado } & LocalDoFeriado): string {
  return [f.data, f.tipo, f.cidade ?? "", f.uf ?? ""].join("|");
}

export function contarPorTipo(
  feriados: readonly { tipo: TipoFeriado }[],
): Record<TipoFeriado, number> {
  const contagem: Record<TipoFeriado, number> = { nacional: 0, estadual: 0, municipal: 0 };
  for (const f of feriados) contagem[f.tipo] += 1;
  return contagem;
}

/**
 * Unidades que param no feriado: nacional, todas; estadual, as da UF; municipal, as da cidade
 * (sem diferenciar maiúsculas).
 * origem: impactaUnidades (src/routes/_authenticated/calendario.tsx, sistema atual)
 */
export function unidadesImpactadas<U extends { cidade: string | null; uf: string | null }>(
  feriado: { tipo: TipoFeriado } & LocalDoFeriado,
  unidades: readonly U[],
): U[] {
  switch (feriado.tipo) {
    case "nacional":
      return [...unidades];
    case "estadual":
      return unidades.filter((u) => u.uf === feriado.uf);
    case "municipal":
      return unidades.filter(
        (u) =>
          (u.uf ?? "") === (feriado.uf ?? "") &&
          (u.cidade ?? "").toLowerCase() === (feriado.cidade ?? "").toLowerCase(),
      );
  }
}

export const AVISO_FERIADO_NACIONAL =
  "Este feriado é nacional e vale para todas as empresas: só a equipe da Plataforma pode alterar ou remover.";
