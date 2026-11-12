import { permissoesDoCargo } from "@erp/dominio/acesso";
import { cargoTemTudo, permissoesGravaveis } from "@erp/dominio/administracao";
import { mudancaParaAuditoria } from "@erp/dominio/auditoria";
import { type Permissao } from "@erp/shared/acesso/permissoes";
import { type Cargo } from "@erp/shared/contratos/admin";

import { conflito, naoEncontrado } from "../../http/erros";
import { type Executor } from "../../repositorios";
import { type Ator, type RepositorioAuditoria } from "../auditoria/auditoria";

/*
 * Cargos da empresa = grupos de usuários com permissões por ação (cada empresa edita os seus,
 * decisão Q30 do dono; departamento virou cargo). Admin e Super Admin têm tudo: as permissões não
 * se editam e o cargo não sai. O cargo protegido (`super_admin`) só muda de nome.
 * origem: roles.functions.ts (sistema atual); role_permissions (construgarden)
 */

export interface CargoGravado {
  chave: string;
  rotulo: string;
  protegido: boolean;
}

export interface RepositorioCadastros {
  /** Cargos com as permissões gravadas e quantos vínculos da empresa usam cada um. */
  cargos(empresaId: string): Promise<(CargoGravado & { permissoes: string[]; usuarios: number })[]>;
  cargo(
    empresaId: string,
    chave: string,
  ): Promise<(CargoGravado & { permissoes: string[]; usuarios: number }) | null>;
  criarCargo(
    empresaId: string,
    cargo: CargoGravado,
    permissoes: readonly Permissao[],
  ): Promise<void>;
  alterarCargo(empresaId: string, chave: string, rotulo: string): Promise<void>;
  trocarPermissoes(
    empresaId: string,
    chave: string,
    permissoes: readonly Permissao[],
  ): Promise<void>;
  excluirCargo(empresaId: string, chave: string): Promise<void>;
}

type Db = Executor<"cadastros" | "auditoria">;

async function registrar(
  auditoria: RepositorioAuditoria,
  ator: Ator,
  empresaId: string,
  chave: string,
  acao: "criar" | "alterar" | "excluir",
  antes: Record<string, unknown> | null,
  depois: Record<string, unknown> | null,
): Promise<void> {
  const mudanca = mudancaParaAuditoria({ acao, antes, depois });
  if (!mudanca) return;
  await auditoria.registrar(ator, {
    empresaId,
    acao,
    entidade: "cargo",
    entidadeId: chave,
    resumo: null,
    ...mudanca,
  });
}

const comoTexto = (permissoes: readonly string[]) => [...permissoes].sort().join(", ");

/** O que a tela mostra: Admin e Super Admin com o catálogo inteiro. */
function paraTela(c: CargoGravado & { permissoes: string[]; usuarios: number }): Cargo {
  return {
    chave: c.chave,
    rotulo: c.rotulo,
    protegido: c.protegido,
    temTudo: cargoTemTudo(c.chave),
    permissoes: permissoesDoCargo(c.chave, c.permissoes),
    usuarios: c.usuarios,
  };
}

export async function listarCargos(db: Executor<"cadastros">, empresaId: string): Promise<Cargo[]> {
  return (await db(({ cadastros }) => cadastros.cargos(empresaId))).map(paraTela);
}

export async function criarCargo(
  db: Db,
  empresaId: string,
  ator: Ator,
  entrada: { chave: string; rotulo: string; permissoes: string[] },
): Promise<void> {
  const permissoes = permissoesGravaveis(entrada.permissoes);
  await db(async ({ cadastros, auditoria }) => {
    if (cargoTemTudo(entrada.chave) || (await cadastros.cargo(empresaId, entrada.chave))) {
      throw conflito("Já existe um cargo com essa chave.");
    }
    await cadastros.criarCargo(
      empresaId,
      { chave: entrada.chave, rotulo: entrada.rotulo, protegido: false },
      permissoes,
    );
    await registrar(auditoria, ator, empresaId, entrada.chave, "criar", null, {
      chave: entrada.chave,
      rotulo: entrada.rotulo,
      permissoes: comoTexto(permissoes),
    });
  });
}

/** Admin e Super Admin: só o nome muda (as permissões são o catálogo inteiro). */
export async function alterarCargo(
  db: Db,
  empresaId: string,
  ator: Ator,
  chave: string,
  entrada: { rotulo: string; permissoes: string[] },
): Promise<void> {
  const permissoes = permissoesGravaveis(entrada.permissoes);
  await db(async ({ cadastros, auditoria }) => {
    const antes = await cadastros.cargo(empresaId, chave);
    if (!antes) throw naoEncontrado("Cargo não encontrado");
    const fixas = cargoTemTudo(chave);
    await cadastros.alterarCargo(empresaId, chave, entrada.rotulo);
    if (!fixas) await cadastros.trocarPermissoes(empresaId, chave, permissoes);
    await registrar(
      auditoria,
      ator,
      empresaId,
      chave,
      "alterar",
      { rotulo: antes.rotulo, permissoes: comoTexto(antes.permissoes) },
      { rotulo: entrada.rotulo, permissoes: comoTexto(fixas ? antes.permissoes : permissoes) },
    );
  });
}

export async function excluirCargo(
  db: Db,
  empresaId: string,
  ator: Ator,
  chave: string,
): Promise<void> {
  await db(async ({ cadastros, auditoria }) => {
    const antes = await cadastros.cargo(empresaId, chave);
    if (!antes) throw naoEncontrado("Cargo não encontrado");
    if (antes.protegido || cargoTemTudo(chave)) throw conflito("Este cargo é protegido");
    if (antes.usuarios > 0) throw conflito(`Cargo em uso por ${String(antes.usuarios)} usuário(s)`);
    await cadastros.excluirCargo(empresaId, chave);
    await registrar(
      auditoria,
      ator,
      empresaId,
      chave,
      "excluir",
      { chave, rotulo: antes.rotulo, permissoes: comoTexto(antes.permissoes) },
      null,
    );
  });
}
