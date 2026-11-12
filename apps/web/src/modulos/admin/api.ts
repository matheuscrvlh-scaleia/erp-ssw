import { type EntradaDe } from "@erp/shared/contrato";
import {
  type Configuracao,
  contratosAdmin as c,
  contratosConfiguracoes,
  type DadosDoPrazo,
  type ExcecaoDePermissaoGravada,
  type GrupoDeConfiguracao,
  type NovoUsuario,
} from "@erp/shared/contratos/admin";
import { contratosAuditoria as a, ORIGENS_INTEGRACAO } from "@erp/shared/contratos/auditoria";
import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";

import { consultaAcesso } from "@/acesso/sessao";
import { chamar } from "@/lib/api";

export const chaves = {
  tudo: ["admin"] as const,
  usuarios: ["admin", "usuarios"] as const,
  cargos: ["admin", "cargos"] as const,
  configuracoes: ["admin", "configuracoes"] as const,
  publicas: ["admin", "configuracoes-publicas"] as const,
  prazos: ["admin", "prazos"] as const,
  logs: ["admin", "logs"] as const,
};

export const consultaUsuarios = queryOptions({
  queryKey: chaves.usuarios,
  queryFn: () => chamar(c.listarUsuarios),
});

export const consultaCargos = queryOptions({
  queryKey: chaves.cargos,
  queryFn: () => chamar(c.listarCargos),
});

export const consultaConfiguracoes = queryOptions({
  queryKey: chaves.configuracoes,
  queryFn: () => chamar(c.listarConfiguracoes),
});

/** Limiares das telas (meta de SLA etc.) da empresa ativa: qualquer usuário lê. */
export const consultaConfiguracoesPublicas = queryOptions({
  queryKey: chaves.publicas,
  queryFn: () => chamar(contratosConfiguracoes.publicas),
  staleTime: 5 * 60_000,
});

export const consultaPrazos = queryOptions({
  queryKey: chaves.prazos,
  queryFn: () => chamar(c.listarPrazos),
});

const ouNada = (v: string) => (v.trim() ? v.trim() : undefined);

/** De quem são as alterações: da empresa ativa ou de todas (Plataforma). */
export type EscopoDasAlteracoes = "empresa" | { empresas: readonly { id: string; nome: string }[] };

interface FiltrosDasAlteracoes {
  de: string;
  ate: string;
  ator: string;
  entidade: string;
  acao: string;
  empresa: string;
}

export const consultaAlteracoes = (escopo: EscopoDasAlteracoes, filtros: FiltrosDasAlteracoes) =>
  queryOptions({
    queryKey: [...chaves.logs, "alteracoes", escopo, filtros],
    queryFn: () => {
      const entrada = {
        ator: ouNada(filtros.ator),
        entidade: ouNada(filtros.entidade),
        acao: ouNada(filtros.acao),
        de: ouNada(filtros.de),
        ate: ouNada(filtros.ate),
      };
      if (escopo === "empresa") return chamar(a.alteracoesDaEmpresa, { entrada });
      return chamar(a.alteracoesDaPlataforma, {
        entrada: { ...entrada, empresa: ouNada(filtros.empresa) },
      });
    },
  });

interface FiltrosDasIntegracoes {
  de: string;
  ate: string;
  origem: string;
}

/** Sem `empresaId`: a empresa ativa. Com ele: a empresa escolhida na Plataforma. */
export const consultaIntegracoes = (
  empresaId: string | undefined,
  filtros: FiltrosDasIntegracoes,
) =>
  queryOptions({
    queryKey: [...chaves.logs, "integracoes", empresaId ?? "ativa", filtros],
    queryFn: () => {
      const origem = ORIGENS_INTEGRACAO.find((o) => o === filtros.origem);
      const entrada = { origem, de: ouNada(filtros.de), ate: ouNada(filtros.ate) };
      return empresaId
        ? chamar(a.integracoesDeEmpresaNaPlataforma, { parametros: { id: empresaId }, entrada })
        : chamar(a.integracoesDaEmpresa, { entrada });
    },
  });

