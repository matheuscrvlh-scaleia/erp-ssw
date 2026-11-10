import {
  PAPEL_ADMIN,
  PAPEL_GESTOR,
  PAPEL_SUPER_ADMIN,
  type Setor,
  SETORES,
} from "@erp/shared/acesso/papeis";
import { LOGO_MAXIMO_BYTES } from "@erp/shared/plataforma";

import { ErroDeNegocio } from "./erros";

/*
 * Regras do Admin da empresa e da Plataforma: quem pode mexer no login de quem, papel protegido,
 * cargos padrão, parâmetros de integração, logo da empresa e o último admin da Plataforma.
 * origem: users.functions.ts, criar-usuario.server.ts, plataforma.functions.ts,
 *         plataforma_admin_definir, empresa_semear (sistema atual)
 */

const proibido = (mensagem: string) => new ErroDeNegocio("SEM_PERMISSAO", mensagem);
const invalido = (mensagem: string) => new ErroDeNegocio("ENTRADA_INVALIDA", mensagem);

/** Departamento com o nome de um setor legado também grava o setor (fallback de telas). */
export function setorLegado(departamento: string | null): Setor | null {
  return (SETORES as readonly string[]).includes(departamento ?? "")
    ? (departamento as Setor)
    : null;
}

/**
 * Nome, e-mail e senha são da pessoa, não da empresa: o admin da empresa só mexe quando a pessoa
 * está só na empresa dele. Com mais de uma empresa, só a Plataforma.
 */
export function podeAlterarLogin(entrada: {
  plataforma: boolean;
  empresasDoAlvo: readonly string[];
  empresaAtiva: string;
}): boolean {
  if (entrada.plataforma) return true;
  return entrada.empresasDoAlvo.length === 1 && entrada.empresasDoAlvo[0] === entrada.empresaAtiva;
}

export function exigirPodeAlterarLogin(
  entrada: Parameters<typeof podeAlterarLogin>[0],
  oQue: "nome e e-mail" | "senha",
): void {
  if (podeAlterarLogin(entrada)) return;
  throw proibido(
    oQue === "senha"
      ? "Este usuário também acessa outra empresa: a senha só pode ser redefinida pela equipe da Plataforma."
      : "Este usuário também acessa outra empresa: nome e e-mail só podem ser alterados pela equipe da Plataforma.",
  );
}

/** Senha de quem é Super Admin (em qualquer empresa) só outro Super Admin redefine. */
export function exigirPodeDefinirSenha(entrada: {
  papeisDoAlvo: readonly (string | null)[];
  papelDeQuemPede: string | null;
}): void {
  const alvoEhSuperAdmin = entrada.papeisDoAlvo.includes(PAPEL_SUPER_ADMIN);
  if (alvoEhSuperAdmin && entrada.papelDeQuemPede !== PAPEL_SUPER_ADMIN) {
    throw proibido("Apenas o Super Admin pode redefinir a senha de outro Super Admin");
  }
}

/**
 * Dar ou tirar o papel Super Admin é só de quem já é Super Admin na empresa ou da Plataforma:
 * sem isso, um admin se promoveria (decisão de segurança do porte).
 */
export function exigirPodeMexerEmSuperAdmin(entrada: {
  papelAntes: string | null;
  papelDepois: string | null;
  papelDeQuemPede: string | null;
  plataforma: boolean;
}): void {
  const mexe =
    entrada.papelAntes !== entrada.papelDepois &&
    (entrada.papelAntes === PAPEL_SUPER_ADMIN || entrada.papelDepois === PAPEL_SUPER_ADMIN);
  if (mexe && !entrada.plataforma && entrada.papelDeQuemPede !== PAPEL_SUPER_ADMIN) {
    throw proibido("Apenas o Super Admin pode dar ou tirar o papel Super Admin.");
  }
}

/** Cargos que toda empresa nova recebe; `super_admin` é protegido (telas e chave fixas). */
export const CARGOS_PADRAO: readonly { chave: string; rotulo: string; protegido: boolean }[] = [
  { chave: PAPEL_SUPER_ADMIN, rotulo: "Super Admin", protegido: true },
  { chave: PAPEL_ADMIN, rotulo: "Admin", protegido: false },
  { chave: PAPEL_GESTOR, rotulo: "Gestor", protegido: false },
  { chave: "operador", rotulo: "Operador", protegido: false },
  { chave: "equipe", rotulo: "Equipe", protegido: false },
];

/**
 * Empresa que serve de modelo para a nova (códigos de ocorrência, configurações, telas dos
 * cargos padrão): a mais antiga que não seja a própria.
 */
export function escolherEmpresaModelo<E extends { id: string; criadoEm: Date }>(
  empresas: readonly E[],
  nova: string,
): E | null {
  return (
    [...empresas]
      .filter((e) => e.id !== nova)
      .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime() || a.id.localeCompare(b.id))[0] ??
    null
  );
}

const PARECE_SEGREDO = /(senha|token|secret|segredo|apikey|api_key|password)/i;

/** Senha e token não ficam nos parâmetros (que voltam para a tela): vão cifrados à parte. */
export function validarParametrosDeIntegracao(parametros: Record<string, unknown>): void {
  const suspeitas = Object.keys(parametros).filter((k) => PARECE_SEGREDO.test(k));
  if (suspeitas.length > 0) {
    throw invalido(
      `Senha e token não ficam nos parâmetros (${suspeitas.join(", ")}). Use o campo de senha/token da integração (cofre).`,
    );
  }
}

export interface LogoValidado {
  bytes: Uint8Array;
  extensao: "png" | "jpg";
  tipo: "image/png" | "image/jpeg";
}

const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];

function comecaCom(bytes: Uint8Array, assinatura: readonly number[]): boolean {
  return assinatura.every((b, i) => bytes[i] === b);
}

/**
 * Logo em base64 (com ou sem prefixo `data:`): até 512 KB e PNG ou JPEG pelos primeiros bytes
 * (o nome e o tipo que o navegador diz não valem).
 */
export function validarLogo(conteudoBase64: string): LogoValidado {
  const base64 = conteudoBase64.replace(/^data:[^,]*,/, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw invalido("Envie o logo em PNG ou JPEG.");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (bytes.length === 0) throw invalido("Envie o logo em PNG ou JPEG.");
  if (bytes.length > LOGO_MAXIMO_BYTES) {
    throw invalido("O logo passa de 512 KB. Reduza a imagem e envie de novo.");
  }
  if (comecaCom(bytes, PNG)) return { bytes, extensao: "png", tipo: "image/png" };
  if (comecaCom(bytes, JPEG)) return { bytes, extensao: "jpg", tipo: "image/jpeg" };
  throw invalido("Envie o logo em PNG ou JPEG.");
}

/** `<empresa>/logo-AAAAMMDDhhmmss.<ext>` (UTC): nome novo a cada envio, nunca sobrescreve. */
export function caminhoDoLogo(empresaId: string, agora: Date, extensao: string): string {
  const carimbo = agora.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${empresaId}/logo-${carimbo}.${extensao}`;
}

/** A Plataforma nunca fica sem administrador. */
export function exigirPodeRemoverAdminPlataforma(totalDeAdmins: number): void {
  if (totalDeAdmins <= 1) {
    throw new ErroDeNegocio(
      "CONFLITO",
      "Não dá para remover o último administrador da Plataforma.",
    );
  }
}

/** Vigência de módulo: o fim não pode vir antes do início. */
export function validarVigencia(inicio: string | null, fim: string | null): void {
  if (inicio && fim && inicio > fim) {
    throw invalido("O fim da liberação não pode ser antes do início.");
  }
}
