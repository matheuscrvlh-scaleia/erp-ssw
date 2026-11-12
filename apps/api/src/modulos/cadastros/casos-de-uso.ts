import { mudancaParaAuditoria } from "@erp/dominio/auditoria";
import { ErroDeNegocio } from "@erp/dominio/erros";
import { ehTelaGravavel } from "@erp/shared/acesso/editor-de-telas";
import { type Tela } from "@erp/shared/acesso/telas";
import { type Cargo, type DepartamentoDaEmpresa } from "@erp/shared/contratos/admin";

import { conflito, naoEncontrado } from "../../http/erros";
import { type Executor } from "../../infra/repositorios";
import { type Ator, type RepositorioAuditoria } from "../auditoria/auditoria";

/*
 * Cargos (o menu diz "Roles") e departamentos da empresa: cada empresa edita os seus (decisão
 * Q30 do dono). O cargo protegido (`super_admin`) só muda de nome e não sai.
 * origem: roles.functions.ts, departamentos.functions.ts (sistema atual)
 */

export interface CargoGravado {
  chave: string;
  rotulo: string;
  protegido: boolean;
}

export interface DepartamentoGravado extends CargoGravado {
  descricao: string | null;
  ativo: boolean;
}

export interface RepositorioCadastros {
  /** Cargos com as telas e quantos vínculos da empresa usam cada um (ordem de criação). */
  cargos(empresaId: string): Promise<Cargo[]>;
  cargo(empresaId: string, chave: string): Promise<(CargoGravado & { telas: Tela[] }) | null>;
  criarCargo(empresaId: string, cargo: CargoGravado, telas: readonly Tela[]): Promise<void>;
  alterarCargo(empresaId: string, chave: string, rotulo: string): Promise<void>;
  trocarTelasDoCargo(empresaId: string, chave: string, telas: readonly Tela[]): Promise<void>;
  excluirCargo(empresaId: string, chave: string): Promise<void>;
  departamentos(empresaId: string): Promise<DepartamentoDaEmpresa[]>;
  departamento(
    empresaId: string,
    chave: string,
  ): Promise<(DepartamentoGravado & { telas: Tela[] }) | null>;
  criarDepartamento(
    empresaId: string,
    departamento: DepartamentoGravado,
    telas: readonly Tela[],
  ): Promise<void>;
  alterarDepartamento(
    empresaId: string,
    chave: string,
    dados: { rotulo: string; descricao: string | null; ativo: boolean },
  ): Promise<void>;
  trocarTelasDoDepartamento(
    empresaId: string,
    chave: string,
    telas: readonly Tela[],
  ): Promise<void>;
  excluirDepartamento(empresaId: string, chave: string): Promise<void>;
  /** Vínculos da empresa com o papel ou o departamento. */
  usuariosCom(empresaId: string, campo: "papel" | "departamento", chave: string): Promise<number>;
}

type Db = Executor<"cadastros" | "auditoria">;

/** Telas da Plataforma e as dadas por regra não entram em cadastro; repetidas contam uma vez. */
function telasGravaveis(telas: readonly Tela[]): Tela[] {
  const invalidas = telas.filter((t) => !ehTelaGravavel(t));
  if (invalidas.length > 0) {
    throw new ErroDeNegocio(
      "ENTRADA_INVALIDA",
      `Estas telas não podem ser dadas por cargo ou departamento: ${invalidas.join(", ")}.`,
    );
  }
  return [...new Set(telas)];
}

async function registrar(
  auditoria: RepositorioAuditoria,
  ator: Ator,
  empresaId: string,
  entidade: string,
  entidadeId: string,
  acao: "criar" | "alterar" | "excluir",
  antes: Record<string, unknown> | null,
  depois: Record<string, unknown> | null,
): Promise<void> {
  const mudanca = mudancaParaAuditoria({ acao, antes, depois });
  if (!mudanca) return;
  await auditoria.registrar(ator, {
    empresaId,
    acao,
    entidade,
    entidadeId,
    resumo: null,
    ...mudanca,
  });
}

const comoTexto = (telas: readonly Tela[]) => [...telas].sort().join(", ");

export function listarCargos(db: Executor<"cadastros">, empresaId: string): Promise<Cargo[]> {
  return db(({ cadastros }) => cadastros.cargos(empresaId));
}

export async function criarCargo(
  db: Db,
  empresaId: string,
  ator: Ator,
  entrada: { chave: string; rotulo: string; telas: Tela[] },
): Promise<void> {
  const telas = telasGravaveis(entrada.telas);
  await db(async ({ cadastros, auditoria }) => {
    if (await cadastros.cargo(empresaId, entrada.chave)) {
      throw conflito("Já existe um role com essa chave.");
    }
    await cadastros.criarCargo(
      empresaId,
      { chave: entrada.chave, rotulo: entrada.rotulo, protegido: false },
      telas,
    );
    await registrar(auditoria, ator, empresaId, "cargo", entrada.chave, "criar", null, {
      chave: entrada.chave,
      rotulo: entrada.rotulo,
      telas: comoTexto(telas),
    });
  });
}

