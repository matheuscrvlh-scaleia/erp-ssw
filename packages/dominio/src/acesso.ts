import { type ModuloCatalogo } from "@erp/shared/acesso/modulos";
import { ehAdminDaEmpresa, PAPEL_ADMIN, PAPEL_GESTOR, type Setor } from "@erp/shared/acesso/papeis";
import {
  ehTela,
  type Tela,
  TELAS,
  TELAS_ADMIN,
  TELAS_ADMIN_PARA_GESTOR,
  TELAS_POR_REGRA,
  TELAS_SO_PLATAFORMA,
} from "@erp/shared/acesso/telas";

/** Fallback do setor legado: só vale quando cargo e departamento não dão nenhuma tela. */
const TELAS_DO_SETOR: Record<Setor, readonly Tela[]> = {
  diretoria: [
    "performance",
    "romaneio",
    "ocorrencias",
    "comprovantes",
    "coletas",
    "prazo_parceiro",
    "historico",
    "calendario",
    "ranking",
    "ranking_novo",
  ],
  monitoramento: [
    "performance",
    "romaneio",
    "ocorrencias",
    "comprovantes",
    "coletas",
    "prazo_parceiro",
    "historico",
    "calendario",
    "ranking",
    "ranking_novo",
  ],
  expedicao: [
    "performance",
    "romaneio",
    "ocorrencias",
    "comprovantes",
    "coletas",
    "prazo_parceiro",
    "historico",
    "calendario",
    "ranking",
    "ranking_novo",
  ],
  agendamento: [
    "performance",
    "romaneio",
    "ocorrencias",
    "prazo_parceiro",
    "historico",
    "calendario",
  ],
  rh: ["performance", "historico", "calendario"],
};

export interface Excecao {
  tela: string;
  permitido: boolean;
}

function emOrdemDoCatalogo(telas: ReadonlySet<Tela>): Tela[] {
  return TELAS.filter((t) => telas.has(t));
}

function excecaoPodeValer(tela: Tela, papel: string | null): boolean {
  if (!TELAS_ADMIN.includes(tela)) return true;
  // Tela administrativa só muda por exceção para quem já é admin (ou gestor, nas liberáveis).
  return (
    ehAdminDaEmpresa(papel) || (papel === PAPEL_GESTOR && TELAS_ADMIN_PARA_GESTOR.includes(tela))
  );
}

/**
 * Telas do cargo ∪ telas do departamento (com fallback do setor legado), depois as exceções do
 * usuário, que adicionam ou tiram.
 * origem: computeScreens (src/lib/permissions.ts, sistema atual)
 */
export function calcularTelas(entrada: {
  telasDoCargo: readonly string[];
  telasDoDepartamento: readonly string[];
  setor: Setor | null;
  excecoes: readonly Excecao[];
  papel: string | null;
}): Tela[] {
  const telas = new Set<Tela>();
  for (const t of [...entrada.telasDoCargo, ...entrada.telasDoDepartamento]) {
    if (ehTela(t)) telas.add(t);
  }
  if (telas.size === 0 && entrada.setor) {
    for (const t of TELAS_DO_SETOR[entrada.setor]) telas.add(t);
  }
  for (const { tela, permitido } of entrada.excecoes) {
    if (!ehTela(tela) || !excecaoPodeValer(tela, entrada.papel)) continue;
    if (permitido) telas.add(tela);
    else telas.delete(tela);
  }
  return emOrdemDoCatalogo(telas);
}

/**
 * Telas da Plataforma só para quem é admin da plataforma (nunca por cargo ou exceção) e Logs da
 * empresa para o admin da empresa.
 * origem: aplicarTelasMultiempresa (src/lib/permissions.ts, sistema atual)
 */
export function aplicarTelasDaPlataforma(
  telas: readonly Tela[],
  opcoes: { adminPlataforma: boolean; papel: string | null },
): Tela[] {
  const resultado = new Set(
    telas.filter((t) => !TELAS_SO_PLATAFORMA.includes(t) && !TELAS_POR_REGRA.includes(t)),
  );
  if (ehAdminDaEmpresa(opcoes.papel) || opcoes.adminPlataforma) resultado.add("admin_logs");
  if (opcoes.adminPlataforma) for (const t of TELAS_SO_PLATAFORMA) resultado.add(t);
  return emOrdemDoCatalogo(resultado);
}

