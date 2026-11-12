import { type LinhaExportada } from "@erp/shared/contratos/romaneio";
import { describe, expect, it } from "vitest";

import { COLUNAS_DA_LISTA, linhaParaExportar } from "./exportacao";

describe("linha exportada", () => {
  const base: LinhaExportada = {
    id: "00000000-0000-4000-8000-000000000001",
    sigla: "CAS",
    numero: "123456",
    numeroNf: 987,
    dataEmissao: "2026-11-02",
    dataEmbarque: "2026-11-02",
    dataPrevista: "2026-11-05",
    dataEntregaRealizada: null,
    parceiroId: null,
    parceiroNome: "NATURA",
    unidadeId: null,
    filial: "CAS",
    unidadeCidade: "CAMPINAS",
    unidadeUf: "SP",
    unidadeAtual: "CAS",
    placa: "KQK6I98",
    motorista: "JOAO",
    remetente: "NATURA",
    destinatario: "MARIA",
    cidadeDestino: "SUMARE",
    ufDestino: "SP",
    setor: "S1",
    bairro: "CENTRO",
    endereco: "RUA A, 1",
    valorMercadoria: 1000,
    peso: 600,
    volumes: 3,
    valorFrete: 120,
    tde: 15,
    statusAtual: "EM ROTA",
    ultimaOcorrencia: {
      codigo: 85,
      descricao: "SAIDA PARA ENTREGA",
      dataHora: "2026-11-05T11:00:00Z",
      fonte: "bi2_0174",
    },
    baixadoSemEntrega: false,
    emRotaAgora: true,
    atrasoDias: null,
    performanceDias: null,
    responsabilidadeCliente: false,
    pagador: "NATURA COSMETICOS",
    cep: "13170000",
    placaColeta: null,
    placaEntrega: "KQK6I98",
  };

  it("Status, Atraso e Alertas com as mesmas regras da tela (hoje = dia de Brasília)", () => {
    const l = linhaParaExportar(base, "2026-11-08", { pesoKg: 500, volumes: 10 });
    expect(l.status).toBe("Em rota");
    expect(l.atraso).toBe("3 dias");
    expect(l.alertas).toBe("ATRASADO 3 dias, CARGA PESADA, TDE");
    expect(l.destino).toBe("SUMARE/SP");
    expect(l.emRotaAgoraTexto).toBe("Sim");
    expect(l.linkSsw).toContain("t_nro_ctrc=123456");
  });

  it("baixado sem entrega não tem atraso", () => {
    const l = linhaParaExportar(
      { ...base, baixadoSemEntrega: true, emRotaAgora: false },
      "2026-11-08",
      {
        pesoKg: 1000,
        volumes: 10,
      },
    );
    expect(l.status).toBe("Baixado");
    expect(l.atraso).toBe("");
  });

  it("toda coluna do arquivo sai preenchida pela linha exportada", () => {
    const l = linhaParaExportar(base, "2026-11-08", { pesoKg: 500, volumes: 10 });
    expect(Object.keys(l)).toEqual(expect.arrayContaining(COLUNAS_DA_LISTA.map((c) => c.chave)));
  });
});
