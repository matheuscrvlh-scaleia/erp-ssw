import {
  type BaseDeData,
  contratosPerformance as c,
  type FiltroPerformanceEntrada,
  type Granularidade,
} from "@erp/shared/contratos/performance";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

import { type FiltrosDaTela } from "./busca";

/** Tudo da Performance fica sob `tudo` (o botão Atualizar invalida o bloco inteiro). */
export const chaves = {
  tudo: ["performance"] as const,
  configuracao: () => [...chaves.tudo, "configuracao"] as const,
  consulta: (nome: string, entrada: unknown) => [...chaves.tudo, nome, entrada] as const,
};

export function entradaDoFiltro(
  periodo: { inicio: string; fim: string },
  filtros: FiltrosDaTela,
  baseData: BaseDeData,
): FiltroPerformanceEntrada {
  return { inicio: periodo.inicio, fim: periodo.fim, ...filtros, baseData };
}

export const consultaConfiguracao = queryOptions({
  queryKey: chaves.configuracao(),
  queryFn: () => chamar(c.configuracao),
});

export const consultaResumo = (entrada: FiltroPerformanceEntrada) =>
  queryOptions({
    queryKey: chaves.consulta("resumo", entrada),
    queryFn: () => chamar(c.resumo, { entrada }),
  });

export const consultaPontualidade = (entrada: FiltroPerformanceEntrada) =>
  queryOptions({
    queryKey: chaves.consulta("pontualidade", entrada),
    queryFn: () => chamar(c.pontualidade, { entrada }),
  });

export const consultaOtif = (entrada: FiltroPerformanceEntrada) =>
  queryOptions({
    queryKey: chaves.consulta("otif", entrada),
    queryFn: () => chamar(c.otif, { entrada }),
  });

export const consultaTde = (entrada: FiltroPerformanceEntrada) =>
  queryOptions({
    queryKey: chaves.consulta("tde", entrada),
    queryFn: () => chamar(c.tdeAguardando, { entrada }),
  });

export const consultaPrevistos = (
  entrada: FiltroPerformanceEntrada & { ignorarPeriodo: boolean },
) =>
  queryOptions({
    queryKey: chaves.consulta("previstos", entrada),
    queryFn: () => chamar(c.previstos, { entrada }),
  });

export const consultaAlertas = (entrada: FiltroPerformanceEntrada) =>
  queryOptions({
    queryKey: chaves.consulta("alertas", entrada),
    queryFn: () => chamar(c.alertas, { entrada }),
    retry: false,
  });

export const consultaCodigosDisponiveis = (entrada: FiltroPerformanceEntrada) =>
  queryOptions({
    queryKey: chaves.consulta("codigos", entrada),
    queryFn: () => chamar(c.codigosDisponiveis, { entrada }),
    staleTime: 60_000,
  });

export const consultaTiposNoPeriodo = (entrada: FiltroPerformanceEntrada) =>
  queryOptions({
    queryKey: chaves.consulta("tipos", entrada),
    queryFn: () => chamar(c.tiposDocumento, { entrada }),
    staleTime: 60_000,
  });

export const consultaSerie = (
  entrada: FiltroPerformanceEntrada & { granularidade: Granularidade },
) =>
  queryOptions({
    queryKey: chaves.consulta("serie", entrada),
    queryFn: () => chamar(c.serie, { entrada }),
  });

export const consultaRelatorio = (
  entrada: FiltroPerformanceEntrada & { comparativoInicio?: string; comparativoFim?: string },
) =>
  queryOptions({
    queryKey: chaves.consulta("relatorio", entrada),
    queryFn: () => chamar(c.relatorio, { entrada }),
  });

/** Linhas do "Exportar" da tela (`truncado` quando passa do limite de CT-e). Não vai para o cache. */
export const carregarExportacao = (entrada: FiltroPerformanceEntrada) =>
  chamar(c.exportacao, { entrada });
