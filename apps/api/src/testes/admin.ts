import { type FastifyInstance } from "fastify";

import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "./cenario";

const TELAS_DE_ADMIN = ["admin_usuarios", "admin_roles", "admin_configuracoes"];

/**
 * Duas empresas (A e B) com os cargos padrão: o admin tem as telas de Admin, o operador não. Base
 * dos testes de Admin, Plataforma e Logs (inclusive os de isolamento entre empresas).
 */
export async function cenarioDeAdmin() {
  const cenario: Cenario = criarCenario();
  const app: FastifyInstance = await construirAppDeTeste(cenario);
  const { banco } = cenario;
  const empresaA = banco.criarEmpresa({ nome: "FR Transportes" });
  const empresaB = banco.criarEmpresa({ nome: "Outra Transportadora" });
  for (const empresa of [empresaA, empresaB]) {
    banco.definirCargo(empresa.id, "super_admin", {
      rotulo: "Super Admin",
      telas: TELAS_DE_ADMIN,
      protegido: true,
    });
    banco.definirCargo(empresa.id, "admin", { rotulo: "Admin", telas: TELAS_DE_ADMIN });
    banco.definirCargo(empresa.id, "operador", { rotulo: "Operador", telas: ["performance"] });
  }

  async function comoPapel(papel: string, empresaId = empresaA.id) {
    const usuario = banco.criarUsuario({ email: `${papel}.${empresaId.slice(0, 6)}@fr.com.br` });
    banco.vincular(usuario.id, empresaId, { papel });
    return { usuario, headers: await entrarComo(cenario, usuario.id, empresaId) };
  }

  async function comoPlataforma(empresaId: string | null = empresaA.id) {
    const usuario = banco.criarUsuario({ email: `plataforma${banco.usuarios.length}@scale.ia` });
    banco.plataformaAdmins.add(usuario.id);
    return { usuario, headers: await entrarComo(cenario, usuario.id, empresaId) };
  }

  return { cenario, app, banco, empresaA, empresaB, comoPapel, comoPlataforma };
}
