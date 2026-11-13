import { type ModuloCatalogo } from "@erp/shared/access/modules";
import {
  ACOES_DA_TELA,
  type Efeito,
  ehPermissao,
  ehPermissaoDaPlataforma,
  ehPermissaoGravavel,
  partesDaPermissao,
  type Permissao,
  permissao,
  PERMISSOES,
  PERMISSOES_DA_PLATAFORMA,
  PERMISSOES_GRAVAVEIS,
  telasComVer,
} from "@erp/shared/access/permissions";
import {
  CARGO_SUPER_ADMIN_DA_PLATAFORMA,
  ehAdminDaEmpresa,
  PAPEL_ADMIN,
  PAPEL_GESTOR,
} from "@erp/shared/access/roles";
import {
  type Tela,
  TELAS_ADMIN,
  TELAS_ADMIN_PARA_GESTOR,
  TELAS_POR_REGRA,
  TELAS_SO_PLATAFORMA,
} from "@erp/shared/access/screens";

export interface ExcecaoDePermissao {
  permissao: string;
  efeito: Efeito;
}

function emOrdemDoCatalogo(permissoes: ReadonlySet<string>): Permissao[] {
  return PERMISSOES.filter((p) => permissoes.has(p));
}

/**
 * Concessão individual ("Sim") de tela administrativa só vale para quem já é admin, ou para gestor
 * nas telas liberáveis a ele. Sem esta regra um operador ganharia o Admin por exceção.
 * origem: computeScreens (src/lib/permissions.ts, sistema atual)
 */
function concessaoPodeValer(tela: Tela, papel: string | null): boolean {
  if (!TELAS_ADMIN.includes(tela)) return true;
  return (
    ehAdminDaEmpresa(papel) || (papel === PAPEL_GESTOR && TELAS_ADMIN_PARA_GESTOR.includes(tela))
  );
}

/**
 * Permissões do cargo: Admin e Super Admin têm o catálogo da empresa inteiro (não se edita); os
 * demais, as gravadas no cargo (as fora do catálogo ou da Plataforma não valem).
 */
export function permissoesDoCargo(papel: string | null, gravadas: readonly string[]): Permissao[] {
  if (ehAdminDaEmpresa(papel)) return [...PERMISSOES_GRAVAVEIS];
  return emOrdemDoCatalogo(new Set(gravadas.filter(ehPermissaoGravavel)));
}

/** Sem "Ver" a tela não tem as outras ações (não dá para editar o que não se vê). */
function tirarAcoesSemVer(permissoes: Set<string>): void {
  for (const p of [...permissoes]) {
    if (ehPermissao(p) && !permissoes.has(permissao(partesDaPermissao(p).tela, "ver"))) {
      permissoes.delete(p);
    }
  }
}

/**
 * Permissões efetivas = (cargo ∪ concessões) − negações. Um "Não" vale até para o Admin; um "Sim"
 * de tela administrativa só vale nos casos de `concessaoPodeValer`.
 * origem: effectivePermissions (construgarden, src/lib/permissionOverrides.ts)
 */
export function calcularPermissoes(entrada: {
  papel: string | null;
  doCargo: readonly string[];
  excecoes: readonly ExcecaoDePermissao[];
}): Permissao[] {
  const efetivas = new Set<string>(permissoesDoCargo(entrada.papel, entrada.doCargo));
  for (const { permissao: p, efeito } of entrada.excecoes) {
    if (efeito !== "concede" || !ehPermissaoGravavel(p)) continue;
    if (concessaoPodeValer(partesDaPermissao(p).tela, entrada.papel)) efetivas.add(p);
  }
  for (const { permissao: p, efeito } of entrada.excecoes) {
    if (efeito === "nega") efetivas.delete(p);
  }
  tirarAcoesSemVer(efetivas);
  return emOrdemDoCatalogo(efetivas);
}

function todasAsAcoes(telas: readonly Tela[]): Permissao[] {
  return telas.flatMap((t) => ACOES_DA_TELA[t].map((a) => permissao(t, a)));
}

/**
 * Permissões do cargo da equipe da Plataforma: o Super Admin tem todas as da Plataforma (não se
 * edita); os outros, as gravadas (as de fora da Plataforma não valem, nem ação sem "Ver").
 */
export function permissoesDoCargoDaPlataforma(
  cargo: string,
  gravadas: readonly string[],
): Permissao[] {
  if (cargo === CARGO_SUPER_ADMIN_DA_PLATAFORMA) return [...PERMISSOES_DA_PLATAFORMA];
  const validas = new Set<string>(gravadas.filter(ehPermissaoDaPlataforma));
  tirarAcoesSemVer(validas);
  return emOrdemDoCatalogo(validas);
}

