/**
 * Papéis = chaves dos cargos. Cada empresa tem os seus cargos (grupos de usuários com permissões);
 * a chave é texto livre (cargo novo não exige deploy), mas estes têm regra própria no código.
 * origem: src/lib/permissions.ts e tabela `roles` (sistema atual)
 */
export const PAPEL_SUPER_ADMIN = "super_admin";
export const PAPEL_ADMIN = "admin";
export const PAPEL_GESTOR = "gestor";

/** Admin da empresa: tem todas as permissões, administra o acesso e vê os Logs da empresa. */
export function ehAdminDaEmpresa(papel: string | null): boolean {
  return papel === PAPEL_ADMIN || papel === PAPEL_SUPER_ADMIN;
}

/**
 * Cargo da equipe da Plataforma com todas as permissões da Plataforma (não se edita nem se apaga).
 * Os outros cargos da Plataforma são criados na tela e têm as permissões gravadas.
 */
export const CARGO_SUPER_ADMIN_DA_PLATAFORMA = "super_admin";
