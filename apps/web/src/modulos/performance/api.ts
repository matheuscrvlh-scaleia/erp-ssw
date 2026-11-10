import { contratosFiltrosCtrc as cf } from "@erp/shared/contratos/filtros-ctrc";
import {
  type BaseDeData,
  contratosPerformance as c,
  type FiltroPerformanceEntrada,
  type Granularidade,
} from "@erp/shared/contratos/performance";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

import { type FiltrosDaTela } from "./busca";

/** Tudo da Performance fica sob esta chave (o botão Atualizar invalida o bloco inteiro). */
export const CHAVE_DA_PERFORMANCE = ["performance"] as const;

export function entradaDoFiltro(
  periodo: { inicio: string; fim: string },
  filtros: FiltrosDaTela,
  baseData: BaseDeData,
): FiltroPerformanceEntrada {
  return { inicio: periodo.inicio, fim: periodo.fim, ...filtros, baseData };
}

const chave = (nome: string, entrada: unknown) => [...CHAVE_DA_PERFORMANCE, nome, entrada] as const;

export const consultaConfiguracao = queryOptions({
  queryKey: [...CHAVE_DA_PERFORMANCE, "configuracao"],
  queryFn: () => chamar(c.configuracao),
});

export const consultaResumo = (entrada: FiltroPerformanceEntrada) =>
  queryOptions({
    queryKey: chave("resumo", entrada),
    queryFn: () => chamar(c.resumo, { entrada }),
  });

export const consultaPontualidade = (entrada: FiltroPerformanceEntrada) =>
  queryOptions({
    queryKey: chave("pontualidade", entrada),
    queryFn: () => chamar(c.pontualidade, { entrada }),
  });

export const consultaOtif = (entrada: FiltroPerformanceEntrada) =>
  queryOptions({ queryKey: chave("otif", entrada), queryFn: () => chamar(c.otif, { entrada }) });

export const consultaTde = (entrada: FiltroPerformanceEntrada) =>
  queryOptions({
    queryKey: chave("tde", entrada),
    queryFn: () => chamar(c.tdeAguardando, { entrada }),
  });

export const consultaPrevistos = (
  entrada: FiltroPerformanceEntrada & { ignorarPeriodo: boolean },
) =>
  queryOptions({
    queryKey: chave("previstos", entrada),
    queryFn: () => chamar(c.previstos, { entrada }),
  });

export const consultaAlertas = (entrada: FiltroPerformanceEntrada) =>
  queryOptions({
    queryKey: chave("alertas", entrada),
    queryFn: () => chamar(c.alertas, { entrada }),
    retry: false,
  });

export const consultaCodigosDisponiveis = (entrada: FiltroPerformanceEntrada) =>
  queryOptions({
    queryKey: chave("codigos", entrada),
    queryFn: () => chamar(c.codigosDisponiveis, { entrada }),
    staleTime: 60_000,
  });

export const consultaTiposNoPeriodo = (entrada: FiltroPerformanceEntrada) =>
  queryOptions({
    queryKey: chave("tipos", entrada),
    queryFn: () => chamar(c.tiposDocumento, { entrada }),
    staleTime: 60_000,
  });

export const consultaSerie = (
  entrada: FiltroPerformanceEntrada & { granularidade: Granularidade },
) =>
  queryOptions({ queryKey: chave("serie", entrada), queryFn: () => chamar(c.serie, { entrada }) });

export const consultaRelatorio = (
  entrada: FiltroPerformanceEntrada & { comparativoInicio?: string; comparativoFim?: string },
) =>
  queryOptions({
    queryKey: chave("relatorio", entrada),
    queryFn: () => chamar(c.relatorio, { entrada }),
  });

// Opções dos filtros (servem a várias telas de CT-e).

export const consultaPagadores = (entrada: {
  inicio: string;
  fim: string;
  unidades: string[] | null;
  filiais: string[] | null;
}) =>
  queryOptions({
    queryKey: ["filtros-ctrc", "pagadores", entrada],
    queryFn: () => chamar(cf.pagadores, { entrada }),
  });

export const consultaUnidadesResponsaveis = (entrada: {
  inicio: string;
  fim: string;
  parceiros: string[] | null;
  remetente: string | null;
  destino: string | null;
  codigos: string[] | null;
}) =>
  queryOptions({
    queryKey: ["filtros-ctrc", "unidades-responsaveis", entrada],
    queryFn: () => chamar(cf.unidadesResponsaveis, { entrada }),
    staleTime: 60_000,
  });

export const consultaTiposDocumento = queryOptions({
  queryKey: ["filtros-ctrc", "tipos-documento"],
  queryFn: () => chamar(cf.tiposDocumento),
});

export const consultaSugestoes = (entrada: {
  campo: "remetente" | "cidade_destino";
  q: string;
  inicio: string;
  fim: string;
  parceiros: string[] | null;
  remetente: string | null;
  destino: string | null;
  filiais: string[] | null;
  codigos: string[] | null;
}) =>
  queryOptions({
    queryKey: ["filtros-ctrc", "sugestoes", entrada],
    queryFn: () => chamar(cf.sugestoesTexto, { entrada }),
    staleTime: 60_000,
  });
