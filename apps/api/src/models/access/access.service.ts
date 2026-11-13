import { type ContextoBanco } from "@erp/db";
import {
  calcularAcesso,
  escolherEmpresaAtiva,
  type ExcecaoDePermissao,
  type LiberacaoDeModulo,
  modulosVigentes,
  papelNaEmpresa,
  permissoesDoCargoDaPlataforma,
  vencimentosParaAvisar,
  type VinculoComEmpresa,
} from "@erp/domain/access";
import { empresaEmOperacao } from "@erp/domain/companies";
import { MODULOS } from "@erp/shared/access/modules";
import { type Acesso, type EmpresaAtiva } from "@erp/shared/contracts/auth";
import { hojeNoFuso } from "@erp/shared/dates";

import { type SessaoDoToken } from "../../infra/tokens";
import { naoAutenticado, sessaoExpirada } from "../errors";
import { type ExecutorComContexto, type Repositorios } from "../repositories";

export interface UsuarioDoAcesso {
  id: string;
  email: string;
  nome: string | null;
  ativo: boolean;
  empresaPreferidaId: string | null;
}

export interface VinculoDetalhado extends VinculoComEmpresa {
  empresaId: string;
  empresaNome: string;
  empresaStatus: string;
  criadoEm: Date;
}

export interface EmpresaGravada {
  id: string;
  nome: string;
  nomeCurto: string;
  logoCaminho: string | null;
  faviconCaminho: string | null;
  corPrimaria: string;
  corDestaque: string;
  slogan: string | null;
  fuso: string;
  status: string;
}

export interface RepositorioAcesso {
  usuario(usuarioId: string): Promise<UsuarioDoAcesso | null>;
  ehAdminPlataforma(usuarioId: string): Promise<boolean>;
  vinculos(usuarioId: string): Promise<VinculoDetalhado[]>;
  familiaAtiva(familiaId: string, agora: Date): Promise<boolean>;
  empresa(empresaId: string): Promise<EmpresaGravada | null>;
  todasAsEmpresas(): Promise<{ id: string; nome: string }[]>;
  /** Cargo da empresa (cada empresa tem os seus, Q30) com as permissões gravadas (`tela.acao`). */
  cargo(empresaId: string, papel: string): Promise<{ rotulo: string; permissoes: string[] } | null>;
  /** Cargo na equipe da Plataforma com as permissões gravadas; nulo fora da equipe. */
  cargoDaPlataforma(usuarioId: string): Promise<{ chave: string; permissoes: string[] } | null>;
  excecoes(empresaId: string, usuarioId: string): Promise<ExcecaoDePermissao[]>;
  liberacoes(empresaId: string): Promise<LiberacaoDeModulo[]>;
}

export function vinculoVale(v: VinculoDetalhado): boolean {
  return v.ativo && empresaEmOperacao(v.empresaStatus);
}

export interface DependenciasAcesso {
  executar: ExecutorComContexto<"acesso">;
  agora: () => Date;
  urlDoLogo: (caminho: string | null) => string | null;
}

/**
 * Cada leitura na sua transação, todas ao mesmo tempo. Numa transação só as consultas vão uma por
 * vez, e cada uma é uma ida e volta ao banco: no login e no acesso isso somava segundos.
 */
function leitorEmParalelo(deps: DependenciasAcesso, contexto: ContextoBanco) {
  return <T>(ler: (acesso: Repositorios["acesso"]) => Promise<T>) =>
    deps.executar(contexto, ({ acesso }) => ler(acesso));
}

/** Identidade da sessão: usuário, se é da Plataforma e os vínculos (lidos sem empresa). */
export async function lerIdentidade(deps: DependenciasAcesso, usuarioId: string) {
  const ler = leitorEmParalelo(deps, { empresaId: null, usuarioId, plataforma: false });
  const [usuario, adminPlataforma, vinculos] = await Promise.all([
    ler((a) => a.usuario(usuarioId)),
    ler((a) => a.ehAdminPlataforma(usuarioId)),
    ler((a) => a.vinculos(usuarioId)),
  ]);
  return { usuario, adminPlataforma, vinculos };
}

/**
 * Empresa que vale para a sessão: a pedida, se o usuário ainda pode usá-la; senão a de sempre.
 * origem: empresa_atual (função SQL, sistema atual)
 */
export function empresaDaSessao(
  pedida: string | null,
  adminPlataforma: boolean,
  vinculos: readonly VinculoDetalhado[],
): string | null {
  return escolherEmpresaAtiva({
    preferida: pedida,
    adminPlataforma,
    vinculos: vinculos.map((v) => ({
      empresaId: v.empresaId,
      ativo: v.ativo,
      empresaAtiva: empresaEmOperacao(v.empresaStatus),
      criadoEm: v.criadoEm,
    })),
  });
}

