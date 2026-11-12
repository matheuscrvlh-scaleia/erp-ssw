import { moduloLiberado } from "@erp/dominio/acesso";
import { type ChaveModulo, nomeDoModulo } from "@erp/shared/acesso/modulos";
import { ehAdminDaEmpresa } from "@erp/shared/acesso/papeis";
import { type Acao, permissao } from "@erp/shared/acesso/permissoes";
import { type Tela } from "@erp/shared/acesso/telas";
import { type Acesso } from "@erp/shared/contratos/auth";
import { type FastifyRequest } from "fastify";

import { sessaoObrigatoria } from "../plugins/sessao";
import { moduloNaoLiberado, semEmpresa, semPermissao } from "./erros";

/**
 * Guard declarativo: entra no `preHandler` da rota e lança erro padrão se não passar. Os guards
 * de empresa, tela, módulo e papel já implicam autenticação e conta ativa.
 */
export type Guarda = (request: FastifyRequest) => Promise<void>;

export const exigirAutenticacao: Guarda = (request) => {
  sessaoObrigatoria(request);
  return Promise.resolve();
};

async function acessoComEmpresa(request: FastifyRequest): Promise<Acesso> {
  const acesso = await request.acesso();
  if (!acesso.ativo && acesso.empresa) {
    throw semPermissao("Sua conta foi desativada por um administrador.");
  }
  if (!acesso.empresa) throw semEmpresa();
  return acesso;
}

export const exigirEmpresa: Guarda = async (request) => {
  await acessoComEmpresa(request);
};

const MENSAGEM_DA_ACAO: Record<Acao, string> = {
  ver: "Seu nível de acesso não libera esta tela.",
  editar: "Seu cargo não permite criar ou alterar nesta tela.",
  excluir: "Seu cargo não permite excluir nesta tela.",
};

/**
 * Permissão por ação na tela (`ver` para ler; `editar` para criar/alterar; `excluir`). Tela de
 * módulo desligado responde com o aviso do módulo.
 */
export function exigirPermissao(tela: Tela, acao: Acao): Guarda {
  return async (request) => {
    const acesso = await acessoComEmpresa(request);
    if (acesso.permissoes.includes(permissao(tela, acao))) return;
    const bloqueio = acesso.telasBloqueadas.find((b) => b.tela === tela);
    if (bloqueio) throw moduloNaoLiberado([bloqueio.moduloNome]);
    throw semPermissao(MENSAGEM_DA_ACAO[acao]);
  };
}

/** Passa com "Ver" em qualquer uma das telas (lista usada por mais de uma tela, ex.: cargos). */
export function exigirUmaDasTelas(...telas: Tela[]): Guarda {
  return async (request) => {
    const acesso = await acessoComEmpresa(request);
    if (!telas.some((t) => acesso.telas.includes(t))) {
      throw semPermissao("Seu nível de acesso não libera esta tela.");
    }
  };
}

/** Passa se qualquer um dos módulos estiver liberado para a empresa (Plataforma sempre passa). */
export function exigirModulo(...chaves: ChaveModulo[]): Guarda {
  return async (request) => {
    const acesso = await acessoComEmpresa(request);
    if (!moduloLiberado(acesso, chaves)) throw moduloNaoLiberado(chaves.map(nomeDoModulo));
  };
}

/**
 * Admin da empresa ativa: papel admin ou super_admin no vínculo, ou admin da Plataforma (que conta
 * como admin mesmo com outro papel no vínculo, igual a `has_role`).
 */
export const exigirAdminDaEmpresa: Guarda = async (request) => {
  const acesso = await acessoComEmpresa(request);
  if (!acesso.adminPlataforma && !ehAdminDaEmpresa(acesso.papel)) {
    throw semPermissao("Acesso restrito a administradores");
  }
};

export const exigirAdminPlataforma: Guarda = async (request) => {
  const acesso = await request.acesso();
  if (!acesso.adminPlataforma) throw semPermissao("Esta ação é só da equipe da Plataforma.");
  if (!acesso.ativo) throw semPermissao("Sua conta foi desativada por um administrador.");
};