/** Cargo protegido: só o nome muda; as telas ficam como estão. */
export async function alterarCargo(
  db: Db,
  empresaId: string,
  ator: Ator,
  chave: string,
  entrada: { rotulo: string; telas: Tela[] },
): Promise<void> {
  const telas = telasGravaveis(entrada.telas);
  await db(async ({ cadastros, auditoria }) => {
    const antes = await cadastros.cargo(empresaId, chave);
    if (!antes) throw naoEncontrado("Role não encontrado");
    await cadastros.alterarCargo(empresaId, chave, entrada.rotulo);
    if (!antes.protegido) await cadastros.trocarTelasDoCargo(empresaId, chave, telas);
    await registrar(
      auditoria,
      ator,
      empresaId,
      "cargo",
      chave,
      "alterar",
      { rotulo: antes.rotulo, telas: comoTexto(antes.telas) },
      { rotulo: entrada.rotulo, telas: comoTexto(antes.protegido ? antes.telas : telas) },
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
    if (!antes) throw naoEncontrado("Role não encontrado");
    if (antes.protegido) throw conflito("Este role é protegido");
    const emUso = await cadastros.usuariosCom(empresaId, "papel", chave);
    if (emUso > 0) throw conflito(`Role em uso por ${emUso} usuário(s)`);
    await cadastros.excluirCargo(empresaId, chave);
    await registrar(
      auditoria,
      ator,
      empresaId,
      "cargo",
      chave,
      "excluir",
      {
        chave,
        rotulo: antes.rotulo,
        telas: comoTexto(antes.telas),
      },
      null,
    );
  });
}

export function listarDepartamentos(
  db: Executor<"cadastros">,
  empresaId: string,
): Promise<DepartamentoDaEmpresa[]> {
  return db(({ cadastros }) => cadastros.departamentos(empresaId));
}

export async function criarDepartamento(
  db: Db,
  empresaId: string,
  ator: Ator,
  entrada: { chave: string; rotulo: string; descricao: string | null; telas: Tela[] },
): Promise<void> {
  const telas = telasGravaveis(entrada.telas);
  await db(async ({ cadastros, auditoria }) => {
    if (await cadastros.departamento(empresaId, entrada.chave)) {
      throw conflito("Já existe um departamento com essa chave.");
    }
    const departamento = {
      chave: entrada.chave,
      rotulo: entrada.rotulo,
      descricao: entrada.descricao,
      ativo: true,
      protegido: false,
    };
    await cadastros.criarDepartamento(empresaId, departamento, telas);
    await registrar(auditoria, ator, empresaId, "departamento", entrada.chave, "criar", null, {
      ...departamento,
      telas: comoTexto(telas),
    });
  });
}

export async function alterarDepartamento(
  db: Db,
  empresaId: string,
  ator: Ator,
  chave: string,
  entrada: { rotulo: string; descricao: string | null; ativo: boolean; telas: Tela[] },
): Promise<void> {
  const telas = telasGravaveis(entrada.telas);
  await db(async ({ cadastros, auditoria }) => {
    const antes = await cadastros.departamento(empresaId, chave);
    if (!antes) throw naoEncontrado("Departamento não encontrado");
    const dados = { rotulo: entrada.rotulo, descricao: entrada.descricao, ativo: entrada.ativo };
    await cadastros.alterarDepartamento(empresaId, chave, dados);
    await cadastros.trocarTelasDoDepartamento(empresaId, chave, telas);
    await registrar(
      auditoria,
      ator,
      empresaId,
      "departamento",
      chave,
      "alterar",
      {
        rotulo: antes.rotulo,
        descricao: antes.descricao,
        ativo: antes.ativo,
        telas: comoTexto(antes.telas),
      },
      { ...dados, telas: comoTexto(telas) },
    );
  });
}

export async function excluirDepartamento(
  db: Db,
  empresaId: string,
  ator: Ator,
  chave: string,
): Promise<void> {
  await db(async ({ cadastros, auditoria }) => {
    const antes = await cadastros.departamento(empresaId, chave);
    if (!antes) throw naoEncontrado("Departamento não encontrado");
    if (antes.protegido) throw conflito("Este departamento é protegido");
    const emUso = await cadastros.usuariosCom(empresaId, "departamento", chave);
    if (emUso > 0) throw conflito(`Departamento em uso por ${emUso} usuário(s)`);
    await cadastros.excluirDepartamento(empresaId, chave);
    await registrar(
      auditoria,
      ator,
      empresaId,
      "departamento",
      chave,
      "excluir",
      {
        chave,
        rotulo: antes.rotulo,
        descricao: antes.descricao,
        telas: comoTexto(antes.telas),
      },
      null,
    );
  });
}
