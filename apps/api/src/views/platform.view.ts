import { type SaidaDe } from "@erp/shared/contract";
import { type Cargo } from "@erp/shared/contracts/admin";
import { type contratosPlataforma } from "@erp/shared/contracts/platform";

import {
  type AdminGravado,
  type EmpresaGravada,
  type EmpresaListada,
  type EstadoDaIntegracao,
  type EstadoDaIntegracaoDaPlataforma,
  type ModuloLiberado,
} from "../models/platform/platform.service";

type Saida<E extends keyof typeof contratosPlataforma> = SaidaDe<(typeof contratosPlataforma)[E]>;
/** Caminho do logo no armazenamento → endereço público (nulo sem logo ou sem a base configurada). */
type UrlDoLogo = (caminho: string | null) => string | null;

const iso = (d: Date | null) => d?.toISOString() ?? null;
const porNome = (
  a: { nome: string | null; email: string },
  b: { nome: string | null; email: string },
) => (a.nome ?? a.email).localeCompare(b.nome ?? b.email, "pt-BR");

export function apresentarEmpresas(empresas: readonly EmpresaListada[]): Saida<"listarEmpresas"> {
  return {
    empresas: [...empresas]
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map((e) => ({
        id: e.id,
        slug: e.slug,
        nome: e.nome,
        nomeCurto: e.nomeCurto,
        cnpj: e.cnpj,
        status: e.status,
        criadoEm: e.criadoEm.toISOString(),
        usuariosAtivos: e.usuariosAtivos,
        modulosLiberados: e.modulosLiberados,
        integracoesAtivas: e.integracoesAtivas,
      })),
  };
}

export function apresentarEmpresa(
  { logoCaminho, criadoEm, atualizadoEm, ...empresa }: EmpresaGravada,
  urlDoLogo: UrlDoLogo,
): Saida<"obterEmpresa"> {
  return {
    ...empresa,
    logoUrl: urlDoLogo(logoCaminho),
    criadoEm: criadoEm.toISOString(),
    atualizadoEm: atualizadoEm.toISOString(),
  };
}

export function apresentarLogo(caminho: string, urlDoLogo: UrlDoLogo): Saida<"enviarLogo"> {
  return { logoUrl: urlDoLogo(caminho) };
}

/** Na ordem do catálogo. */
export function apresentarModulos(modulos: readonly ModuloLiberado[]): Saida<"listarModulos"> {
  return {
    modulos: [...modulos]
      .sort((a, b) => a.ordem - b.ordem)
      .map((m) => ({ ...m, atualizadoEm: iso(m.atualizadoEm) })),
  };
}

export function apresentarIntegracoes(
  integracoes: readonly EstadoDaIntegracao[],
): Saida<"listarIntegracoes"> {
  return {
    integracoes: integracoes.map((i) => ({
      ...i,
      segredoDefinidoEm: iso(i.segredoDefinidoEm),
      ultimoTesteEm: iso(i.ultimoTesteEm),
      atualizadoEm: iso(i.atualizadoEm),
    })),
  };
}

/** Quando a senha/token foi definido (nulo = removido); o valor nunca sai. */
export function apresentarSegredo(definidoEm: Date | null): Saida<"definirSegredo"> {
  return { segredoDefinidoEm: iso(definidoEm) };
}

export function apresentarIntegracoesDaPlataforma(
  integracoes: readonly EstadoDaIntegracaoDaPlataforma[],
): Saida<"listarIntegracoesDaPlataforma"> {
  return {
    integracoes: integracoes.map((i) => ({
      ...i,
      segredoDefinidoEm: iso(i.segredoDefinidoEm),
      atualizadoEm: iso(i.atualizadoEm),
    })),
  };
}

/** Pessoas por nome; em cada uma, as empresas por nome. */
/** A equipe da Plataforma por nome, com o cargo de cada um. */
export function apresentarAdmins(admins: readonly AdminGravado[]): Saida<"listarAdmins"> {
  return {
    admins: [...admins].sort(porNome).map((a) => ({
      ...a,
      ultimoLoginEm: iso(a.ultimoLoginEm),
      criadoEm: a.criadoEm.toISOString(),
    })),
  };
}

/** Cargos da Plataforma: o Super Admin primeiro (tem tudo), depois por nome. */
export function apresentarCargosDaPlataforma(
  cargos: readonly Cargo[],
): Saida<"listarCargosDaPlataforma"> {
  return {
    cargos: [...cargos].sort(
      (a, b) => Number(b.temTudo) - Number(a.temTudo) || a.rotulo.localeCompare(b.rotulo, "pt-BR"),
    ),
  };
}