/** Invalida as chaves e só resolve depois (o `mutateAsync` espera o cache atualizar). */
const invalidar = (cliente: QueryClient, ...lista: readonly (readonly unknown[])[]) =>
  Promise.all(lista.map((queryKey) => cliente.invalidateQueries({ queryKey })));

export const mutacaoSalvarConfiguracoes = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: ({ grupo, itens }: { grupo: GrupoDeConfiguracao; itens: Configuracao[] }) =>
      chamar(c.salvarConfiguracoes, {
        parametros: { grupo },
        entrada: { itens: itens.map((i) => ({ chave: i.chave, valor: i.valor })) },
      }),
    onSuccess: () => invalidar(cliente, chaves.configuracoes, chaves.publicas),
  });

export const mutacaoSalvarPrazo = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, dados }: { id: string | null; dados: DadosDoPrazo }) =>
      id
        ? chamar(c.alterarPrazo, { parametros: { id }, entrada: dados })
        : chamar(c.criarPrazo, { entrada: dados }),
    onSuccess: () => invalidar(cliente, chaves.prazos),
  });

export const mutacaoLigarPrazo = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      chamar(c.ligarPrazo, { parametros: { id }, entrada: { ativo } }),
    onSuccess: () => invalidar(cliente, chaves.prazos),
  });

export const mutacaoExcluirPrazo = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (id: string) => chamar(c.excluirPrazo, { parametros: { id } }),
    onSuccess: () => invalidar(cliente, chaves.prazos),
  });

/** Mudar permissões de um cargo muda o acesso de quem o usa (inclusive o de quem edita). */
const invalidarCargos = (cliente: QueryClient) =>
  invalidar(cliente, chaves.cargos, chaves.usuarios, consultaAcesso.queryKey);

export const mutacaoCriarCargo = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (entrada: EntradaDe<typeof c.criarCargo>) => chamar(c.criarCargo, { entrada }),
    onSuccess: () => invalidarCargos(cliente),
  });

export const mutacaoAlterarCargo = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: ({
      chave,
      rotulo,
      permissoes,
    }: { chave: string } & EntradaDe<typeof c.alterarCargo>) =>
      chamar(c.alterarCargo, { parametros: { chave }, entrada: { rotulo, permissoes } }),
    onSuccess: () => invalidarCargos(cliente),
  });

export const mutacaoExcluirCargo = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (chave: string) => chamar(c.excluirCargo, { parametros: { chave } }),
    onSuccess: () => invalidarCargos(cliente),
  });

export const mutacaoCriarUsuario = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (novo: NovoUsuario) => chamar(c.criarUsuario, { entrada: novo }),
    onSuccess: () => invalidar(cliente, chaves.usuarios, chaves.cargos),
  });

export const mutacaoAlterarUsuario = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, dados }: { id: string; dados: EntradaDe<typeof c.alterarUsuario> }) =>
      chamar(c.alterarUsuario, { parametros: { id }, entrada: dados }),
    onSuccess: () => invalidar(cliente, chaves.usuarios, chaves.cargos),
  });

export const mutacaoDefinirExcecoes = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, excecoes }: { id: string; excecoes: ExcecaoDePermissaoGravada[] }) =>
      chamar(c.definirExcecoes, { parametros: { id }, entrada: { excecoes } }),
    onSuccess: () => invalidar(cliente, chaves.usuarios),
  });

export const mutacaoDefinirSenha = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, senha }: { id: string; senha: string }) =>
      chamar(c.definirSenha, { parametros: { id }, entrada: { senha } }),
    onSuccess: () => invalidar(cliente, chaves.usuarios),
  });

/** Reenviar o convite não muda nada na lista: sem invalidação. */
export const mutacaoReenviarConvite = () =>
  mutationOptions({
    mutationFn: (id: string) => chamar(c.reenviarConvite, { parametros: { id } }),
  });
