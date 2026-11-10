import {
  calcularAcesso,
  escolherEmpresaAtiva,
  type Excecao,
  type LiberacaoDeModulo,
  modulosVigentes,
  papelNaEmpresa,
  type VinculoComEmpresa,
} from "@erp/dominio/acesso";
import { empresaEmOperacao } from "@erp/dominio/empresas";
import { MODULOS } from "@erp/shared/acesso/modulos";
import { type Acesso, type EmpresaAtiva } from "@erp/shared/contratos/auth";
import { hojeNoFuso } from "@erp/shared/datas";

import { naoAutenticado, sessaoExpirada } from "../../http/erros";
import { type SessaoDoToken } from "../../infra/tokens";
import { type ExecutorComContexto } from "../../repositorios";

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
  /** Cargo da empresa (cada empresa tem os seus, Q30). */
  cargo(empresaId: string, papel: string): Promise<{ rotulo: string; telas: string[] } | null>;
  telasDoDepartamento(empresaId: string, departamento: string): Promise<string[]>;
  excecoes(empresaId: string, usuarioId: string): Promise<Excecao[]>;
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

/** Identidade da sessão: usuário, se é da Plataforma e os vínculos (lidos sem empresa). */
export async function lerIdentidade(deps: DependenciasAcesso, usuarioId: string) {
  return deps.executar({ empresaId: null, usuarioId, plataforma: false }, async ({ acesso }) => ({
    usuario: await acesso.usuario(usuarioId),
    adminPlataforma: await acesso.ehAdminPlataforma(usuarioId),
    vinculos: await acesso.vinculos(usuarioId),
  }));
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
    corPrimaria: e.corPrimaria,
    corDestaque: e.corDestaque,
    slogan: e.slogan,
    fuso: e.fuso,
  };
}

/**
 * Acesso completo da sessão (o que `/auth/me` devolve e o que os guards conferem): telas do
 * cargo/departamento/exceções, módulos vigentes, empresa ativa e as do seletor.
 * origem: calcularAcesso (src/features/auth/acesso.server.ts, sistema atual)
 */
export async function carregarAcesso(
  deps: DependenciasAcesso,
  sessao: SessaoDoToken,
): Promise<Acesso> {
  const { usuarioId } = sessao;
  const { familiaAtiva, usuario, adminPlataforma, vinculos } = await deps.executar(
    { empresaId: null, usuarioId, plataforma: false },
    async ({ acesso }) => ({
      // Logout e senha redefinida revogam a família: o access token antigo para de valer já.
      familiaAtiva: await acesso.familiaAtiva(sessao.familiaId, deps.agora()),
      usuario: await acesso.usuario(usuarioId),
      adminPlataforma: await acesso.ehAdminPlataforma(usuarioId),
      vinculos: await acesso.vinculos(usuarioId),
    }),
  );
  if (!familiaAtiva) throw sessaoExpirada();
  if (!usuario) throw naoAutenticado();

  const pedidaVale =
    sessao.empresaId !== null &&
    (adminPlataforma || vinculos.some((v) => v.empresaId === sessao.empresaId && vinculoVale(v)));
  const empresaId = pedidaVale ? sessao.empresaId : null;

  return deps.executar(
    { empresaId, usuarioId, plataforma: adminPlataforma },
    async ({ acesso }) => {
      const empresa = empresaId ? await acesso.empresa(empresaId) : null;
      const vinculo = vinculos.find((v) => v.empresaId === empresaId) ?? null;
      const papel = papelNaEmpresa({ vinculo, adminPlataforma, empresaId: empresa?.id ?? null });
      const cargo = empresa && papel ? await acesso.cargo(empresa.id, papel) : null;
      const telasDoDepartamento =
        empresa && vinculo?.departamento
          ? await acesso.telasDoDepartamento(empresa.id, vinculo.departamento)
          : [];
      const excecoes = empresa ? await acesso.excecoes(empresa.id, usuarioId) : [];
      const liberacoes = empresa ? await acesso.liberacoes(empresa.id) : [];
      const vigentes = empresa
        ? modulosVigentes(MODULOS, liberacoes, hojeNoFuso(empresa.fuso, deps.agora()))
        : [];

      const resultado = calcularAcesso({
        usuarioAtivo: usuario.ativo,
        empresaId: empresa?.id ?? null,
        adminPlataforma,
        vinculo,
        telasDoCargo: cargo?.telas ?? [],
        telasDoDepartamento,
        excecoes,
        catalogo: MODULOS,
        modulosVigentes: vigentes,
      });

      const empresas = adminPlataforma
        ? await acesso.todasAsEmpresas()
        : vinculos.filter(vinculoVale).map((v) => ({ id: v.empresaId, nome: v.empresaNome }));

      return {
        usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome },
        ativo: resultado.ativo,
        papel: resultado.papel,
        papelRotulo: papel ? (cargo?.rotulo ?? papel) : null,
        setor: resultado.setor,
        telas: resultado.telas,
        empresa: empresa ? paraEmpresaAtiva(deps, empresa) : null,
        empresas: [...empresas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
        modulos: vigentes,
        telasBloqueadas: resultado.telasBloqueadas,
        adminPlataforma,
      };
    },
  );
}
