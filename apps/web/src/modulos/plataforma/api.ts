import { contratosPlataforma as p } from "@erp/shared/contratos/plataforma";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

export const CHAVES_DA_PLATAFORMA = {
  empresas: ["plataforma", "empresas"],
  empresa: (id: string) => ["plataforma", "empresa", id],
  admins: ["plataforma", "administradores"],
  cargos: ["plataforma", "cargos"],
  integracoes: ["plataforma", "integracoes"],
} as const;

export const consultaEmpresas = queryOptions({
  queryKey: CHAVES_DA_PLATAFORMA.empresas,
  queryFn: () => chamar(p.listarEmpresas),
});

export const consultaEmpresa = (id: string) =>
  queryOptions({
    queryKey: CHAVES_DA_PLATAFORMA.empresa(id),
    queryFn: () => chamar(p.obterEmpresa, { parametros: { id } }),
  });

/** Tudo de uma empresa fica sob a chave dela: invalidar a empresa recarrega as abas. */
const consultaDaEmpresa = <S>(id: string, aba: string, buscar: () => Promise<S>) =>
  queryOptions({ queryKey: [...CHAVES_DA_PLATAFORMA.empresa(id), aba], queryFn: buscar });

export const consultaModulos = (id: string) =>
  consultaDaEmpresa(id, "modulos", () => chamar(p.listarModulos, { parametros: { id } }));

export const consultaIntegracoes = (id: string) =>
  consultaDaEmpresa(id, "integracoes", () => chamar(p.listarIntegracoes, { parametros: { id } }));

export const consultaIntegracoesDaPlataforma = queryOptions({
  queryKey: CHAVES_DA_PLATAFORMA.integracoes,
  queryFn: () => chamar(p.listarIntegracoesDaPlataforma),
});

export const consultaCargosDaPlataforma = queryOptions({
  queryKey: CHAVES_DA_PLATAFORMA.cargos,
  queryFn: () => chamar(p.listarCargosDaPlataforma),
});

export const consultaAdmins = queryOptions({
  queryKey: CHAVES_DA_PLATAFORMA.admins,
  queryFn: () => chamar(p.listarAdmins),
});
