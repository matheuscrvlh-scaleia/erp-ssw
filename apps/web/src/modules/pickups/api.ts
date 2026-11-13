import {
  contratosColetas as c,
  type FiltrosDeColetas,
  type ResultadoDaImportacao050,
  type StatusDaLista,
  TAMANHO_MAXIMO_DO_050,
} from "@erp/shared/contracts/pickups";
import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

import { lerArquivo050 } from "./rules";

interface PaginaDaLista {
  status: StatusDaLista;
  busca: string;
  pagina: number;
  tamanho: number;
}

export const chaves = {
  tudo: ["coletas"] as const,
  painel: (filtros: FiltrosDeColetas) => [...chaves.tudo, "painel", filtros] as const,
  lista: (filtros: FiltrosDeColetas, p: PaginaDaLista) =>
    [...chaves.tudo, "lista", filtros, p] as const,
  detalhe: (unidade: string, numero: number) =>
    [...chaves.tudo, "detalhe", unidade, numero] as const,
};

/** O 050 chega pelo FTP a cada ciclo: o painel reconsulta para o selo e os números acompanharem. */
export const consultaPainel = (filtros: FiltrosDeColetas) =>
  queryOptions({
    queryKey: chaves.painel(filtros),
    queryFn: () => chamar(c.painel, { entrada: filtros }),
    refetchInterval: 5 * 60_000,
  });

export const consultaLista = (filtros: FiltrosDeColetas, p: PaginaDaLista) =>
  queryOptions({
    queryKey: chaves.lista(filtros, p),
    queryFn: () => chamar(c.lista, { entrada: { ...filtros, ...p } }),
  });

export const carregarListaInteira = (
  filtros: FiltrosDeColetas,
  status: StatusDaLista,
  busca: string,
) => chamar(c.exportar, { entrada: { ...filtros, status, busca } }).then((r) => r.linhas);

export const consultaDetalhe = (unidade: string, numero: number) =>
  queryOptions({
    queryKey: chaves.detalhe(unidade, numero),
    queryFn: () => chamar(c.detalhe, { parametros: { unidade, numero: String(numero) } }),
  });

/** Arquivo + ordem do envio (o mesmo arquivo pode ser importado de novo). */
export interface ArquivoImportado050 {
  chave: string;
  arquivo: string;
  resultado: ResultadoDaImportacao050;
}

interface LoteDo050 {
  arquivos: readonly File[];
  /** Arquivo maior que o limite do servidor: não é enviado e o lote segue. */
  aoRecusarPorTamanho: (arquivo: File) => void;
  /** Erro na leitura ou na API: o lote segue com os demais arquivos. */
  aoFalhar: (arquivo: File, erro: unknown) => void;
  /** Fim do lote, antes de invalidar o cache (a tela mostra o resultado e o aviso primeiro). */
  aoConcluir: (novos: ArquivoImportado050[]) => void;
}

/** Grava os arquivos em sequência, um por chamada; o cache é invalidado uma vez, no fim do lote. */
export const mutacaoImportar050 = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: async (lote: LoteDo050) => {
      const novos: ArquivoImportado050[] = [];
      for (const arquivo of lote.arquivos) {
        try {
          const conteudo = await lerArquivo050(arquivo);
          if (conteudo.length > TAMANHO_MAXIMO_DO_050) {
            lote.aoRecusarPorTamanho(arquivo);
            continue;
          }
          const resultado = await chamar(c.importar050, {
            entrada: { conteudo, arquivoOrigem: arquivo.name },
          });
          novos.push({
            chave: `${arquivo.name}-${String(Date.now())}-${String(novos.length)}`,
            arquivo: arquivo.name,
            resultado,
          });
        } catch (e) {
          lote.aoFalhar(arquivo, e);
        }
      }
      return novos;
    },
    onSuccess: async (novos, lote) => {
      lote.aoConcluir(novos);
      if (novos.length > 0) await cliente.invalidateQueries({ queryKey: chaves.tudo });
    },
  });
