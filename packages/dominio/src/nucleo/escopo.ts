/**
 * Escopo de visibilidade de CT-e e ocorrência por unidade/equipe (Q26 do dono: uma regra só,
 * na prática desligada enquanto nenhuma tela grava a unidade do usuário — sem escopo, vê tudo).
 * O RLS já restringe à empresa; o repositório aplica este escopo nas consultas com o fragmento
 * `($verTudo OR c.unidade_id = $unidade OR c.equipe_id = ANY($equipes))`.
 */
import { PAPEL_ADMIN, PAPEL_GESTOR, PAPEL_SUPER_ADMIN } from "@erp/shared/acesso/papeis";

export interface EscopoDoUsuario {
  /** Papel do vínculo ativo na empresa ativa. */
  papel: string | null;
  adminPlataforma: boolean;
  /** `empresa_usuarios.unidade_id` na empresa ativa. */
  unidadeId: string | null;
  /** Equipes da empresa ativa de que o usuário é membro sem data de saída. */
  equipesAtivas: readonly string[];
}

const PAPEIS_QUE_VEEM_TUDO: ReadonlySet<string> = new Set([
  PAPEL_ADMIN,
  PAPEL_SUPER_ADMIN,
  PAPEL_GESTOR,
]);

/**
 * Admin, super admin, gestor e admin da Plataforma veem tudo; quem não tem unidade nem equipe
 * também (sem escopo definido).
 * origem: pode_ver_tudo (sistema atual)
 */
export function podeVerTudo(usuario: EscopoDoUsuario): boolean {
  if (usuario.adminPlataforma) return true;
  if (usuario.papel !== null && PAPEIS_QUE_VEEM_TUDO.has(usuario.papel)) return true;
  return usuario.unidadeId === null && usuario.equipesAtivas.length === 0;
}

/** origem: pode_ver_ctrc (sistema atual) */
export function podeVerCte(
  usuario: EscopoDoUsuario,
  cte: { unidadeId: string | null; equipeId: string | null },
): boolean {
  if (podeVerTudo(usuario)) return true;
  if (usuario.unidadeId !== null && usuario.unidadeId === cte.unidadeId) return true;
  return cte.equipeId !== null && usuario.equipesAtivas.includes(cte.equipeId);
}
