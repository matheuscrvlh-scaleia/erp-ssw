import { ehPermissaoGravavel, type Permissao } from "@erp/shared/access/permissions";
import {
  ehAdminDaEmpresa,
  PAPEL_ADMIN,
  PAPEL_GESTOR,
  PAPEL_SUPER_ADMIN,
} from "@erp/shared/access/roles";
import {
  CHAVE_COM_CARA_DE_SEGREDO,
  LOGO_MAXIMO_BYTES,
  type TipoIntegracao,
} from "@erp/shared/platform";

import { type ExcecaoDePermissao } from "./access";
import { ErroDeNegocio } from "./errors";
import { baseDaSswApi } from "./ingestion/ssw-api";

/*
 * Regras do Admin da empresa e da Plataforma: quem pode mexer no login de quem, papel protegido,
 * cargos padrão, parâmetros de integração, logo da empresa e o último admin da Plataforma.
 * origem: users.functions.ts, criar-usuario.server.ts, plataforma.functions.ts,
 *         plataforma_admin_definir, empresa_semear (sistema atual)
 */

const proibido = (mensagem: string) => new ErroDeNegocio("SEM_PERMISSAO", mensagem);
const invalido = (mensagem: string) => new ErroDeNegocio("ENTRADA_INVALIDA", mensagem);

/** Cargo Admin e Super Admin têm todas as permissões: não se editam e o cargo não sai. */
export function cargoTemTudo(chave: string): boolean {
  return ehAdminDaEmpresa(chave);
}

/** Permissões que um cargo grava: só as do catálogo da empresa (nada da Plataforma), sem repetir. */
export function permissoesGravaveis(permissoes: readonly string[]): Permissao[] {
  const invalidas = permissoes.filter((p) => !ehPermissaoGravavel(p));
  if (invalidas.length > 0) {
    throw invalido(`Estas permissões não podem ser dadas por cargo: ${invalidas.join(", ")}.`);
  }
  return [...new Set(permissoes.filter(ehPermissaoGravavel))];
}

/**
 * Exceções de acesso de uma pessoa: só o admin da empresa (ou a Plataforma) ajusta, e ninguém
 * ajusta as próprias (senão o admin tirava um "Não" de si mesmo sem ninguém ver).
 * origem: set_member_permission_overrides (construgarden)
 */
export function exigirPodeAjustarExcecoes(entrada: {
  quemPede: string;
  alvo: string;
  papelDeQuemPede: string | null;
  plataforma: boolean;
}): void {
  if (!entrada.plataforma && !ehAdminDaEmpresa(entrada.papelDeQuemPede)) {
    throw proibido("Só o administrador da empresa ajusta as permissões de um usuário.");
  }
  if (entrada.quemPede === entrada.alvo) {
    throw proibido("Você não pode ajustar as suas próprias permissões.");
  }
}

/** Exceções a gravar: permissões do catálogo da empresa, cada uma com um efeito só. */
export function validarExcecoes(excecoes: readonly ExcecaoDePermissao[]): ExcecaoDePermissao[] {
  permissoesGravaveis(excecoes.map((e) => e.permissao));
  const porPermissao = new Map<string, ExcecaoDePermissao>();
  for (const e of excecoes) {
    const antes = porPermissao.get(e.permissao);
    if (antes && antes.efeito !== e.efeito) {
      throw invalido(`A permissão ${e.permissao} não pode ser concedida e negada ao mesmo tempo.`);
    }
    porPermissao.set(e.permissao, e);
  }
  return [...porPermissao.values()];
}

/** Quem é a pessoa cujo login (nome, e-mail, senha) se quer mudar, e quem pede. */
export interface AlvoDoLogin {
  plataforma: boolean;
  papelDeQuemPede: string | null;
  empresaAtiva: string;
  /** Empresas em que o alvo tem vínculo (qualquer estado), lidas sem o filtro da empresa. */
  empresasDoAlvo: readonly string[];
  /** Papéis do alvo em todas as empresas. */
  papeisDoAlvo: readonly (string | null)[];
  alvoEhPlataforma: boolean;
}

/**
 * Nome, e-mail e senha são da pessoa, não da empresa: o admin da empresa só mexe quando a pessoa
 * está só na empresa dele. Com mais de uma empresa, só a Plataforma.
 */
function podeAlterarLogin(alvo: AlvoDoLogin): boolean {
  if (alvo.plataforma) return true;
  return alvo.empresasDoAlvo.length === 1 && alvo.empresasDoAlvo[0] === alvo.empresaAtiva;
}

/**
 * Além da regra de hoje (`podeAlterarLogin`, Super Admin na senha), o porte fecha duas tomadas de
 * conta: admin de empresa mudando e-mail ou senha de alguém da equipe da Plataforma, e trocando
 * o e-mail de um Super Admin (o "Esqueci a senha" iria para o e-mail novo).
 */
