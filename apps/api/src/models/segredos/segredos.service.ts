/**
 * Recifragem dos segredos (job `recifrar-segredos`, docs/deploy.md §5): regrava com a chave atual
 * todo segredo de integração (das empresas, o anterior do webhook e os da própria Plataforma) que
 * ainda está numa versão antiga da chave mestra. Depois dela, a versão antiga pode sair de
 * `SEGREDOS_CHAVES`. Contexto de Plataforma (só a Plataforma escreve nessas tabelas); nunca loga
 * nem devolve o texto do segredo.
 */
import {
  type ChavesDeSegredo,
  cifrarSegredo,
  contextoDaPlataforma,
  contextoDoSegredo,
  decifrarSegredo,
  type SegredoCifrado,
} from "@erp/db/segredos";

export interface IntegracaoCifrada {
  /** Id da linha da empresa; nas da Plataforma, o próprio tipo. */
  id: string;
  /** Nulo = integração da Plataforma (`plataforma_integracoes`). */
  empresaId: string | null;
  tipo: string;
  segredo: SegredoCifrado | null;
  segredoAnterior: SegredoCifrado | null;
}

export interface RepositorioSegredos {
  /** Integrações com segredo (atual ou anterior) cifrado numa versão diferente de `versao`. */
  foraDaVersao(versao: number): Promise<IntegracaoCifrada[]>;
  regravar(
    linha: IntegracaoCifrada,
    segredos: { segredo: SegredoCifrado | null; segredoAnterior: SegredoCifrado | null },
  ): Promise<void>;
}

interface ResultadoDaRecifragem {
  recifrados: number;
  /** Linhas que não decifram com as chaves configuradas (ficam como estão). */
  falhas: { empresaId: string | null; tipo: string }[];
}

/** Decifra com a versão da linha e cifra de novo com a atual, no mesmo contexto. */
export async function recifrarSegredos(
  repo: RepositorioSegredos,
  chaves: ChavesDeSegredo,
): Promise<ResultadoDaRecifragem> {
  const resultado: ResultadoDaRecifragem = { recifrados: 0, falhas: [] };
  for (const linha of await repo.foraDaVersao(chaves.atual)) {
    const contexto =
      linha.empresaId === null
        ? contextoDaPlataforma(linha.tipo)
        : contextoDoSegredo(linha.empresaId, linha.tipo);
    const recifrar = (s: SegredoCifrado | null) =>
      s === null || s.versaoChave === chaves.atual
        ? s
        : cifrarSegredo(chaves, decifrarSegredo(chaves, s, contexto), contexto);
    try {
      await repo.regravar(linha, {
        segredo: recifrar(linha.segredo),
        segredoAnterior: recifrar(linha.segredoAnterior),
      });
      resultado.recifrados++;
    } catch {
      resultado.falhas.push({ empresaId: linha.empresaId, tipo: linha.tipo });
    }
  }
  return resultado;
}
