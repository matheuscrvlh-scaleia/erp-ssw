/**
 * Configuração da própria Plataforma (domínio, e-mail pelo Resend, worker-ssw), gravada na tela
 * Plataforma › Integrações. Lida do banco com cache curto: o que a tela salva vale em segundos,
 * sem reiniciar a API. Segredo que não decifra (chave mestra trocada) conta como não configurado e
 * vai para o log, nunca para a resposta.
 */
import {
  type ChavesDeSegredo,
  contextoDaPlataforma,
  decifrarSegredo,
  type SegredoCifrado,
} from "@erp/db/segredos";
import { PARAMETROS_DA_INTEGRACAO_PLATAFORMA } from "@erp/shared/contratos/plataforma";
import { type TipoIntegracaoPlataforma } from "@erp/shared/plataforma";

interface LinhaDaPlataforma {
  tipo: TipoIntegracaoPlataforma;
  parametros: Record<string, unknown>;
  segredo: SegredoCifrado | null;
}

export interface ConfiguracaoDaPlataforma {
  /** Origem pública do ERP (ex.: https://erp.empresa.com.br), sem barra no fim. */
  dominio: string | null;
  email: { remetente: string; chaveApi: string } | null;
  workerSsw: { url: string; token: string } | null;
}

export interface FonteDaConfiguracao {
  obter(): Promise<ConfiguracaoDaPlataforma>;
  /** A tela salvou: a próxima leitura vai ao banco. */
  invalidar(): void;
}

const VALIDADE_MS = 30_000;

/** Monta a configuração a partir das linhas gravadas; o que estiver incompleto fica nulo. */
function montarConfiguracao(
  linhas: readonly LinhaDaPlataforma[],
  chaves: ChavesDeSegredo | null,
  aoFalhar: (erro: unknown, tipo: TipoIntegracaoPlataforma) => void,
): ConfiguracaoDaPlataforma {
  const linha = (tipo: TipoIntegracaoPlataforma) => linhas.find((l) => l.tipo === tipo);
  const segredo = (tipo: TipoIntegracaoPlataforma): string | null => {
    const gravado = linha(tipo)?.segredo;
    if (!gravado || !chaves) return null;
    try {
      return decifrarSegredo(chaves, gravado, contextoDaPlataforma(tipo));
    } catch (erro) {
      aoFalhar(erro, tipo);
      return null;
    }
  };
  const lidos = PARAMETROS_DA_INTEGRACAO_PLATAFORMA;
  const dominio = lidos.dominio.safeParse(linha("dominio")?.parametros).data;
  const email = lidos.email.safeParse(linha("email")?.parametros).data;
  const worker = lidos.worker_ssw.safeParse(linha("worker_ssw")?.parametros).data;
  const chaveApi = email ? segredo("email") : null;
  const token = worker ? segredo("worker_ssw") : null;
  return {
    dominio: dominio ? new URL(dominio.url).origin : null,
    email: email && chaveApi ? { remetente: email.remetente, chaveApi } : null,
    workerSsw: worker && token ? { url: worker.url, token } : null,
  };
}

export function criarFonteDaConfiguracao(deps: {
  ler: () => Promise<LinhaDaPlataforma[]>;
  chaves: ChavesDeSegredo | null;
  agora: () => Date;
  aoFalhar: (erro: unknown, tipo: TipoIntegracaoPlataforma) => void;
}): FonteDaConfiguracao {
  let cache: { valor: Promise<ConfiguracaoDaPlataforma>; ate: number } | null = null;
  return {
    obter: () => {
      const agora = deps.agora().getTime();
      if (cache && cache.ate > agora) return cache.valor;
      const valor = deps
        .ler()
        .then((linhas) => montarConfiguracao(linhas, deps.chaves, deps.aoFalhar));
      const atual = { valor, ate: agora + VALIDADE_MS };
      cache = atual;
      // Banco fora: não guarda a falha, a próxima chamada tenta de novo.
      valor.catch(() => {
        if (cache === atual) cache = null;
      });
      return valor;
    },
    invalidar: () => {
      cache = null;
    },
  };
}