export function exigirPodeAlterarLogin(
  alvo: AlvoDoLogin,
  oQue: "nome e e-mail" | "e-mail" | "senha",
): void {
  if (alvo.alvoEhPlataforma && !alvo.plataforma) {
    throw proibido(
      "Este usuário é da equipe da Plataforma: só a Plataforma altera nome, e-mail e senha.",
    );
  }
  if (!podeAlterarLogin(alvo)) {
    throw proibido(
      oQue === "senha"
        ? "Este usuário também acessa outra empresa: a senha só pode ser redefinida pela equipe da Plataforma."
        : "Este usuário também acessa outra empresa: nome e e-mail só podem ser alterados pela equipe da Plataforma.",
    );
  }
  const alvoEhSuperAdmin = alvo.papeisDoAlvo.includes(PAPEL_SUPER_ADMIN);
  if (oQue !== "nome e e-mail" && alvoEhSuperAdmin && alvo.papelDeQuemPede !== PAPEL_SUPER_ADMIN) {
    throw proibido(
      oQue === "senha"
        ? "Apenas o Super Admin pode redefinir a senha de outro Super Admin"
        : "Apenas o Super Admin pode alterar o e-mail de outro Super Admin.",
    );
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

/**
 * Desativar ou reativar alguém (conta ou vínculo): quem é da Plataforma só pela Plataforma; Super
 * Admin só por Super Admin ou pela Plataforma (ADR 0007). Sem isso, um admin comum tirava o
 * acesso de quem está acima dele.
 */
export function exigirPodeMudarAtivo(alvo: AlvoDoLogin): void {
  if (alvo.alvoEhPlataforma && !alvo.plataforma) {
    throw proibido(
      "Este usuário é da equipe da Plataforma: só a Plataforma o desativa ou reativa.",
    );
  }
  const alvoEhSuperAdmin = alvo.papeisDoAlvo.includes(PAPEL_SUPER_ADMIN);
  if (alvoEhSuperAdmin && !alvo.plataforma && alvo.papelDeQuemPede !== PAPEL_SUPER_ADMIN) {
    throw proibido("Apenas o Super Admin pode desativar ou reativar um Super Admin.");
  }
}

/** Cargos que toda empresa nova recebe; `super_admin` é protegido (só muda o nome). */
export const CARGOS_PADRAO: readonly { chave: string; rotulo: string; protegido: boolean }[] = [
  { chave: PAPEL_SUPER_ADMIN, rotulo: "Super Admin", protegido: true },
  { chave: PAPEL_ADMIN, rotulo: "Admin", protegido: false },
  { chave: PAPEL_GESTOR, rotulo: "Gestor", protegido: false },
  { chave: "operador", rotulo: "Operador", protegido: false },
  { chave: "equipe", rotulo: "Equipe", protegido: false },
];

/**
 * Empresa que serve de modelo para a nova (códigos de ocorrência, configurações, permissões dos
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

/**
 * Senha e token não ficam nos parâmetros (que voltam para a tela): vão cifrados à parte. O
 * endereço da SSW API, quando vem, tem de ser um endereço http(s) válido.
 */
export function validarParametrosDeIntegracao(
  tipo: TipoIntegracao,
  parametros: Record<string, unknown>,
): void {
  const suspeitas = Object.keys(parametros).filter((k) => CHAVE_COM_CARA_DE_SEGREDO.test(k));
  if (suspeitas.length > 0) {
    throw invalido(
      `Senha e token não ficam nos parâmetros (${suspeitas.join(", ")}). Use o campo de senha/token da integração (cofre).`,
    );
  }
  const url = parametros["url"];
  if (tipo === "ssw_api" && typeof url === "string" && baseDaSswApi(url) === null) {
    throw invalido(
      "Endereço da SSW API inválido. Use só o servidor (ex.: tms.ssw.inf.br) ou o endereço completo (https://…/api).",
    );
  }
}

interface LogoValidado {
  bytes: Uint8Array;
  extensao: "png" | "jpg";
  tipo: "image/png" | "image/jpeg";
}

const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];

function comecaCom(bytes: Uint8Array, assinatura: readonly number[]): boolean {
  return assinatura.every((b, i) => bytes[i] === b);
}

/** Imagens da marca da empresa: o logo (menu e exportações) e o favicon (aba do navegador). */
export type ImagemDaMarca = "logo" | "favicon";

const NOME_DA_IMAGEM: Record<ImagemDaMarca, string> = { logo: "o logo", favicon: "o favicon" };

/**
 * Imagem da marca em base64 (com ou sem prefixo `data:`): até 512 KB e PNG ou JPEG pelos
 * primeiros bytes (o nome e o tipo que o navegador diz não valem).
 */
export function validarLogo(conteudoBase64: string, imagem: ImagemDaMarca = "logo"): LogoValidado {
  const nome = NOME_DA_IMAGEM[imagem];
  const formato = `Envie ${nome} em PNG ou JPEG.`;
  const base64 = conteudoBase64.replace(/^data:[^,]*,/, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw invalido(formato);
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (bytes.length === 0) throw invalido(formato);
  if (bytes.length > LOGO_MAXIMO_BYTES) {
    const Nome = nome.charAt(0).toUpperCase() + nome.slice(1);
    throw invalido(`${Nome} passa de 512 KB. Reduza a imagem e envie de novo.`);
  }
  if (comecaCom(bytes, PNG)) return { bytes, extensao: "png", tipo: "image/png" };
  if (comecaCom(bytes, JPEG)) return { bytes, extensao: "jpg", tipo: "image/jpeg" };
  throw invalido(formato);
}

/** `<empresa>/<imagem>-AAAAMMDDhhmmss.<ext>` (UTC): nome novo a cada envio, nunca sobrescreve. */
export function caminhoDoLogo(
  empresaId: string,
  agora: Date,
  extensao: string,
  imagem: ImagemDaMarca = "logo",
): string {
  const carimbo = agora.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${empresaId}/${imagem}-${carimbo}.${extensao}`;
}

/**
 * A Plataforma nunca fica sem Super Admin (o cargo que dá e tira acesso a tudo): tirar alguém do
 * cargo, ou da equipe, só se houver outro.
 */
export function exigirOutroSuperAdmin(superAdmins: number): void {
  if (superAdmins <= 1) {
    throw new ErroDeNegocio("CONFLITO", "A Plataforma precisa de pelo menos um Super Admin.");
  }
}

/** Vigência de módulo: o fim não pode vir antes do início. */
export function validarVigencia(inicio: string | null, fim: string | null): void {
  if (inicio && fim && inicio > fim) {
    throw invalido("O fim da liberação não pode ser antes do início.");
  }
}
