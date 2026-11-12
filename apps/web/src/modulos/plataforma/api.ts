import { type EntradaDe } from "@erp/shared/contrato";
import {
  contratosPlataforma as p,
  type DadosDaEmpresa,
  type IntegracaoDaEmpresa,
  type IntegracaoDaPlataforma,
} from "@erp/shared/contratos/plataforma";
import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";

import { consultaAcesso } from "@/acesso/sessao";
import { chamar } from "@/lib/api";
import { ErroDoOperador } from "@/lib/mensagem-de-erro";

import { problemaDoLogo } from "./regras";

export const chaves = {
  tudo: ["plataforma"] as const,
  empresas: ["plataforma", "empresas"] as const,
  empresa: (id: string) => ["plataforma", "empresa", id] as const,
  admins: ["plataforma", "administradores"] as const,
  cargos: ["plataforma", "cargos"] as const,
  integracoes: ["plataforma", "integracoes"] as const,
};

export const consultaEmpresas = queryOptions({
  queryKey: chaves.empresas,
  queryFn: () => chamar(p.listarEmpresas),
});

export const consultaEmpresa = (id: string) =>
  queryOptions({
    queryKey: chaves.empresa(id),
    queryFn: () => chamar(p.obterEmpresa, { parametros: { id } }),
  });

/** Tudo de uma empresa fica sob a chave dela: invalidar a empresa recarrega as abas. */
const consultaDaEmpresa = <S>(id: string, aba: string, buscar: () => Promise<S>) =>
  queryOptions({ queryKey: [...chaves.empresa(id), aba], queryFn: buscar });

export const consultaModulos = (id: string) =>
  consultaDaEmpresa(id, "modulos", () => chamar(p.listarModulos, { parametros: { id } }));

export const consultaIntegracoes = (id: string) =>
  consultaDaEmpresa(id, "integracoes", () => chamar(p.listarIntegracoes, { parametros: { id } }));

export const consultaIntegracoesDaPlataforma = queryOptions({
  queryKey: chaves.integracoes,
  queryFn: () => chamar(p.listarIntegracoesDaPlataforma),
});

export const consultaCargosDaPlataforma = queryOptions({
  queryKey: chaves.cargos,
  queryFn: () => chamar(p.listarCargosDaPlataforma),
});

export const consultaAdmins = queryOptions({
  queryKey: chaves.admins,
  queryFn: () => chamar(p.listarAdmins),
});

/** Invalida as chaves e só resolve depois (o `mutateAsync` espera o cache atualizar). */
const invalidar = (cliente: QueryClient, ...lista: readonly (readonly unknown[])[]) =>
  Promise.all(lista.map((queryKey) => cliente.invalidateQueries({ queryKey })));

/** A empresa (com as abas) e a lista de empresas. */
const invalidarEmpresa = (cliente: QueryClient, id: string) =>
  invalidar(cliente, chaves.empresa(id), chaves.empresas);

/** Mudar a marca ou um módulo muda o menu e as exportações de quem está na empresa: recarrega o acesso. */
const invalidarEmpresaEAcesso = (cliente: QueryClient, id: string) =>
  invalidar(cliente, chaves.empresa(id), chaves.empresas, consultaAcesso.queryKey);

/** Mudar o cargo muda o acesso de quem está nele (inclusive o de quem edita). */
const invalidarEquipe = (cliente: QueryClient) =>
  invalidar(cliente, chaves.cargos, chaves.admins, consultaAcesso.queryKey);

// --- Empresas --------------------------------------------------------------------------------

export const mutacaoCriarEmpresa = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (entrada: EntradaDe<typeof p.criarEmpresa>) => chamar(p.criarEmpresa, { entrada }),
    onSuccess: () => invalidar(cliente, chaves.empresas),
  });

export const mutacaoSalvarEmpresa = (cliente: QueryClient, id: string) =>
  mutationOptions({
    mutationFn: (dados: DadosDaEmpresa) =>
      chamar(p.salvarEmpresa, { parametros: { id }, entrada: dados }),
    onSuccess: () => invalidarEmpresaEAcesso(cliente, id),
  });

/** Conteúdo do arquivo em base64 (sem o prefixo `data:...;base64,`). */
function lerBase64(arquivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const texto = typeof leitor.result === "string" ? leitor.result : "";
      resolve(texto.replace(/^data:[^,]*,/, ""));
    };
    leitor.onerror = () => {
      reject(new Error("Não foi possível ler o arquivo."));
    };
    leitor.readAsDataURL(arquivo);
  });
}

export const mutacaoEnviarLogo = (cliente: QueryClient, id: string) =>
  mutationOptions({
    mutationFn: async (arquivo: File) => {
      const problema = problemaDoLogo(arquivo);
      if (problema) throw new ErroDoOperador(problema);
      return chamar(p.enviarLogo, {
        parametros: { id },
        entrada: { conteudoBase64: await lerBase64(arquivo) },
      });
    },
    onSuccess: () => invalidarEmpresaEAcesso(cliente, id),
  });

