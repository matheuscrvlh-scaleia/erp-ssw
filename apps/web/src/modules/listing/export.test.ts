import { type LinhaLista } from "@erp/shared/contracts/listing";
import { describe, expect, it } from "vitest";

import {
  COLUNAS_DA_EXPORTACAO,
  linhaExportada,
  nomeDoArquivo,
  subtituloDaExportacao,
} from "./export";
import { lerBuscaDaLista } from "./search";

describe("exportação", () => {
  const linha: LinhaLista = {
    id: "8f1d2c3b-0000-4000-8000-000000000001",
    sigla: "CAP",
    numero: "33214",
    numeroNf: 9988,
    destinatario: 'LOJA "CENTRO"; FILIAL',
    cidadeDestino: "MANAUS",
    bairroDestino: null,
    setor: null,
    setorDestino: "S2",
    unidadeDestino: "MAO",
    codigo: 35,
    descricao: "AGENDAMENTO",
    dataOcorrencia: "2026-11-09T13:00:00.000Z",
    placa: null,
    dataEmissao: "2026-11-03",
    dataPrevista: "2026-11-08",
    dataEntrega: null,
    dataEmbarque: null,
    parceiroNome: null,
    pagadorNome: "ACME",
    remetente: null,
    tipoDocumento: "NORMAL",
    peso: 1234.5,
    valorFrete: 10,
    volumes: 2,
    localizacao: null,
    primeiroManifesto: null,
    ultimoManifesto: null,
    valorMercadoria: null,
    atrasoDias: 2,
    performanceDias: null,
    noPrazo: null,
    responsabilidadeCliente: null,
    tde: 0,
  };

  it("linha achatada: setor do destino na falta do setor e TDE zero vazio", () => {
    const l = linhaExportada(linha);
    expect(l.setor).toBe("S2");
    expect(l.tde).toBeNull();
    expect(l.origem).toBe("CAP");
    expect(l.linkSsw).toContain("ssw0053");
  });

  it("28 colunas no arquivo, com o link do SSW no fim", () => {
    expect(COLUNAS_DA_EXPORTACAO).toHaveLength(28);
    expect(COLUNAS_DA_EXPORTACAO.at(-1)?.titulo).toBe("Link SSW");
  });

  it("nome do arquivo com os recortes e o período", () => {
    expect(nomeDoArquivo(["atrasados", "sem_movimento"], "2026-11-01", "2026-11-10")).toBe(
      "listagem-ctrcs-atrasados+sem_movimento-2026-11-01-a-2026-11-10",
    );
  });

  it("subtítulo: o período e só os filtros preenchidos", () => {
    const busca = lerBuscaDaLista({ unidades: ["CAP"], codigos: [35, 85], cidade: "MANAUS" });
    expect(subtituloDaExportacao(busca, { inicio: "2026-11-01", fim: "2026-11-10" })).toBe(
      "Período: 2026-11-01 → 2026-11-10 · Unidades: CAP · Códigos: 35, 85 · Cidade: MANAUS",
    );
  });
});
