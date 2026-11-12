import { randomUUID } from "node:crypto";

import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../../testes/cenario";

let cenario: Cenario;
let app: FastifyInstance;
let empresaId: string;

const FR = {
  taxaTurbo: 1,
  taxaAcelerado: 0.8,
  taxaEmRotaGrande: 0.4,
  taxaEmRotaPequena: 0.6,
  metaRotaPequena: 0.9,
  metaRotaGrande: 0.95,
  metaEmRota: 0.8,
  limiteNfsRotaPequena: 15,
};

beforeEach(async () => {
  cenario = criarCenario();
  app = await construirAppDeTeste(cenario);
  empresaId = cenario.banco.criarEmpresa().id;
  cenario.banco.liberarModulo(empresaId, "ponto_bonificacao");
  cenario.banco.definirCargo(empresaId, "admin", {
    rotulo: "admin",
    telas: ["admin_bonificacao_entrega"],
  });
  // Gestor com a tela liberada só para ver (a migração não dá a ele as ações de admin).
  cenario.banco.definirCargo(empresaId, "gestor", {
    rotulo: "gestor",
    permissoes: ["admin_bonificacao_entrega.ver"],
  });
});
afterEach(() => app.close());

async function comoPapel(papel: string) {
  const usuario = cenario.banco.criarUsuario({ email: `${papel}-${randomUUID()}@fr.com.br` });
  cenario.banco.vincular(usuario.id, empresaId, { papel });
  return entrarComo(cenario, usuario.id, empresaId);
}

const APURAR = { inicio: "2026-11-01", fim: "2026-11-30", usarPonto: false };

describe("bonificação de entrega", () => {
  it("401 sem sessão; gestor só com Ver apura mas recebe 403 ao registrar falta; 422 acima de 45 dias", async () => {
    const url = "/api/v1/bonificacao-entrega/apuracao";
    expect((await app.inject({ method: "POST", url, payload: APURAR })).statusCode).toBe(401);
    const gestor = await comoPapel("gestor");
    const apuracao = await app.inject({ method: "POST", url, payload: APURAR, headers: gestor });
    expect(apuracao.statusCode).toBe(422);
    const falta = await app.inject({
      method: "POST",
      url: "/api/v1/bonificacao-entrega/faltas",
      payload: { colaboradorNome: "JOAO", dataFalta: "2026-11-03", tipo: "falta_injustificada" },
      headers: gestor,
    });
    expect(falta.statusCode).toBe(403);
    const longo = await app.inject({
      method: "POST",
      url,
      payload: { ...APURAR, inicio: "2026-09-01" },
      headers: await comoPapel("admin"),
    });
    expect(longo.statusCode).toBe(422);
  });

  it("sem parâmetros vigentes: pede para cadastrar as taxas", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/bonificacao-entrega/apuracao",
      payload: APURAR,
      headers: await comoPapel("admin"),
    });
    expect(r.statusCode).toBe(422);
    expect(r.json<{ erro: { mensagem: string } }>().erro.mensagem).toContain(
      "Não há parâmetros de bonificação vigentes",
    );
  });

  it("apura sem o ponto (acelerado no máximo) e a falta registrada zera o dia anterior", async () => {
    const dados = cenario.banco.ranking;
    dados.parametros.push({
      id: randomUUID(),
      empresaId,
      vigenciaInicio: "2026-01-01",
      vigenciaFim: null,
      ...FR,
    });
    dados.baldesBonificacao = [
      {
        romaneio: "CAP001",
        placa: "ABC1D23",
        data: "2026-11-03",
        codigo: 1,
        ctes: 12,
        motorista: "JOAO",
        ajudante: null,
        ajudante2: null,
        ajudante3: null,
      },
    ];
    const headers = await comoPapel("admin");
    const registrar = await app.inject({
      method: "POST",
      url: "/api/v1/bonificacao-entrega/faltas",
      payload: { colaboradorNome: "joao", dataFalta: "2026-11-04", tipo: "falta_injustificada" },
      headers,
    });
    expect(registrar.statusCode).toBe(200);

    const r = await app.inject({
      method: "POST",
      url: "/api/v1/bonificacao-entrega/apuracao",
      payload: APURAR,
      headers,
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual([
      expect.objectContaining({
        colaborador: "JOAO",
        nivel: "acelerado",
        semRegistroPonto: true,
        bonus: 0,
        zeradoPorFalta: true,
      }),
    ]);
    const faltas = await app.inject({
      url: "/api/v1/bonificacao-entrega/faltas?inicio=2026-11-01&fim=2026-11-30",
      headers,
    });
    expect(faltas.json()).toEqual([expect.objectContaining({ colaboradorNome: "JOAO" })]);
    expect(cenario.banco.auditoria.map((a) => a.acao)).toEqual(["registrar_falta"]);
  });
});
