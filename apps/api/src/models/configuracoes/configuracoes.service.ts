import { mudancaParaAuditoria } from "@erp/dominio/auditoria";
import { CHAVES_PUBLICAS, validarValorDeConfiguracao } from "@erp/dominio/configuracoes";
import { ErroDeNegocio } from "@erp/dominio/erros";
import { type GrupoDeConfiguracao, GRUPOS_DE_CONFIGURACAO } from "@erp/shared/contratos/admin";

import { type Ator } from "../auditoria/auditoria.service";
import { type Executor } from "../repositorios";
import { type CacheDeConfiguracoes } from "./cache";

export interface ConfiguracaoGravada {
  chave: string;
  valor: string;
  descricao: string;
  grupo: string;
  atualizadoEm: Date;
}

export interface RepositorioConfiguracoes {
  /** Chaves da empresa (sem as da Plataforma, de empresa nula) dos grupos pedidos. */
  daEmpresa(empresaId: string, grupos: readonly string[]): Promise<ConfiguracaoGravada[]>;
  /** Valores vigentes (empresa vence Plataforma) das chaves pedidas que existem. */
  vigentes(empresaId: string, chaves: readonly string[]): Promise<Map<string, string>>;
  gravarValor(
    empresaId: string,
    chave: string,
    valor: string,
    atualizadoPor: string,
  ): Promise<void>;
}

/**
 * Configurações que o Admin edita: só as da empresa, dos quatro grupos.
 * origem: listarConfiguracoes (configuracoes.functions.ts, sistema atual)
 */
export async function listarConfiguracoes(
  db: Executor<"configuracoes">,
  empresaId: string,
): Promise<ConfiguracaoGravada[]> {
  return db(({ configuracoes }) => configuracoes.daEmpresa(empresaId, GRUPOS_DE_CONFIGURACAO));
}

/**
 * Salva os valores de um grupo (cada chave tem de existir na empresa e ser do grupo), registra o
 * que mudou e invalida o cache da empresa.
 * origem: salvarConfiguracoesGrupo (configuracoes.functions.ts, sistema atual)
 */
export async function salvarConfiguracoes(
  db: Executor<"configuracoes" | "auditoria">,
  cache: CacheDeConfiguracoes,
  empresaId: string,
  ator: Ator,
  grupo: GrupoDeConfiguracao,
  itens: readonly { chave: string; valor: string }[],
): Promise<{ atualizados: number }> {
  const atualizados = await db(async ({ configuracoes, auditoria }) => {
    const existentes = new Map(
      (await configuracoes.daEmpresa(empresaId, GRUPOS_DE_CONFIGURACAO)).map((c) => [c.chave, c]),
    );
    const novos = itens.map(({ chave, valor }) => {
      const atual = existentes.get(chave);
      if (!atual) throw new ErroDeNegocio("ENTRADA_INVALIDA", `Configuração "${chave}" não existe`);
      if (atual.grupo !== grupo) {
        throw new ErroDeNegocio(
          "ENTRADA_INVALIDA",
          `Configuração "${chave}" não pertence ao grupo ${grupo}`,
        );
      }
      return { atual, valor: validarValorDeConfiguracao(chave, valor) };
    });
    for (const { atual, valor } of novos) {
      await configuracoes.gravarValor(empresaId, atual.chave, valor, ator.usuarioId);
      const mudanca = mudancaParaAuditoria({
        acao: "alterar",
        antes: { valor: atual.valor },
        depois: { valor },
        chaveDeConfiguracao: atual.chave,
      });
      if (mudanca) {
        await auditoria.registrar(ator, {
          empresaId,
          acao: "alterar",
          entidade: "configuracao",
          entidadeId: atual.chave,
          resumo: null,
          ...mudanca,
        });
      }
    }
    return novos.length;
  });
  cache.invalidar(empresaId);
  return { atualizados };
}

/**
 * Limiares e alertas que qualquer usuário da empresa lê. Sem empresa: nada.
 * origem: getConfiguracoesPublicas (configuracoes.functions.ts, sistema atual)
 */
export async function configuracoesPublicas(
  db: Executor<"configuracoes">,
  empresaId: string | null,
): Promise<Map<string, string>> {
  if (!empresaId) return new Map();
  return db(({ configuracoes }) => configuracoes.vigentes(empresaId, CHAVES_PUBLICAS));
}
