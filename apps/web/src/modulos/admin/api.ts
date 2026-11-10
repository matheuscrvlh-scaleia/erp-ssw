import { contratosAdmin as c } from "@erp/shared/contratos/admin";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

export const CHAVES = {
  usuarios: ["admin", "usuarios"],
  cargos: ["admin", "cargos"],
  departamentos: ["admin", "departamentos"],
  configuracoes: ["admin", "configuracoes"],
  publicas: ["configuracoes-publicas"],
  prazos: ["admin", "prazos"],
  acesso: ["acesso"],
} as const;

export const consultaUsuarios = queryOptions({
  queryKey: CHAVES.usuarios,
  queryFn: () => chamar(c.listarUsuarios),
});

export const consultaCargos = queryOptions({
  queryKey: CHAVES.cargos,
  queryFn: () => chamar(c.listarCargos),
});

export const consultaDepartamentos = queryOptions({
  queryKey: CHAVES.departamentos,
  queryFn: () => chamar(c.listarDepartamentos),
});

export const consultaConfiguracoes = queryOptions({
  queryKey: CHAVES.configuracoes,
  queryFn: () => chamar(c.listarConfiguracoes),
});

export const consultaPrazos = queryOptions({
  queryKey: CHAVES.prazos,
  queryFn: () => chamar(c.listarPrazos),
});
