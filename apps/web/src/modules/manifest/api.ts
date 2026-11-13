import { type EntradaDe } from "@erp/shared/contract";
import { contratosRomaneio as c, type FiltrosRomaneio } from "@erp/shared/contracts/manifest";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

/** Chaves do Romaneio: `tudo` é o que o botão "Atualizar" invalida (a tela inteira). */
export const chaves = {
  tudo: ["romaneio"] as const,
  consulta: (nome: string, ...partes: readonly unknown[]) =>
    [...chaves.tudo, nome, ...partes] as const,
};

type Entrada<K extends keyof typeof c> = EntradaDe<(typeof c)[K]>;

/** Aba Hoje: ao vivo, refaz sozinha a cada minuto. */
export const consultaHoje = (entrada: Entrada<"hoje">) =>
  queryOptions({
    queryKey: chaves.consulta("hoje", entrada),
    queryFn: () => chamar(c.hoje, { entrada }),
    refetchInterval: 60_000,
  });

export const consultaCtesDoDia = (entrada: Entrada<"hojeCtes">) =>
  queryOptions({
    queryKey: chaves.consulta("hoje-ctes", entrada),
    queryFn: () => chamar(c.hojeCtes, { entrada }),
  });

export const consultaTotais = (entrada: Entrada<"totais">) =>
  queryOptions({
    queryKey: chaves.consulta("totais", entrada),
    queryFn: () => chamar(c.totais, { entrada }),
  });

export const consultaLista = (entrada: Entrada<"lista">) =>
  queryOptions({
    queryKey: chaves.consulta("lista", entrada),
    queryFn: () => chamar(c.lista, { entrada }),
  });

export const exportarLista = (entrada: Entrada<"exportar">) => chamar(c.exportar, { entrada });

export const consultaDistribuicao = (filtros: FiltrosRomaneio) =>
  queryOptions({
    queryKey: chaves.consulta("distribuicao", filtros),
    queryFn: () => chamar(c.distribuicao, { entrada: { filtros } }),
  });

export const consultaKpis = (filtros: FiltrosRomaneio) =>
  queryOptions({
    queryKey: chaves.consulta("kpis", filtros),
    queryFn: () => chamar(c.kpis, { entrada: { filtros } }),
  });

export const consultaCtesPorCarro = (filtros: FiltrosRomaneio) =>
  queryOptions({
    queryKey: chaves.consulta("ctes-por-carro", filtros),
    queryFn: () => chamar(c.ctesPorCarro, { entrada: { filtros } }),
  });

export const consultaPorViagem = (filtros: FiltrosRomaneio, busca: string) =>
  queryOptions({
    queryKey: chaves.consulta("por-viagem", filtros, busca),
    queryFn: () => chamar(c.porViagem, { entrada: { filtros, ...(busca ? { busca } : {}) } }),
  });

export const consultaPerformanceMotoristas = (filtros: FiltrosRomaneio) =>
  queryOptions({
    queryKey: chaves.consulta("motoristas", filtros),
    queryFn: () => chamar(c.performanceMotoristas, { entrada: { filtros } }),
  });

export const consultaPerformanceAjudantes = (filtros: FiltrosRomaneio) =>
  queryOptions({
    queryKey: chaves.consulta("ajudantes", filtros),
    queryFn: () => chamar(c.performanceAjudantes, { entrada: { filtros } }),
  });

export const consultaPerformanceCarros = (filtros: FiltrosRomaneio) =>
  queryOptions({
    queryKey: chaves.consulta("carros", filtros),
    queryFn: () => chamar(c.performanceCarros, { entrada: { filtros } }),
  });

export const consultaPrejuizo = (filtros: FiltrosRomaneio) =>
  queryOptions({
    queryKey: chaves.consulta("prejuizo", filtros),
    queryFn: () => chamar(c.prejuizo, { entrada: { filtros } }),
  });

export const consultaMotivos = (filtros: FiltrosRomaneio) =>
  queryOptions({
    queryKey: chaves.consulta("motivos", filtros),
    queryFn: () => chamar(c.motivos, { entrada: { filtros, limite: 12 } }),
  });

export const consultaOpcoes = (entrada: Entrada<"opcoes">) =>
  queryOptions({
    queryKey: chaves.consulta("opcoes", entrada),
    queryFn: () => chamar(c.opcoes, { entrada }),
  });

export const consultaLinhaDoTempo = (sigla: string, numero: string) =>
  queryOptions({
    queryKey: chaves.consulta("linha-do-tempo", sigla, numero),
    queryFn: () => chamar(c.linhaDoTempo, { parametros: { sigla, numero } }),
  });
