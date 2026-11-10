import { decifrarSegredo, lerChavesDeSegredo } from "@erp/db/segredos";
import { identificarLinha } from "@erp/ingestao/casos-de-uso";
import { type PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { metadadosDe } from "../motor/metadados";
import { type DefinicaoDeTabela, type Resultado } from "../motor/tipos";
import { ErroDeConversao } from "../transformacoes/erros";
import {
  passoAnotacoes,
  passoCodigosOcorrencia,
  passoFeriados,
  passoFiliais,
  passoMetas,
  passoPrazosConfigurados,
} from "./cadastros";
import { type ApoioCte, type OrigemCte, passoCtes, perdedoresDoConflito } from "./ctes";
import { passoEquipeMembros, passoEquipes } from "./equipes";
import {
  passoBi2Sincronizacoes,
  passoSswWebhookEventos,
  passoXmlCteOrfaos,
  passoXmlFtpSincronizacoes,
} from "./externas";
import {
  passoAuditoria,
  passoCargoTelas,
  passoConfiguracoes,
  passoEmpresaIntegracoes,
  passoEmpresas,
  passoEmpresaUsuarios,
  passoUsuarios,
} from "./fundacao";
import { passoIngestaoAplicacoes, passosDasLinhasDeRelatorio } from "./ingestao";
import {
  type OrigemColeta,
  passoColetas,
  passoOcorrencias,
  passoRomaneioSaidasCte,
} from "./operacao";

const INSTANTE = "2026-11-10 12:00:00+00";
const filtros = { empresaId: null, instante: INSTANTE };
const EMPRESA = "f0000000-0000-4000-8000-000000000001";

function rodar<O extends object, T extends PgTable, A>(
  passo: { definicao: DefinicaoDeTabela<O, T, A> },
  linha: O,
  apoio: A,
): Resultado<Record<string, unknown>> {
  return passo.definicao.transformar(linha, apoio, filtros);
}

/** Linha migrada, conferindo que tem exatamente as colunas graváveis da tabela. */
function migrada<O extends object, T extends PgTable, A>(
  passo: { definicao: DefinicaoDeTabela<O, T, A> },
  linha: O,
  apoio: A,
): Record<string, unknown> {
  const resultado = rodar(passo, linha, apoio);
  if (resultado.tipo !== "migrar") throw new Error(`descartada: ${resultado.motivo}`);
  const meta = metadadosDe(passo.definicao.tabela);
  const graváveis = [...meta.colunas.entries()].filter(([, c]) => !c.identidade).map(([p]) => p);
  expect(Object.keys(resultado.linha).sort()).toEqual(graváveis.sort());
  return resultado.linha;
}

function motivo(resultado: Resultado<unknown>): string | null {
  return resultado.tipo === "descartar" ? resultado.motivo : null;
}

describe("ctes", () => {
  const semApoio: ApoioCte = {
    siglaDo455: new Map(),
    siglaAmbigua: new Set(),
    perdedores: new Set(),
  };
  const CTE_VAZIO: { [K in keyof OrigemCte]: null } = {
    id: null,
    empresa_id: null,
    numero_ctrc: null,
    sigla_ctrc: null,
    chave_cte: null,
    sigla_cte: null,
    numero_cte: null,
    tipo_documento: null,
    tipo_documento_455: null,
    data_emissao: null,
    data_embarque: null,
    data_entrega_realizada: null,
    data_conclusao_efetiva: null,
    unidade_id: null,
    parceiro_id: null,
    equipe_id: null,
    remetente: null,
    cnpj_remetente: null,
    destinatario: null,
    cnpj_destinatario: null,
    pagador_nome: null,
    pagador_cnpj: null,
    parceiro_cnpj: null,
    parceiro_nome: null,
    cidade_destino: null,
    uf_destino: null,
    bairro_destino: null,
    logradouro_destino: null,
    numero_endereco_destino: null,
    complemento_destino: null,
    cep_destinatario: null,
    setor: null,
    setor_destino: null,
    filial: null,
    unidade_origem: null,
    unidade_destino: null,
    unidade_atual: null,
    localizacao_atual: null,
    unidade_cidade: null,
    unidade_uf: null,
    chave_nfe: null,
    numero_nf: null,
    serie_nf: null,
    peso: null,
    volumes: null,
    valor_frete: null,
    valor_mercadoria: null,
    tde: null,
    nro_manifesto: null,
    primeiro_manifesto: null,
    ultimo_manifesto: null,
    prazo_entrega: null,
    prazo_origem: null,
    prazo_contratado_dias: null,
    prazo_fonte: null,
    data_base_prazo: null,
    data_prevista_entrega: null,
    prazo_padrao_dias: null,
    prazo_padrao_data: null,
    performance_dias: null,
    no_prazo: null,
    responsabilidade_cliente: null,
    fonte_performance: null,
    atraso_dias: null,
    status_atual: null,
    motorista_nome: null,
    ajudante_nome: null,
    placa_coleta: null,
    placa_entrega: null,
    comprovante_escaneado: null,
    comprovante_escaneado_em: null,
    ultima_ocorr_codigo_0013: null,
    ultima_ocorr_data_0013: null,
    ult_ocorr_codigo_0174: null,
    ult_ocorr_descricao_0174: null,
    ult_ocorr_data_0174: null,
    ult_ocorr_local_0174: null,
    ult_ocorr_instrucao_0174: null,
    ocorr_036_codigo: null,
    ocorr_036_descricao: null,
    ocorr_036_data: null,
    ocorr_efetiva_codigo: null,
    ocorr_efetiva_descricao: null,
    ocorr_efetiva_data: null,
    ocorr_efetiva_fonte: null,
    ocorr_efetiva_local: null,
    cancelado_mesmo_dia: null,
    fora_universo: null,
    campos_ssw: null,
    created_at: null,
    updated_at: null,
  };
  function cte(extra: Partial<OrigemCte> = {}): OrigemCte {
    return {
      ...CTE_VAZIO,
      id: "c1",
      empresa_id: EMPRESA,
      numero_ctrc: "033214",
      sigla_ctrc: "cap",
      data_emissao: "2026-11-01",
      ...extra,
    };
  }

  it("número sem zero à esquerda, sigla maiúscula, colunas novas calculadas", () => {
    const l = migrada(
      passoCtes,
      cte({
        pagador_cnpj: "12.345.678/0001-90",
        unidade_destino: null,
        unidade_atual: "RIO",
        filial: "CAP",
        ocorr_efetiva_codigo: "01",
        valor_mercadoria: "10.5",
        peso: "3.2",
        prazo_padrao_dias: 2,
        campos_ssw: ["peso"],
      }),
      semApoio,
    );
    expect(l).toMatchObject({
      sigla: "CAP",
      numero: "33214",
      pagadorCnpjDigitos: "12345678000190",
      filialEfetiva: "RIO",
      ocorrEfetivaCodigoNum: 1,
      valorMercadoria: "10.50",
      peso: "3.200",
      prazoOrigem: "proprio",
      foraUniverso: false,
      camposSsw: ["peso"],
      duplicadoDe: null,
      criadoEm: INSTANTE,
    });
  });

  it("CT-e estacionado: sigla e número saem de '<num>/<sigla>'", () => {
    const l = migrada(passoCtes, cte({ numero_ctrc: "33214/cas", sigla_ctrc: null }), semApoio);
    expect(l).toMatchObject({ sigla: "CAS", numero: "33214" });
  });

  it("sem sigla: usa a do 455; ambígua ou ausente fica de fora", () => {
    const apoio = { ...semApoio, siglaDo455: new Map([["c1", "CAR"]]) };
    expect(migrada(passoCtes, cte({ sigla_ctrc: null }), apoio).sigla).toBe("CAR");
    expect(motivo(rodar(passoCtes, cte({ sigla_ctrc: null }), semApoio))).toMatch(/sem sigla/);
    expect(
      motivo(
        rodar(passoCtes, cte({ sigla_ctrc: null }), { ...semApoio, siglaAmbigua: new Set(["c1"]) }),
      ),
    ).toMatch(/mais de uma/);
  });

  it("número inválido, sigla com dígito e perdedor do conflito ficam de fora", () => {
    expect(motivo(rodar(passoCtes, cte({ numero_ctrc: "000" }), semApoio))).toMatch(/número/);
    expect(motivo(rodar(passoCtes, cte({ sigla_ctrc: "CA1" }), semApoio))).toMatch(/letra/);
    expect(motivo(rodar(passoCtes, cte(), { ...semApoio, perdedores: new Set(["c1"]) }))).toMatch(
      /mesma sigla e número/,
    );
  });

  it("dinheiro com mais casas e fonte de prazo desconhecida são erro, não arredondamento", () => {
    expect(() => rodar(passoCtes, cte({ tde: "1.234" }), semApoio)).toThrow(ErroDeConversao);
    expect(() => rodar(passoCtes, cte({ prazo_fonte: "chute" }), semApoio)).toThrow(/prazo_fonte/);
    expect(() => rodar(passoCtes, cte({ prazo_padrao_dias: 40_000 }), semApoio)).toThrow(/faixa/);
  });

  it("conflito sigla + número: fica o atualizado por último (empate: maior id)", () => {
    const base = { empresa_id: EMPRESA, sigla_ctrc: "CAP" };
    const perdedores = perdedoresDoConflito(
      [
        { ...base, id: "a", numero_ctrc: "033214", atualizado: "2026-11-01 10:00:00+00" },
        { ...base, id: "b", numero_ctrc: "33214", atualizado: "2026-11-02 10:00:00+00" },
        { ...base, id: "c", numero_ctrc: "33214/CAP", atualizado: "2026-11-02 10:00:00+00" },
        { ...base, id: "d", numero_ctrc: "33214", sigla_ctrc: "CAS", atualizado: null },
        { ...base, id: "e", numero_ctrc: "777", sigla_ctrc: null, atualizado: null },
        {
          ...base,
          id: "f",
          numero_ctrc: "777",
          sigla_ctrc: "CAR",
          atualizado: "2026-01-01 00:00:00+00",
        },
      ],
      new Map([["e", "CAR"]]),
    );
    expect([...perdedores].sort()).toEqual(["a", "b", "e"]);
  });
});

describe("usuários e acesso", () => {
  const usuario = {
    id: "u1",
    email: "  Fulano@FR.com.br ",
    encrypted_password: `$2a$10$${"b".repeat(53)}`,
    email_confirmed_at: "2026-01-01 00:00:00+00",
    nome_meta: "Meta",
    nome_perfil: null,
    ativo_perfil: null,
    banido: false,
    empresa_ativa_id: EMPRESA,
    last_sign_in_at: null,
    created_at: "2026-01-01 00:00:00+00",
    updated_at: null,
  };

  it("e-mail normalizado, hash bcrypt marcado como legado, nome do perfil ou do metadado", () => {
    const l = migrada(passoUsuarios, usuario, null);
    expect(l).toMatchObject({
      email: "fulano@fr.com.br",
      senhaAlgoritmo: "bcrypt",
      nome: "Meta",
      ativo: true,
      tentativasFalhas: 0,
      empresaPreferidaId: EMPRESA,
      atualizadoEm: usuario.created_at,
    });
    expect(migrada(passoUsuarios, { ...usuario, nome_perfil: "Perfil" }, null).nome).toBe("Perfil");
    expect(migrada(passoUsuarios, { ...usuario, nome_meta: null }, null).nome).toBe(
      "fulano@fr.com.br",
    );
  });

  it("sem confirmação não leva senha; banido fica inativo; os dois entram no relatório", () => {
    const r = rodar(passoUsuarios, { ...usuario, email_confirmed_at: null, banido: true }, null);
    expect(r).toMatchObject({
      tipo: "migrar",
      linha: { senhaHash: null, senhaAlgoritmo: null, ativo: false },
      ajustes: [
        "e-mail não confirmado (não entrava por senha)",
        "banido no Supabase Auth (fica inativo)",
      ],
    });
    expect(motivo(rodar(passoUsuarios, { ...usuario, email: null }, null))).toMatch(/e-mail/);
  });

  it("empresa: slug e cores validados; criado_por fica para depois", () => {
    const empresa = {
      id: EMPRESA,
      slug: "fr",
      nome: "FR",
      nome_curto: "FR",
      razao_social: null,
      cnpj: null,
      dominio_ssw: "FRT",
      logo_path: "logos/fr.png",
      cor_primaria: null,
      cor_destaque: "#ABCDEF",
      slogan: null,
      fuso: null,
      status: "ativa",
      criado_em: null,
      atualizado_em: null,
    };
    expect(migrada(passoEmpresas, empresa, null)).toMatchObject({
      corPrimaria: "#212a63",
      corDestaque: "#ABCDEF",
      fuso: "America/Sao_Paulo",
      logoCaminho: "logos/fr.png",
      criadoPor: null,
      criadoEm: INSTANTE,
    });
    expect(() => rodar(passoEmpresas, { ...empresa, slug: "FR Transportes" }, null)).toThrow(
      /slug/,
    );
    expect(() => rodar(passoEmpresas, { ...empresa, status: "x" }, null)).toThrow(/status/);
  });

  it("cargo_telas: tela fora do catálogo não migra", () => {
    const linha = { empresa_id: EMPRESA, role_key: "admin", screen: "dashboard_antigo" };
    expect(motivo(rodar(passoCargoTelas, linha, null))).toMatch(/catálogo/);
    expect(migrada(passoCargoTelas, { ...linha, screen: "ranking_novo" }, null).telaChave).toBe(
      "ranking_novo",
    );
  });

  it("vínculo leva o setor do perfil; setor desconhecido é erro", () => {
    const vinculo = {
      empresa_id: EMPRESA,
      user_id: "u1",
      role_key: "admin",
      departamento_key: null,
      unidade_id: null,
      ativo: null,
      criado_em: null,
      criado_por: null,
      setor: "expedicao",
    };
    expect(migrada(passoEmpresaUsuarios, vinculo, null)).toMatchObject({
      setor: "expedicao",
      ativo: true,
    });
    expect(() => rodar(passoEmpresaUsuarios, { ...vinculo, setor: "ti" }, null)).toThrow(/setor/);
  });

  it("configuração sem id na origem ganha um estável por empresa + chave", () => {
    const cfg = {
      chave: "ctrc_data_minima_emissao",
      valor: "2026-09-01",
      descricao: "d",
      grupo: "g",
      updated_at: null,
      updated_by: null,
      empresa_id: null,
    };
    const a = migrada(passoConfiguracoes, cfg, null);
    expect(a.id).toBe(migrada(passoConfiguracoes, cfg, null).id);
    expect(a.id).not.toBe(migrada(passoConfiguracoes, { ...cfg, empresa_id: EMPRESA }, null).id);
  });

  it("auditoria preserva o id (identidade) e valida o tipo de ator", () => {
    const linha = {
      id: "42",
      empresa_id: null,
      ator_id: null,
      ator_email: null,
      ator_tipo: "usuario",
      acao: "a",
      entidade: "e",
      entidade_id: null,
      resumo: null,
      antes: null,
      depois: '{"x": 1}',
      ip: null,
      user_agent: null,
      criado_em: "2026-01-01 00:00:00+00",
    };
    expect(migrada(passoAuditoria, linha, null).depois).toBe('{"x": 1}');
    expect(passoAuditoria.definicao.identidade?.valor(linha)).toBe("42");
    expect(() => rodar(passoAuditoria, { ...linha, ator_tipo: "robo" }, null)).toThrow(/ator_tipo/);
  });
});

describe("integrações (segredo cifrado e ssw_config)", () => {
  const chaves = lerChavesDeSegredo(`1:${Buffer.alloc(32, 3).toString("base64")}`, 1);
  const passo = passoEmpresaIntegracoes(chaves);
  const base = {
    empresa_id: EMPRESA,
    tipo: "ssw_api",
    id: null,
    ativo: true,
    parametros: '{"dominio": "FRT"}',
    segredo: null,
    segredo_definido_em: null,
    ultimo_teste_em: null,
    ultimo_teste_ok: null,
    ultimo_teste_msg: null,
    atualizado_em: "2026-10-01 00:00:00+00",
    atualizado_por: null,
    cfg_dominio: "OUTRO",
    cfg_usuario: "fr.api",
    cfg_senha: "senha-legada",
    cfg_cnpj_edi: "12345678000190",
    cfg_webhook_secret: "segredo-webhook",
    cfg_cnpjs_aceitos: ["12345678000190"],
    cfg_verificacao_em: "2026-11-09 10:00:00+00",
    cfg_verificacao_ok: true,
    cfg_verificacao_mensagem: "ok",
    cfg_verificacao_origem: "cron",
  };

  it("completa parametros com o ssw_config sem sobrescrever o que a integração já tem", () => {
    const l = migrada(passo, base, null);
    expect(l.parametros).toEqual({
      dominio: "FRT",
      usuario: "fr.api",
      cnpj_edi: "12345678000190",
      ultima_verificacao: { em: base.cfg_verificacao_em, ok: true, mensagem: "ok", origem: "cron" },
    });
  });

  it("segredo: o do Vault; sem ele, o legado — cifrado com o contexto empresa:tipo", () => {
    const l = migrada(passo, base, null);
    expect(typeof l.segredoCifrado).toBe("string");
    expect(JSON.stringify(l)).not.toContain("senha-legada");
    const cifrado = { cifrado: String(l.segredoCifrado), versaoChave: 1 };
    expect(decifrarSegredo(chaves, cifrado, `${EMPRESA}:ssw_api`)).toBe("senha-legada");
    expect(() => decifrarSegredo(chaves, cifrado, `${EMPRESA}:ssw_webhook`)).toThrow();
    const doVault = migrada(passo, { ...base, segredo: "do-vault" }, null);
    expect(
      decifrarSegredo(
        chaves,
        { cifrado: String(doVault.segredoCifrado), versaoChave: 1 },
        `${EMPRESA}:ssw_api`,
      ),
    ).toBe("do-vault");
  });

  it("webhook leva o segredo do webhook e os CNPJs aceitos; id sintético é estável", () => {
    const l = migrada(passo, { ...base, tipo: "ssw_webhook", parametros: null }, null);
    expect(l.parametros).toEqual({ cnpjs_aceitos: ["12345678000190"] });
    expect(
      decifrarSegredo(
        chaves,
        { cifrado: String(l.segredoCifrado), versaoChave: 1 },
        `${EMPRESA}:ssw_webhook`,
      ),
    ).toBe("segredo-webhook");
    expect(l.id).toBe(migrada(passo, { ...base, tipo: "ssw_webhook", parametros: null }, null).id);
  });

  it("sem segredo nenhum: colunas de segredo nulas; tipo desconhecido é erro", () => {
    const l = migrada(passo, { ...base, tipo: "sftp", parametros: null }, null);
    expect(l).toMatchObject({
      segredoCifrado: null,
      segredoVersaoChave: null,
      segredoDefinidoEm: null,
    });
    expect(() => rodar(passo, { ...base, tipo: "ftp" }, null)).toThrow(/tipo/);
  });
});

describe("cadastros, calendário, equipes", () => {
  it("filial com sigla aparada e maiúscula", () => {
    const filial = {
      sigla: " cap ",
      tipo: "T",
      nome: "Capão",
      razao_social: null,
      cnpj: null,
      cidade: null,
      uf: null,
      atualizado_em: null,
      empresa_id: EMPRESA,
      propria: null,
    };
    expect(migrada(passoFiliais, filial, null)).toMatchObject({ sigla: "CAP", propria: false });
  });

  it("prazo configurado sem os campos do tipo não migra (check do destino)", () => {
    const prazo = {
      id: "p1",
      tipo: "parceiro",
      unidade_codigo: null,
      unidade_destino_codigo: null,
      parceiro_cnpj: "1",
      parceiro_nome: null,
      prazo_horas: null,
      prazo_dias: 5,
      ativo: null,
      created_at: null,
      updated_at: null,
      empresa_id: EMPRESA,
    };
    expect(migrada(passoPrazosConfigurados, prazo, null).prazoDias).toBe(5);
    expect(motivo(rodar(passoPrazosConfigurados, { ...prazo, prazo_dias: null }, null))).toMatch(
      /campos/,
    );
    expect(motivo(rodar(passoPrazosConfigurados, { ...prazo, empresa_id: null }, null))).toMatch(
      /nulo/,
    );
  });

  it("código de ocorrência: smallint 0–99 e enums do catálogo", () => {
    const codigo = {
      codigo: 18,
      descricao: "Entregue",
      responsavel: "FR",
      penaliza: null,
      updated_at: null,
      letra_responsavel: "F",
      ativo: null,
      pendente_classificacao: null,
      notas: null,
      atualizado_por: null,
      tipo_ssw: "ENTREGA",
      processo_ssw: null,
      tipo_ssw_manual: null,
      pendencia_acompanhada: null,
      empresa_id: EMPRESA,
    };
    expect(migrada(passoCodigosOcorrencia, codigo, null)).toMatchObject({
      codigo: 18,
      penaliza: false,
    });
    expect(() => rodar(passoCodigosOcorrencia, { ...codigo, codigo: 120 }, null)).toThrow(/0–99/);
    expect(() => rodar(passoCodigosOcorrencia, { ...codigo, tipo_ssw: "X" }, null)).toThrow(
      /tipo_ssw/,
    );
  });

  it("feriado nacional migra com empresa nula e carimbo do instante da migração", () => {
    const feriado = {
      id: "f1",
      data: "2026-12-25",
      tipo: "nacional",
      cidade: null,
      uf: null,
      descricao: "Natal",
      gerado_automaticamente: true,
      empresa_id: null,
    };
    expect(migrada(passoFeriados, feriado, null)).toMatchObject({
      empresaId: null,
      criadoEm: INSTANTE,
      atualizadoEm: INSTANTE,
    });
  });

  it("anotação: autor vira autor_id e atualizado_em = criado_em", () => {
    const anotacao = {
      id: "a1",
      data: "2026-11-01",
      unidade_id: null,
      tipo: "clima",
      texto: "chuva",
      autor: "u1",
      criado_em: "2026-11-01 08:00:00+00",
      empresa_id: EMPRESA,
    };
    expect(migrada(passoAnotacoes, anotacao, null)).toMatchObject({
      autorId: "u1",
      atualizadoEm: "2026-11-01 08:00:00+00",
    });
  });

  it("meta: numeric(8,4) sem arredondar", () => {
    const meta = {
      id: "m1",
      unidade_id: null,
      tipo_meta: "performance_entrega",
      valor: "0.95",
      vigencia_inicio: "2026-01-01",
      vigencia_fim: null,
      empresa_id: EMPRESA,
    };
    expect(migrada(passoMetas, meta, null).valor).toBe("0.9500");
    expect(() => rodar(passoMetas, { ...meta, valor: "0.95001" }, null)).toThrow(ErroDeConversao);
  });

  it("equipe guarda só o hash do token público", () => {
    const equipe = {
      id: "e1",
      nome: "Equipe 1",
      unidade_id: null,
      ativo: null,
      share_token: "abc",
      share_token_revogado: null,
      created_at: null,
      updated_at: null,
      empresa_id: EMPRESA,
    };
    const l = migrada(passoEquipes, equipe, null);
    expect(l.tokenPublicoHash).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(JSON.stringify(l)).not.toContain('"abc"');
  });

  it("membro: posição coerente com o papel", () => {
    const membro = {
      id: "m1",
      equipe_id: "e1",
      usuario_id: null,
      nome: "Zé",
      papel: "ajudante",
      cpf: null,
      data_saida: null,
      created_at: null,
      posicao: 2,
      empresa_id: EMPRESA,
    };
    expect(migrada(passoEquipeMembros, membro, null).posicao).toBe(2);
    expect(motivo(rodar(passoEquipeMembros, { ...membro, posicao: 0 }, null))).toMatch(/posição/);
    expect(
      migrada(passoEquipeMembros, { ...membro, papel: "motorista", posicao: null }, null).papel,
    ).toBe("motorista");
  });
});

describe("operação", () => {
  const ocorrencia = {
    id: "o1",
    ctrc_id: "c1",
    codigo: 1,
    descricao: null,
    data_hora: "2026-11-01 10:00:00.123456+00",
    responsavel: "FR",
    penaliza: null,
    created_at: null,
    protocolo_ssw: null,
    complemento: null,
    origem: null,
    filial: null,
    quarentena: null,
    empresa_id: EMPRESA,
  };

  it("ocorrência: ctrc_id → cte_id, defaults explícitos, microssegundos preservados", () => {
    expect(migrada(passoOcorrencias, ocorrencia, null)).toMatchObject({
      cteId: "c1",
      origem: "manual",
      penaliza: false,
      quarentena: false,
      dataHora: "2026-11-01 10:00:00.123456+00",
    });
    expect(motivo(rodar(passoOcorrencias, { ...ocorrencia, data_hora: null }, null))).toMatch(
      /data/,
    );
    expect(() => rodar(passoOcorrencias, { ...ocorrencia, codigo: 180 }, null)).toThrow(
      ErroDeConversao,
    );
  });

  it("coleta: etapa gravada, cte_sigla/cte_numero e precisão de dinheiro/peso", () => {
    const coleta: { [K in keyof OrigemColeta]: null } = {
      unidade: null,
      numero: null,
      tipo: null,
      remetente_cnpj: null,
      remetente_nome: null,
      remetente_cidade: null,
      setor: null,
      destinatario_cnpj: null,
      destinatario_nome: null,
      destino_cidade: null,
      solicitante: null,
      motorista: null,
      placa: null,
      situacao: null,
      situacao_em: null,
      limite_em: null,
      limite_inicial: null,
      cadastrada_em: null,
      cadastrada_por: null,
      dia_cadastro: null,
      comandada_em: null,
      coletada_em: null,
      cancelada_em: null,
      valor_mercadoria: null,
      volumes: null,
      peso_kg: null,
      mercadoria: null,
      tipo_frete: null,
      notas_fiscais: null,
      observacao: null,
      ctrc_sigla: null,
      ctrc_numero: null,
      romaneio: null,
      prejudicada_horario: null,
      historico: null,
      relatorio_emitido_em: null,
      arquivo_origem: null,
      atualizado_em: null,
      empresa_id: null,
    };
    const linha: OrigemColeta = {
      ...coleta,
      unidade: "CAP",
      numero: 10,
      tipo: null,
      situacao: "COLETADA",
      ctrc_sigla: "CAP",
      ctrc_numero: "33214",
      valor_mercadoria: "100",
      peso_kg: "1.5",
      prejudicada_horario: null,
      historico: null,
      relatorio_emitido_em: "2026-11-05 10:00:00+00",
      empresa_id: EMPRESA,
    };
    expect(migrada(passoColetas, linha, null)).toMatchObject({
      etapa: "coletada",
      tipo: "NORMAL",
      cteSigla: "CAP",
      cteNumero: "33214",
      valorMercadoria: "100.00",
      pesoKg: "1.500",
      historico: "[]",
    });
    expect(() => rodar(passoColetas, { ...linha, peso_kg: "1.0005" }, null)).toThrow(/peso_kg/);
  });

  it("saída para entrega sem sigla fica de fora", () => {
    const saida = {
      numero_ctrc: "33214",
      sigla_ctrc: null,
      data_saida: "2026-11-01",
      empresa_id: EMPRESA,
    };
    expect(motivo(rodar(passoRomaneioSaidasCte, saida, null))).toMatch(/sigla/);
    expect(migrada(passoRomaneioSaidasCte, { ...saida, sigla_ctrc: "CAP" }, null).sigla).toBe(
      "CAP",
    );
  });
});

describe("ingestão e logs", () => {
  const [passo038] = passosDasLinhasDeRelatorio;
  const linha = {
    id: "s1",
    empresa_id: EMPRESA,
    lote_id: "l1",
    arquivo_origem: "038_CAP_2026-11-09.csv",
    importado_em: "2026-11-09 10:00:00+00",
    dados: '{"ctrc": "CAP033214-5", "atraso": 2, "prazo_entrega": "2026-11-12"}',
  };

  it("linha de relatório: código, sigla/número do CT-e, arquivo e aplicada", () => {
    if (!passo038) throw new Error("sem passo do 038");
    const arquivos = new Map([[`${EMPRESA}|038_CAP_2026-11-09.csv`, "arq-1"]]);
    expect(migrada(passo038, linha, arquivos)).toMatchObject({
      relatorio: "038",
      sigla: "CAP",
      numero: "33214",
      hash: identificarLinha("038", { ctrc: "CAP033214-5", atraso: 2, prazo_entrega: "2026-11-12" })
        .hash,
      dataReferencia: null,
      arquivoId: "arq-1",
      aplicadoEm: linha.importado_em,
      dados: linha.dados,
    });
    expect(
      migrada(passo038, { ...linha, arquivo_origem: "outro.csv" }, arquivos).arquivoId,
    ).toBeNull();
  });

  it("os cinco relatórios, com o código que o worker usa (sem o espelho do 455)", () => {
    expect(passosDasLinhasDeRelatorio.map((p) => p.nome)).toEqual([
      "ingestao_linhas:038",
      "ingestao_linhas:455csv",
      "ingestao_linhas:930",
      "ingestao_linhas:306",
      "ingestao_linhas:036",
    ]);
  });

  it("306: coleta pura fica sem sigla e sem número; 036 com o dia de emissão às 00:00 de SP", () => {
    const p306 = passosDasLinhasDeRelatorio.find((p) => p.nome === "ingestao_linhas:306");
    const p036 = passosDasLinhasDeRelatorio.find((p) => p.nome === "ingestao_linhas:036");
    if (!p306 || !p036) throw new Error("sem passo");
    const coleta = { ...linha, dados: '{"ctrc_coleta": "123456", "data": "2026-11-09"}' };
    expect(migrada(p306, coleta, new Map())).toMatchObject({ sigla: null, numero: null });
    const rom = { ...linha, dados: '{"ctrc": "CAP033214-5", "data_emissao": "2026-11-09"}' };
    expect(migrada(p036, rom, new Map())).toMatchObject({
      sigla: "CAP",
      numero: "33214",
      dataReferencia: "2026-11-09T03:00:00.000Z",
    });
  });

  it("aplicação: dry_run → simulacao; status nulo vira concluido com aviso", () => {
    const aplicacao = {
      id: "ap1",
      aplicado_por: null,
      dry_run: true,
      total_inseridos: null,
      total_atualizados: 3,
      total_ocorrencias: null,
      total_ignorados: null,
      payload: null,
      status: null,
      iniciado_em: "2026-11-01 00:00:00+00",
      finalizado_em: null,
      erro: null,
      empresa_id: EMPRESA,
    };
    expect(rodar(passoIngestaoAplicacoes, aplicacao, null)).toMatchObject({
      linha: { simulacao: true, status: "concluido", totalInseridos: 0, totalAtualizados: 3 },
      ajustes: ["status nulo gravado como concluido"],
    });
  });

  it("logs: cron vira agendamento, webhook sem empresa e BI2 sem código ficam de fora", () => {
    const ftp = {
      id: "x1",
      executado_em: INSTANTE,
      finalizado_em: null,
      status: "ok",
      triggered_by: "cron",
      arquivos_processados: null,
      arquivos_removidos: null,
      arquivos_com_erro: null,
      ctrcs_processados: 7,
      duracao_ms: null,
      mensagem: null,
      erros: null,
      arquivos_movidos: null,
      pastas_limpas: null,
      empresa_id: EMPRESA,
    };
    expect(migrada(passoXmlFtpSincronizacoes, ftp, null)).toMatchObject({
      disparadoPor: "agendamento",
      ctesProcessados: 7,
      erros: "[]",
    });

    const webhook = {
      id: "w1",
      recebido_em: INSTANTE,
      ip: null,
      user_agent: null,
      auth_ok: null,
      motivo_rejeicao: null,
      status_http: 200,
      payload_bruto: null,
      ctrc_id: "c1",
      ocorrencia_id: null,
      erro_processamento: null,
      empresa_id: null,
    };
    expect(motivo(rodar(passoSswWebhookEventos, webhook, null))).toMatch(/empresa_id nulo/);
    expect(
      migrada(passoSswWebhookEventos, { ...webhook, empresa_id: EMPRESA }, null),
    ).toMatchObject({
      autenticado: false,
      cteId: "c1",
      statusHttp: 200,
    });

    const bi2 = {
      id: "b1",
      data_alvo: "2026-11-01",
      modo: null,
      status: null,
      total_linhas: null,
      criados: null,
      atualizados: null,
      erro: null,
      iniciado_em: INSTANTE,
      finalizado_em: null,
      codigo_relatorio: null,
      data_fechamento_ssw: null,
      empresa_id: EMPRESA,
    };
    expect(motivo(rodar(passoBi2Sincronizacoes, bi2, null))).toMatch(/código/);
  });

  it("órfão de XML sem expiração fica de fora", () => {
    const orfao = {
      id: "x",
      sha256_xml: "s",
      nome_xml: "n",
      tipo: "cte",
      chave_cte: null,
      xml_conteudo: "<x/>",
      status: null,
      tentativas: null,
      ultima_tentativa: null,
      ultimo_erro: null,
      casado_em: null,
      numero_ctrc: "1",
      expira_em: null,
      created_at: INSTANTE,
      updated_at: null,
      empresa_id: EMPRESA,
    };
    expect(motivo(rodar(passoXmlCteOrfaos, orfao, null))).toMatch(/expiração/);
    expect(migrada(passoXmlCteOrfaos, { ...orfao, expira_em: INSTANTE }, null)).toMatchObject({
      status: "pendente",
      numeroCte: "1",
    });
  });
});
