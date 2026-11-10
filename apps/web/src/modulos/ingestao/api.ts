import { contratosIngestao as c } from "@erp/shared/contratos/ingestao";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

export const CHAVE_DA_INGESTAO = ["ingestao"] as const;

/** Pipeline automático: a tela atualiza a cada 60 s (como hoje). */
export const consultaPipeline = queryOptions({
  queryKey: [...CHAVE_DA_INGESTAO, "pipeline"],
  queryFn: () => chamar(c.pipeline),
  refetchInterval: 60_000,
});

export const consultaAplicacoes = queryOptions({
  queryKey: [...CHAVE_DA_INGESTAO, "aplicacoes"],
  queryFn: () => chamar(c.aplicacoes),
});

/** Sincronização do FTP: com execução em andamento, a tela acompanha a cada 3 s. */
export const consultaFtp = queryOptions({
  queryKey: [...CHAVE_DA_INGESTAO, "ftp"],
  queryFn: () => chamar(c.ftp),
  refetchInterval: (q) => (q.state.data?.travaAtiva ? 3_000 : 30_000),
});

export const consultaArquivosXml = queryOptions({
  queryKey: [...CHAVE_DA_INGESTAO, "xml"],
  queryFn: () => chamar(c.arquivosXml),
  refetchInterval: 120_000,
});