export const mutacaoRemoverLogo = (cliente: QueryClient, id: string) =>
  mutationOptions({
    mutationFn: () => chamar(p.removerLogo, { parametros: { id } }),
    onSuccess: () => invalidarEmpresaEAcesso(cliente, id),
  });

export const mutacaoSalvarModulo = (cliente: QueryClient, id: string) =>
  mutationOptions({
    mutationFn: ({
      chave,
      ativo,
      inicio,
      fim,
      observacao,
    }: { chave: string } & EntradaDe<typeof p.salvarModulo>) =>
      chamar(p.salvarModulo, {
        parametros: { id, modulo: chave },
        entrada: { ativo, inicio, fim, observacao },
      }),
    onSuccess: () => invalidarEmpresaEAcesso(cliente, id),
  });

export const mutacaoSalvarIntegracao = (
  cliente: QueryClient,
  id: string,
  tipo: IntegracaoDaEmpresa["tipo"],
) =>
  mutationOptions({
    mutationFn: (entrada: EntradaDe<typeof p.salvarIntegracao>) =>
      chamar(p.salvarIntegracao, { parametros: { id, tipo }, entrada }),
    onSuccess: () => invalidarEmpresa(cliente, id),
  });

/** `""` remove o segredo. */
export const mutacaoDefinirSegredo = (
  cliente: QueryClient,
  id: string,
  tipo: IntegracaoDaEmpresa["tipo"],
) =>
  mutationOptions({
    mutationFn: (segredo: string) =>
      chamar(p.definirSegredo, { parametros: { id, tipo }, entrada: { segredo } }),
    onSuccess: () => invalidarEmpresa(cliente, id),
  });

// --- Integrações da Plataforma ---------------------------------------------------------------

export const mutacaoSalvarIntegracaoDaPlataforma = (
  cliente: QueryClient,
  tipo: IntegracaoDaPlataforma["tipo"],
) =>
  mutationOptions({
    mutationFn: (entrada: EntradaDe<typeof p.salvarIntegracaoDaPlataforma>) =>
      chamar(p.salvarIntegracaoDaPlataforma, { parametros: { tipo }, entrada }),
    onSuccess: () => invalidar(cliente, chaves.integracoes),
  });

/** `""` remove o segredo. */
export const mutacaoDefinirSegredoDaPlataforma = (
  cliente: QueryClient,
  tipo: IntegracaoDaPlataforma["tipo"],
) =>
  mutationOptions({
    mutationFn: (segredo: string) =>
      chamar(p.definirSegredoDaPlataforma, { parametros: { tipo }, entrada: { segredo } }),
    onSuccess: () => invalidar(cliente, chaves.integracoes),
  });

/** O e-mail de teste não muda nada na tela: sem invalidação. */
export const mutacaoTestarEmailDaPlataforma = () =>
  mutationOptions({
    mutationFn: (para: string) => chamar(p.testarEmailDaPlataforma, { entrada: { para } }),
  });

// --- Equipe e cargos da Plataforma -----------------------------------------------------------

export const mutacaoCriarCargoDaPlataforma = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (entrada: EntradaDe<typeof p.criarCargoDaPlataforma>) =>
      chamar(p.criarCargoDaPlataforma, { entrada }),
    onSuccess: () => invalidarEquipe(cliente),
  });

export const mutacaoAlterarCargoDaPlataforma = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: ({
      chave,
      rotulo,
      permissoes,
    }: { chave: string } & EntradaDe<typeof p.alterarCargoDaPlataforma>) =>
      chamar(p.alterarCargoDaPlataforma, {
        parametros: { chave },
        entrada: { rotulo, permissoes },
      }),
    onSuccess: () => invalidarEquipe(cliente),
  });

export const mutacaoExcluirCargoDaPlataforma = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (chave: string) => chamar(p.excluirCargoDaPlataforma, { parametros: { chave } }),
    onSuccess: () => invalidarEquipe(cliente),
  });

export const mutacaoAdicionarAdmin = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (entrada: EntradaDe<typeof p.adicionarAdmin>) =>
      chamar(p.adicionarAdmin, { entrada }),
    onSuccess: () => invalidarEquipe(cliente),
  });

export const mutacaoTrocarCargoDoAdmin = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: ({ usuarioId, cargo }: { usuarioId: string; cargo: string }) =>
      chamar(p.trocarCargoDoAdmin, { parametros: { usuarioId }, entrada: { cargo } }),
    onSuccess: () => invalidarEquipe(cliente),
  });

export const mutacaoRemoverAdmin = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (usuarioId: string) => chamar(p.removerAdmin, { parametros: { usuarioId } }),
    onSuccess: () => invalidarEquipe(cliente),
  });
