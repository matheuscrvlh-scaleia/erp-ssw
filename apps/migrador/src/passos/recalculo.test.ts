import { recalcularDerivadosDoCte } from "@erp/dominio/nucleo";
import { CATALOGO_FR, cte } from "@erp/dominio/testes/nucleo";
import { describe, expect, it } from "vitest";

import { destinoFalso, origemFalsa } from "../testes/falsos";
import { ErroDeConversao } from "../transformacoes/erros";
import {
  CAMPOS_DERIVADOS,
  camposDiferentes,
  conferirColunasCalculadas,
  type LinhaCteGravada,
  paraCteNucleo,
} from "./recalculo";

const EMPRESA = "f0000000-0000-4000-8000-000000000001";
const FILTROS = { empresaId: null, instante: "2026-11-10 12:00:00+00" };

const contexto = {
  ocorrencias: [],
  catalogo: CATALOGO_FR,
  filiais: [],
  regrasDePrazo: [],
  config: {
    limiteSemMovimento: 7,
    dataMinimaEmissao: "2026-09-01",
    prazoPadraoDias: 3,
    raizCnpjTroca: null,
  },
};

/** CT-e gravado sem nenhum derivado preenchido (o núcleo vai querer preencher alguns). */
function linhaGravada(extra: Partial<LinhaCteGravada> = {}): LinhaCteGravada {
  return {
    id: "c0000000-0000-4000-8000-000000000001",
    data_emissao: "2026-11-03",
    criado_em: "2026-11-03T10:00:00+00:00",
    duplicado_de: null,
    data_entrega_realizada: null,
    cancelado_em: null,
    pagador_cnpj: "12.345.678/0001-90",
    parceiro_cnpj: null,
    unidade_destino: null,
    unidade_atual: null,
    filial: "CAP",
    campos_ssw: [],
    ult_ocorr_codigo_0174: null,
    ult_ocorr_descricao_0174: null,
    ult_ocorr_data_0174: null,
    ult_ocorr_local_0174: null,
    ult_ocorr_instrucao_0174: null,
    ultima_ocorr_codigo_0013: null,
    ultima_ocorr_data_0013: null,
    ocorr_036_codigo: null,
    ocorr_036_descricao: null,
    ocorr_036_data: null,
    ocorr_efetiva_codigo: null,
    ocorr_efetiva_descricao: null,
    ocorr_efetiva_data: null,
    ocorr_efetiva_fonte: null,
    ocorr_efetiva_local: null,
    ocorr_efetiva_codigo_num: null,
    data_prevista_entrega: null,
    prazo_fonte: null,
    data_base_prazo: null,
    previsao_ssw_data: null,
    previsao_ssw_fonte: null,
    previsao_ssw_data_base: null,
    data_embarque: null,
    data_conclusao_efetiva: null,
    pagador_cnpj_digitos: null,
    filial_efetiva: null,
    unidade_cidade: null,
    unidade_uf: null,
    prazo_padrao_dias: null,
    prazo_padrao_data: null,
    status_atual: null,
    cancelado_mesmo_dia: false,
    fora_universo: false,
    ...extra,
  };
}

describe("conferência das colunas calculadas pelo núcleo", () => {
  it("a lista de campos cobre tudo o que o núcleo devolve", () => {
    const derivados = recalcularDerivadosDoCte(cte(), contexto);
    expect([...CAMPOS_DERIVADOS].sort()).toEqual(Object.keys(derivados).sort());
  });

  it("CT-e já igual ao recálculo não tem diferença; instante compara pelo valor", () => {
    const base = cte({ pagadorCnpj: "12.345.678/0001-90", filial: "CAP" });
    const igual = { ...base, ...recalcularDerivadosDoCte(base, contexto) };
    expect(camposDiferentes(igual, recalcularDerivadosDoCte(igual, contexto))).toEqual([]);

    const errado = { ...igual, pagadorCnpjDigitos: "1", filialEfetiva: null };
    expect(camposDiferentes(errado, recalcularDerivadosDoCte(errado, contexto))).toEqual([
      "filialEfetiva",
      "pagadorCnpjDigitos",
    ]);
  });

  it("lê a linha gravada: instante ISO vira Date, fonte fora da lista é erro", () => {
    const lido = paraCteNucleo(linhaGravada({ ocorr_036_data: "2026-11-04T08:30:00+00:00" }));
    expect(lido.criadoEm.toISOString()).toBe("2026-11-03T10:00:00.000Z");
    expect(lido.ocorr036Data?.toISOString()).toBe("2026-11-04T08:30:00.000Z");
    expect(() => paraCteNucleo(linhaGravada({ ocorr_efetiva_fonte: "chute" }))).toThrow(
      ErroDeConversao,
    );
    expect(() => paraCteNucleo(linhaGravada({ prazo_fonte: "chute" }))).toThrow(ErroDeConversao);
  });

  it("não roda na simulação", async () => {
    const infra = { origem: origemFalsa({}), destino: destinoFalso() };
    expect(await conferirColunasCalculadas.executar(infra, FILTROS, true)).toEqual([
      expect.stringMatching(/não roda na simulação/),
    ]);
  });

  it("recalcula o que foi gravado e conta, por campo, o que mudaria (sem corrigir)", async () => {
    const linha = linhaGravada();
    const esperado = camposDiferentes(
      paraCteNucleo(linha),
      recalcularDerivadosDoCte(paraCteNucleo(linha), {
        ...contexto,
        config: { ...contexto.config, prazoPadraoDias: 5 },
        filiais: [{ sigla: "CAP", cidade: "CAMPINAS", uf: "SP", propria: true }],
      }),
    );
    expect(esperado).toContain("pagadorCnpjDigitos");

    const destino = destinoFalso();
    destino.consultar = origemFalsa(
      {},
      {
        "from erp.empresas": [{ id: EMPRESA }],
        "from erp.codigos_ocorrencia": [
          {
            codigo: 1,
            descricao: "ENTREGA REALIZADA",
            tipo_ssw: "ENTREGA",
            processo_ssw: null,
            responsavel: "sistema",
            penaliza: false,
          },
        ],
        "from erp.filiais": [{ sigla: "CAP", cidade: "CAMPINAS", uf: "SP", propria: true }],
        "from erp.prazos_configurados": [],
        "from erp.configuracoes": [
          { chave: "prazo_padrao_dias", valor: "3" },
          { chave: "prazo_padrao_dias", valor: "5" },
        ],
        "from erp.ctes": [linha],
        "from erp.ocorrencias": [],
      },
    ).consultar;
    const infra = { origem: origemFalsa({}), destino };

    const notas = await conferirColunasCalculadas.executar(infra, FILTROS, false);
    expect(notas[0]).toMatch(/^1 CT-e recalculados com o núcleo/);
    expect(notas.slice(1).map((n) => n.split(":")[0])).toEqual([...esperado].sort());
    expect(notas.join("\n")).toContain(linha.id);
    expect(destino.gravacoes).toEqual([]);
    expect(destino.executados).toEqual([]);
  });
});