export interface TelaBloqueada {
  tela: Tela;
  modulo: string;
  moduloNome: string;
}

/**
 * Tira as telas cujos módulos estão todos desligados para a empresa. Tela em mais de um módulo
 * fica se qualquer um valer; tela sem módulo (Plataforma) não é afetada; admin da plataforma vê
 * tudo. As tiradas voltam em `bloqueadas` para a rota mostrar o aviso em vez de redirecionar.
 * origem: aplicarModulos (src/lib/modulos.ts, sistema atual)
 */
export function aplicarModulos(
  telas: readonly Tela[],
  catalogo: readonly ModuloCatalogo[],
  liberados: readonly string[],
  adminPlataforma: boolean,
): { telas: Tela[]; bloqueadas: TelaBloqueada[] } {
  if (adminPlataforma) return { telas: [...telas], bloqueadas: [] };
  const vale = new Set([...liberados, ...catalogo.filter((m) => m.essencial).map((m) => m.chave)]);
  const ficam: Tela[] = [];
  const bloqueadas: TelaBloqueada[] = [];
  for (const tela of telas) {
    const modulos = catalogo.filter((m) => m.telas.includes(tela));
    const primeiro = modulos[0];
    if (!primeiro || modulos.some((m) => vale.has(m.chave))) ficam.push(tela);
    else bloqueadas.push({ tela, modulo: primeiro.chave, moduloNome: primeiro.nome });
  }
  return { telas: ficam, bloqueadas };
}

export interface LiberacaoDeModulo {
  modulo: string;
  ativo: boolean;
  inicio: string | null;
  fim: string | null;
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
  for (const l of liberacoes) {
    const comecou = l.inicio === null || l.inicio <= hoje;
    const naoAcabou = l.fim === null || l.fim >= hoje;
    if (l.ativo && comecou && naoAcabou) vigentes.add(l.modulo);
  }
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
  departamento: string | null;
  setor: Setor | null;
  ativo: boolean;
}

export interface EntradaDoAcesso {
  usuarioAtivo: boolean;
  empresaId: string | null;
  adminPlataforma: boolean;
  vinculo: VinculoComEmpresa | null;
  telasDoCargo: readonly string[];
  telasDoDepartamento: readonly string[];
  excecoes: readonly Excecao[];
  catalogo: readonly ModuloCatalogo[];
  modulosVigentes: readonly string[];
}

export interface ResultadoDoAcesso {
  ativo: boolean;
  papel: string | null;
  setor: Setor | null;
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
 * Acesso final do usuário na empresa ativa.
 * origem: calcularAcesso (src/features/auth/acesso.server.ts, sistema atual)
 */
export function calcularAcesso(entrada: EntradaDoAcesso): ResultadoDoAcesso {
  const papel = papelNaEmpresa(entrada);
  const setor = entrada.vinculo?.setor ?? null;
  const semEmpresa = !entrada.adminPlataforma && entrada.empresaId === null;
  const ativo = entrada.usuarioAtivo && entrada.vinculo?.ativo !== false && !semEmpresa;
  if (!ativo) return { ativo, papel, setor, telas: [], telasBloqueadas: [] };

  const doCargo = aplicarTelasDaPlataforma(
    calcularTelas({
      telasDoCargo: entrada.telasDoCargo,
      telasDoDepartamento: entrada.telasDoDepartamento,
      setor,
      excecoes: entrada.excecoes,
      papel,
    }),
    { adminPlataforma: entrada.adminPlataforma, papel },
  );
  const { telas, bloqueadas } = aplicarModulos(
    doCargo,
    entrada.catalogo,
    entrada.modulosVigentes,
    entrada.adminPlataforma,
  );
  return { ativo, papel, setor, telas, telasBloqueadas: bloqueadas };
}

export interface VinculoParaEscolha {
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
