/**
 * Senha do Supabase Auth (`auth.users.encrypted_password`): bcrypt do GoTrue, `$2a$10$` + 53
 * caracteres. O login novo valida o bcrypt no primeiro acesso e regrava em argon2id
 * (docs/regras/05 §2.2–2.3).
 */
const BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export type SenhaLegada =
  { hash: string; algoritmo: "bcrypt" } | { hash: null; algoritmo: null; motivo: string | null };

/**
 * Só leva o hash de quem consegue entrar com senha hoje: hash bcrypt válido e e-mail confirmado
 * (o Supabase recusa login por senha sem confirmação). Quem não tem senha (só Google, convite
 * pendente) fica sem hash, como hoje.
 */
export function senhaLegada(
  encrypted: string | null,
  emailConfirmadoEm: string | null,
): SenhaLegada {
  if (encrypted === null || encrypted === "") return { hash: null, algoritmo: null, motivo: null };
  if (!BCRYPT.test(encrypted)) {
    return { hash: null, algoritmo: null, motivo: "hash de senha em formato desconhecido" };
  }
  if (emailConfirmadoEm === null) {
    return { hash: null, algoritmo: null, motivo: "e-mail não confirmado (não entrava por senha)" };
  }
  return { hash: encrypted, algoritmo: "bcrypt" };
}