/**
 * Telas da Plataforma só vêm do cargo da pessoa na equipe da Plataforma (nunca do cargo na empresa
 * ou de exceção); Logs da empresa para o admin da empresa e para a equipe da Plataforma.
 * origem: aplicarTelasMultiempresa (src/lib/permissions.ts, sistema atual)
 */
function aplicarPermissoesDaPlataforma(
  permissoes: readonly Permissao[],
  opcoes: {
    adminPlataforma: boolean;
    papel: string | null;
    /** Do cargo da Plataforma (`permissoesDoCargoDaPlataforma`); ignoradas fora da equipe. */
    daPlataforma: readonly Permissao[];
  },
): Permissao[] {
  const daRegra = new Set<string>(todasAsAcoes([...TELAS_SO_PLATAFORMA, ...TELAS_POR_REGRA]));
  const resultado = new Set<string>(permissoes.filter((p) => !daRegra.has(p)));
  if (ehAdminDaEmpresa(opcoes.papel) || opcoes.adminPlataforma) {
    for (const p of todasAsAcoes(TELAS_POR_REGRA)) resultado.add(p);
  }
  if (opcoes.adminPlataforma) {
    for (const p of opcoes.daPlataforma) if (ehPermissaoDaPlataforma(p)) resultado.add(p);
  }
  return emOrdemDoCatalogo(resultado);
}

interface TelaBloqueada {
  tela: Tela;
  modulo: string;
  moduloNome: string;
}

/**
 * Tira as telas (com todas as ações) cujos módulos estão todos desligados para a empresa. Tela em
 * mais de um módulo fica se qualquer um valer; tela sem módulo (Plataforma) não é afetada; admin
 * da plataforma vê tudo. As tiradas voltam em `bloqueadas` para a rota mostrar o aviso em vez de
 * redirecionar.
 * origem: aplicarModulos (src/lib/modulos.ts, sistema atual)
 */
function aplicarModulos(
  permissoes: readonly Permissao[],
  catalogo: readonly ModuloCatalogo[],
  liberados: readonly string[],
  adminPlataforma: boolean,
): { permissoes: Permissao[]; bloqueadas: TelaBloqueada[] } {
  if (adminPlataforma) return { permissoes: [...permissoes], bloqueadas: [] };
  const vale = new Set([...liberados, ...catalogo.filter((m) => m.essencial).map((m) => m.chave)]);
  const bloqueadas: TelaBloqueada[] = [];
  for (const tela of telasComVer(permissoes)) {
    const modulos = catalogo.filter((m) => m.telas.includes(tela));
    const primeiro = modulos[0];
    if (primeiro && !modulos.some((m) => vale.has(m.chave))) {
      bloqueadas.push({ tela, modulo: primeiro.chave, moduloNome: primeiro.nome });
    }
  }
  const fora = new Set<string>(todasAsAcoes(bloqueadas.map((b) => b.tela)));
  return { permissoes: permissoes.filter((p) => !fora.has(p)), bloqueadas };
}

export interface LiberacaoDeModulo {
  modulo: string;
  ativo: boolean;
  inicio: string | null;
  fim: string | null;
}

type Vigencia = Omit<LiberacaoDeModulo, "modulo">;

/** Liberação ligada e dentro da vigência (datas no fuso da empresa, como texto ISO). */
function liberacaoVigente(l: Vigencia, hoje: string): boolean {
  const comecou = l.inicio === null || l.inicio <= hoje;
  const naoAcabou = l.fim === null || l.fim >= hoje;
  return l.ativo && comecou && naoAcabou;
}

/** Um módulo vale hoje: essencial, ou ligado e dentro da vigência (a mesma regra da lista). */
export function moduloVigente(m: Vigencia & { essencial: boolean }, hoje: string): boolean {
  return m.essencial || liberacaoVigente(m, hoje);
}

/**
 * Módulos que valem hoje para a empresa: os essenciais sempre, os demais se ativos e dentro da
 * vigência (datas no fuso da empresa, como texto ISO).
 * origem: modulo_liberado (função SQL, sistema atual)
 */
export function modulosVigentes(
  catalogo: readonly ModuloCatalogo[],
  liberacoes: readonly LiberacaoDeModulo[],
  hoje: string,
): string[] {
  const vigentes = new Set(catalogo.filter((m) => m.essencial).map((m) => m.chave));
  for (const l of liberacoes) if (liberacaoVigente(l, hoje)) vigentes.add(l.modulo);
  return [...vigentes].sort();
}