function paraEmpresaAtiva(deps: DependenciasAcesso, e: EmpresaGravada): EmpresaAtiva {
  return {
    id: e.id,
    nome: e.nome,
    nomeCurto: e.nomeCurto,
    logoUrl: deps.urlDoLogo(e.logoCaminho),
    faviconUrl: deps.urlDoLogo(e.faviconCaminho),
    corPrimaria: e.corPrimaria,
    corDestaque: e.corDestaque,
    slogan: e.slogan,
    fuso: e.fuso,
  };
}

/**
 * Acesso completo da sessão (o que `/auth/me` devolve e o que os guards conferem): permissões do
 * cargo e das exceções, telas, módulos vigentes, empresa ativa e as do seletor.
 * origem: calcularAcesso (src/features/auth/acesso.server.ts, sistema atual)
 */
export async function carregarAcesso(
  deps: DependenciasAcesso,
  sessao: SessaoDoToken,
): Promise<Acesso> {
  const { usuarioId } = sessao;
  const [familiaAtiva, { usuario, adminPlataforma, vinculos }] = await Promise.all([
    // Logout e senha redefinida revogam a família: o access token antigo para de valer já.
    leitorEmParalelo(deps, { empresaId: null, usuarioId, plataforma: false })((a) =>
      a.familiaAtiva(sessao.familiaId, deps.agora()),
    ),
    lerIdentidade(deps, usuarioId),
  ]);
  if (!familiaAtiva) throw sessaoExpirada();
  if (!usuario) throw naoAutenticado();

  const pedidaVale =
    sessao.empresaId !== null &&
    (adminPlataforma || vinculos.some((v) => v.empresaId === sessao.empresaId && vinculoVale(v)));
  const empresaId = pedidaVale ? sessao.empresaId : null;

  const ler = leitorEmParalelo(deps, { empresaId, usuarioId, plataforma: adminPlataforma });
  const vinculo = vinculos.find((v) => v.empresaId === empresaId) ?? null;
  // O papel só depende de a empresa existir, então o cargo é lido junto com ela (sem empresa, a
  // leitura do cargo volta vazia e é descartada).
  const papelSeExistir = papelNaEmpresa({ vinculo, adminPlataforma, empresaId });
  const [empresa, cargoLido, excecoesLidas, daPlataforma, liberacoesLidas, todas] =
    await Promise.all([
      empresaId ? ler((a) => a.empresa(empresaId)) : null,
      empresaId && papelSeExistir ? ler((a) => a.cargo(empresaId, papelSeExistir)) : null,
      empresaId ? ler((a) => a.excecoes(empresaId, usuarioId)) : [],
      adminPlataforma ? ler((a) => a.cargoDaPlataforma(usuarioId)) : null,
      empresaId ? ler((a) => a.liberacoes(empresaId)) : [],
      adminPlataforma ? ler((a) => a.todasAsEmpresas()) : null,
    ]);
  const papel = papelNaEmpresa({ vinculo, adminPlataforma, empresaId: empresa?.id ?? null });
  const cargo = empresa && papel ? cargoLido : null;
  const excecoes = empresa ? excecoesLidas : [];
  const liberacoes = empresa ? liberacoesLidas : [];
  const hoje = empresa ? hojeNoFuso(empresa.fuso, deps.agora()) : null;
  const vigentes = hoje ? modulosVigentes(MODULOS, liberacoes, hoje) : [];

  const resultado = calcularAcesso({
    usuarioAtivo: usuario.ativo,
    empresaId: empresa?.id ?? null,
    adminPlataforma,
    vinculo,
    permissoesDaPlataforma: daPlataforma
      ? permissoesDoCargoDaPlataforma(daPlataforma.chave, daPlataforma.permissoes)
      : [],
    permissoesDoCargo: cargo?.permissoes ?? [],
    excecoes,
    catalogo: MODULOS,
    modulosVigentes: vigentes,
  });

  // Da Plataforma: todas as empresas (lidas acima); senão, as dos vínculos que valem.
  const empresas =
    todas ?? vinculos.filter(vinculoVale).map((v) => ({ id: v.empresaId, nome: v.empresaNome }));

  return {
    usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome },
    ativo: resultado.ativo,
    papel: resultado.papel,
    papelRotulo: papel ? (cargo?.rotulo ?? papel) : null,
    permissoes: resultado.permissoes,
    telas: resultado.telas,
    empresa: empresa ? paraEmpresaAtiva(deps, empresa) : null,
    empresas: [...empresas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    modulos: vigentes,
    telasBloqueadas: resultado.telasBloqueadas,
    vencimentos: hoje ? vencimentosParaAvisar(MODULOS, liberacoes, hoje) : [],
    adminPlataforma,
  };
}
