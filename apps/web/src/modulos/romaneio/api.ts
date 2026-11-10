import { type EntradaDe } from "@erp/shared/contrato";
import { contratosRomaneio as c, type FiltrosRomaneio } from "@erp/shared/contratos/romaneio";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

/** Chave de tudo do Romaneio (o botão "Atualizar" invalida a tela inteira). */
export const CHAVE_DO_ROMANEIO = ["romaneio"] as const;

type Entrada<K extends keyof typeof c> = EntradaDe<(typeof c)[K]>;

/** Aba Hoje: ao vivo, refaz sozinha a cada minuto. */
export const consultaHoje = (entrada: Entrada<"hoje">) =>
  queryOptions({
    queryKey: [...CHAVE_DO_ROMANEIO, "hoje", entrada],
    queryFn: () => chamar(c.hoje, { entrada }),
    refetchInterval: 60_000,
  });

export const consultaCtesDoDia = (entrada: Entrada<"hojeCtes">) =>
  queryOptions({
    queryKey: [...CHAVE_DO_ROMANEIO, "hoje-ctes", entrada],
    queryFn: () => chamar(c.hojeCtes, { entrada }),
  });

export const consultaTotais = (entrada: Entrada<"totais">) =>
  queryOptions({
    queryKey: [...CHAVE_DO_ROMANEIO, "totais", entrada],
    queryFn: () => chamar(c.totais, { entrada }),
  });

export const consultaLista = (entrada: Entrada<"lista">) =>
  queryOptions({
    queryKey: [...CHAVE_DO_ROMANEIO, "lista", entrada],
    queryFn: () => chamar(c.lista, { entrada }),
  });

export const exportarLista = (entrada: Entrada<"exportar">) => chamar(c.exportar, { entrada });

export const consultaDistribuicao = (filtros: FiltrosRomaneio) =>
  queryOptions({
    queryKey: [...CHAVE_DO_ROMANEIO, "distribuicao", filtros],
    queryFn: () => chamar(c.distribuicao, { entrada: { filtros } }),
  });

export const consultaKpis = (filtros: FiltrosRomaneio) =>
  queryOptions({
    queryKey: [...CHAVE_DO_ROMANEIO, "kpis", filtros],
    queryFn: () => chamar(c.kpis, { entrada: { filtros } }),
  });

export const consultaCtesPorCarro = (filtros: FiltrosRomaneio) =>
  queryOptions({
    queryKey: [...CHAVE_DO_ROMANEIO, "ctes-por-carro", filtros],
    queryFn: () => chamar(c.ctesPorCarro, { entrada: { filtros } }),
  });

export const consultaPorViagem = (filtros: FiltrosRomaneio, busca: string) =>
  queryOptions({
    queryKey: [...CHAVE_DO_ROMANEIO, "por-viagem", filtros, busca],
    queryFn: () => chamar(c.porViagem, { entrada: { filtros, ...(busca ? { busca } : {}) } }),
  });

export const consultaPerformanceMotoristas = (filtros: FiltrosRomaneio) =>
  queryOptions({
    queryKey: [...CHAVE_DO_ROMANEIO, "motoristas", filtros],
    queryFn: () => chamar(c.performanceMotoristas, { entrada: { filtros } }),
  });

export const consultaPerformanceAjudantes = (filtros: FiltrosRomaneio) =>
  queryOptions({
    queryKey: [...CHAVE_DO_ROMANEIO, "ajudantes", filtros],
    queryFn: () => chamar(c.performanceAjudantes, { entrada: { filtros } }),
  });

export const consultaPerformanceCarros = (filtros: FiltrosRomaneio) =>
  queryOptions({
    queryKey: [...CHAVE_DO_ROMANEIO, "carros", filtros],
    queryFn: () => chamar(c.performanceCarros, { entrada: { filtros } }),
  });

export const consultaPrejuizo = (filtros: FiltrosRomaneio) =>
  queryOptions({
    queryKey: [...CHAVE_DO_ROMANEIO, "prejuizo", filtros],
    queryFn: () => chamar(c.prejuizo, { entrada: { filtros } }),
  });

export const consultaMotivos = (filtros: FiltrosRomaneio) =>
  queryOptions({
    queryKey: [...CHAVE_DO_ROMANEIO, "motivos", filtros],
    queryFn: () => chamar(c.motivos, { entrada: { filtros, limite: 12 } }),
  });

export const consultaOpcoes = (entrada: Entrada<"opcoes">) =>
  queryOptions({
    queryKey: [...CHAVE_DO_ROMANEIO, "opcoes", entrada],
    queryFn: () => chamar(c.opcoes, { entrada }),
  });

export const consultaLinhaDoTempo = (sigla: string, numero: string) =>
  queryOptions({
    queryKey: [...CHAVE_DO_ROMANEIO, "linha-do-tempo", sigla, numero],
    queryFn: () => chamar(c.linhaDoTempo, { parametros: { sigla, numero } }),
  });
