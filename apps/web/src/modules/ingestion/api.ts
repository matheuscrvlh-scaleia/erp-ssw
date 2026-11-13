import { type EntradaDe, type SaidaDe } from "@erp/shared/contract";
import {
  contratosIngestao as c,
  type ResultadoDoBlocoDeAplicacao,
  type ResultadoDoXml,
} from "@erp/shared/contracts/ingestion";
import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/error-message";

/** Chaves do cache do módulo: toda escrita invalida `tudo` (pipeline e FTP). */
export const chaves = {
  tudo: ["ingestao"] as const,
  pipeline: () => [...chaves.tudo, "pipeline"] as const,
  ftp: () => [...chaves.tudo, "ftp"] as const,
};

/** Pipeline automático: a tela atualiza a cada 60 s (como hoje). */
export const consultaPipeline = queryOptions({
  queryKey: chaves.pipeline(),
  queryFn: () => chamar(c.pipeline),
  refetchInterval: 60_000,
});

/** Sincronização do FTP: com execução em andamento, a tela acompanha a cada 3 s. */
export const consultaFtp = queryOptions({
  queryKey: chaves.ftp(),
  queryFn: () => chamar(c.ftp),
  refetchInterval: (q) => (q.state.data?.travaAtiva ? 3_000 : 30_000),
});

/**
 * Fim da escrita, com ou sem erro: a tela avisa (toast) e libera os botões antes de o cache ser
 * invalidado, como hoje.
 */
interface ComAviso<S = unknown> {
  aoTerminar: (saida: S | undefined, erro: Error | null) => void;
}

/** Avisa a tela e invalida o módulo inteiro (sucesso ou erro). */
async function avisarEInvalidar<S>(
  cliente: QueryClient,
  { aoTerminar }: ComAviso<S>,
  saida: S | undefined,
  erro: Error | null,
) {
  aoTerminar(saida, erro);
  await cliente.invalidateQueries({ queryKey: chaves.tudo });
}

export const mutacaoRetomarCiclo = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: ({ chave }: { chave: string } & ComAviso) =>
      chamar(c.retomarCiclo, { parametros: { chave } }),
    onSettled: (saida, erro, aviso) => avisarEInvalidar(cliente, aviso, saida, erro),
  });

export const mutacaoDescartarCiclo = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: ({ chave, motivo }: { chave: string; motivo: string } & ComAviso) =>
      chamar(c.descartarCiclo, { parametros: { chave }, entrada: { motivo } }),
    onSettled: (saida, erro, aviso) => avisarEInvalidar(cliente, aviso, saida, erro),
  });

interface GravacaoDoRelatorio {
  entrada: EntradaDe<typeof c.importarRelatorio>;
  /** Gravado: a tela avisa e limpa o formulário antes de o cache ser invalidado (como hoje). */
  aoGravar: (saida: SaidaDe<typeof c.importarRelatorio>) => void;
}

/** Grava o relatório na staging; só o sucesso invalida o cache. */
export const mutacaoImportarRelatorio = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: ({ entrada }: GravacaoDoRelatorio) => chamar(c.importarRelatorio, { entrada }),
    onSuccess: async (saida, { aoGravar }) => {
      aoGravar(saida);
      await cliente.invalidateQueries({ queryKey: chaves.tudo });
    },
  });

interface AplicacaoEmBlocos extends ComAviso {
  dryRun: boolean;
  /** CT-e por bloco. */
  lote: number;
  /** Antes de cada bloco (1, 2, …). */
  aoIniciarBloco: (bloco: number) => void;
  aoConcluirBloco: (resultado: ResultadoDoBlocoDeAplicacao) => void;
}

/**
 * Aplica a staging bloco a bloco até acabar. A simulação avança o offset; a aplicação não (o que
 * foi aplicado sai da fila). O cache é invalidado uma vez, no fim (com ou sem erro).
 */
export const mutacaoAplicarStaging = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: async ({ dryRun, lote, aoIniciarBloco, aoConcluirBloco }: AplicacaoEmBlocos) => {
      let offset = 0;
      for (let bloco = 1; ; bloco++) {
        aoIniciarBloco(bloco);
        const r = await chamar(c.aplicar, { entrada: { dryRun, limite: lote, offset } });
        aoConcluirBloco(r);
        if (!r.temMais) break;
        offset += dryRun ? lote : 0;
      }
    },
    onSettled: (saida, erro, aviso) => avisarEInvalidar(cliente, aviso, saida, erro),
  });

export const mutacaoPausarFtp = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: ({ ativo }: { ativo: boolean } & ComAviso) =>
      chamar(c.pausarFtp, { entrada: { ativo } }),
    onSettled: (saida, erro, aviso) => avisarEInvalidar(cliente, aviso, saida, erro),
  });

export const mutacaoRodarFtp = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (_: ComAviso) => chamar(c.rodarFtp),
    onSettled: (saida, erro, aviso) => avisarEInvalidar(cliente, aviso, saida, erro),
  });

export const mutacaoLiberarTravaFtp = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (_: ComAviso) => chamar(c.liberarTravaFtp),
    onSettled: (saida, erro, aviso) => avisarEInvalidar(cliente, aviso, saida, erro),
  });

async function emBase64(arquivo: File): Promise<string> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  let texto = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(texto);
}

interface EnvioDeXml {
  arquivos: readonly File[];
  /** Antes de cada arquivo (1, 2, …). */
  aoEnviar: (atual: number, total: number) => void;
  /** Resultados até aqui, depois de cada arquivo. */
  aoReceber: (resultados: ResultadoDoXml[]) => void;
  /** Fim do envio, antes de invalidar o cache. */
  aoConcluir: () => void;
}

/**
 * Envia os XML/ZIP em sequência, um por chamada. Arquivo que falha entra como "erro" no resultado
 * e o envio segue; o cache é invalidado uma vez, no fim.
 */
export const mutacaoImportarXml = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: async ({ arquivos, aoEnviar, aoReceber }: EnvioDeXml) => {
      const saida: ResultadoDoXml[] = [];
      for (const [i, arquivo] of arquivos.entries()) {
        aoEnviar(i + 1, arquivos.length);
        try {
          saida.push(
            await chamar(c.importarXml, {
              entrada: { nome: arquivo.name, base64: await emBase64(arquivo) },
            }),
          );
        } catch (e) {
          saida.push({
            arquivo: arquivo.name,
            status: "erro",
            ctesProcessados: 0,
            cancelamentos: 0,
            orfaos: 0,
            pulados: 0,
            erros: [{ nome: arquivo.name, erro: mensagemAmigavel(e) }],
          });
        }
        aoReceber([...saida]);
      }
    },
    onSuccess: async (_, { aoConcluir }) => {
      aoConcluir();
      await cliente.invalidateQueries({ queryKey: chaves.tudo });
    },
  });

export const mutacaoReprocessarOrfaos = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (_: ComAviso<SaidaDe<typeof c.reprocessarOrfaos>>) => chamar(c.reprocessarOrfaos),
    onSettled: (saida, erro, aviso) => avisarEInvalidar(cliente, aviso, saida, erro),
  });