/** Admin da plataforma vê tudo; senão vale se algum dos módulos pedidos estiver liberado. */
export function moduloLiberado(
  contexto: { adminPlataforma: boolean; modulos: readonly string[] },
  chaves: readonly string[],
): boolean {
  return contexto.adminPlataforma || chaves.some((c) => contexto.modulos.includes(c));
}

export interface VinculoComEmpresa {
  papel: string | null;
  ativo: boolean;
}

interface EntradaDoAcesso {
  usuarioAtivo: boolean;
  empresaId: string | null;
  adminPlataforma: boolean;
  vinculo: VinculoComEmpresa | null;
  /** Permissões do cargo na equipe da Plataforma (`permissoesDoCargoDaPlataforma`). */
  permissoesDaPlataforma: readonly Permissao[];
  /** Permissões gravadas no cargo do usuário (o cargo Admin ignora: tem tudo). */
  permissoesDoCargo: readonly string[];
  excecoes: readonly ExcecaoDePermissao[];
  catalogo: readonly ModuloCatalogo[];
  modulosVigentes: readonly string[];
}

interface ResultadoDoAcesso {
  ativo: boolean;
  papel: string | null;
  permissoes: Permissao[];
  /** Telas com "Ver" (menu e guarda de rota). */
  telas: Tela[];
  telasBloqueadas: TelaBloqueada[];
}

/**
 * Papel na empresa ativa. Admin da plataforma sem vínculo nela vale como admin.
 * origem: has_role (função SQL, sistema atual)
 */
export function papelNaEmpresa(entrada: {
  vinculo: VinculoComEmpresa | null;
  adminPlataforma: boolean;
  empresaId: string | null;
}): string | null {
  if (entrada.vinculo?.papel) return entrada.vinculo.papel;
  return entrada.adminPlataforma && entrada.empresaId ? PAPEL_ADMIN : null;
}

/**
 * Acesso final do usuário na empresa ativa: permissões do cargo e das exceções, regras da
 * Plataforma e módulos liberados.
 * origem: calcularAcesso (src/features/auth/acesso.server.ts, sistema atual)
 */
export function calcularAcesso(entrada: EntradaDoAcesso): ResultadoDoAcesso {
  const papel = papelNaEmpresa(entrada);
  const semEmpresa = !entrada.adminPlataforma && entrada.empresaId === null;
  const ativo = entrada.usuarioAtivo && entrada.vinculo?.ativo !== false && !semEmpresa;
  if (!ativo) return { ativo, papel, permissoes: [], telas: [], telasBloqueadas: [] };

  const doCargo = aplicarPermissoesDaPlataforma(
    calcularPermissoes({ papel, doCargo: entrada.permissoesDoCargo, excecoes: entrada.excecoes }),
    {
      adminPlataforma: entrada.adminPlataforma,
      papel,
      daPlataforma: entrada.permissoesDaPlataforma,
    },
  );
  const { permissoes, bloqueadas } = aplicarModulos(
    doCargo,
    entrada.catalogo,
    entrada.modulosVigentes,
    entrada.adminPlataforma,
  );
  return { ativo, papel, permissoes, telas: telasComVer(permissoes), telasBloqueadas: bloqueadas };
}

interface VinculoParaEscolha {
  empresaId: string;
  ativo: boolean;
  empresaAtiva: boolean;
  criadoEm: Date;
}

/**
 * Empresa ativa da sessão: a preferida, se ainda vale para o usuário (admin da plataforma pode
 * qualquer uma); senão o vínculo ativo mais antigo em empresa ativa ou em implantação.
 * origem: empresa_atual (função SQL, sistema atual)
 */
export function escolherEmpresaAtiva(entrada: {
  preferida: string | null;
  adminPlataforma: boolean;
  vinculos: readonly VinculoParaEscolha[];
}): string | null {
  const validos = entrada.vinculos
    .filter((v) => v.ativo && v.empresaAtiva)
    .sort(
      (a, b) =>
        a.criadoEm.getTime() - b.criadoEm.getTime() || a.empresaId.localeCompare(b.empresaId),
    );
  const { preferida } = entrada;
  if (preferida !== null) {
    if (entrada.adminPlataforma || validos.some((v) => v.empresaId === preferida)) return preferida;
  }
  return validos[0]?.empresaId ?? null;
}
