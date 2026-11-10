import { type LinhaExportada } from "@erp/shared/contratos/romaneio";
import { describe, expect, it } from "vitest";

import { lerFiltros } from "@/hooks/filtros-na-url";

import {
  buscaDaAbertura,
  codigosDaBusca,
  esquemaRomaneio,
  filtrosDaBarra,
  recorteEfetivo,
} from "./busca";
import {
  alternarLinha,
  alternarTodas,
  estadoDoCabecalho,
  estaMarcada,
  linhaParaExportar,
  proximaOrdem,
  quantasMarcadas,
  selecaoInicial,
} from "./lista";

const intervalo = { inicio: "2026-11-01", fim: "2026-11-10" };
const busca = (bruto: Record<string, unknown>) => lerFiltros(esquemaRomaneio, bruto);

describe("URL do Romaneio", () => {
  it("padrões de hoje: aba Hoje, mês, por saída, 50 por página", () => {
    const b = busca({});
    expect(b).toMatchObject({ tab: "hoje", periodo: "mes", ver: "saida", size: 50, page: 1 });
    expect(b.ordem).toBeUndefined();
  });

  it("aceita os parâmetros singulares antigos (codigo, placa, motorista)", () => {
    const b = busca({ tab: "andamento", codigo: "13", codigos: ["69"], placa: "ABC1D23" });
    expect(codigosDaBusca(b)).toEqual([13, 69]);
    expect(filtrosDaBarra(b, intervalo).placas).toEqual(["ABC1D23"]);
  });

  it("verTodos vem como 0/1", () => {
    expect(busca({ verTodos: 1 }).verTodos).toBe(true);
    expect(busca({ verTodos: "0" }).verTodos).toBe(false);
  });

  it("tamanho de página fora da lista volta para 50", () => {
    expect(busca({ size: 75 }).size).toBe(50);
  });
});

describe("filtrosDaBarra", () => {
  it("só leva os filtros preenchidos", () => {
    expect(filtrosDaBarra(busca({ ver: "emissao" }), intervalo)).toEqual({
      campo: "emissao",
      ...intervalo,
    });
  });

  it("Motorista vale fora da aba Ajudante; Ajudante só nela", () => {
    const b = busca({ motoristas: ["JOAO"], ajudantes: ["PEDRO"] });
    expect(filtrosDaBarra({ ...b, tab: "motoristas" }, intervalo)).toMatchObject({
      motoristas: ["JOAO"],
    });
    expect(filtrosDaBarra({ ...b, tab: "motoristas" }, intervalo).ajudantes).toBeUndefined();
    const ajudante = filtrosDaBarra({ ...b, tab: "ajudantes" }, intervalo);
    expect(ajudante.ajudantes).toEqual(["PEDRO"]);
    expect(ajudante.motoristas).toBeUndefined();
  });
});

describe("recorte da lista", () => {
  it("sem recorte: por emissão mostra só romaneados, salvo 'Ver todos'", () => {
    expect(recorteEfetivo({ recorte: "todos", ver: "emissao", verTodos: false })).toBe(
      "romaneados",
    );
    expect(recorteEfetivo({ recorte: "todos", ver: "emissao", verTodos: true })).toBe("todos");
    expect(recorteEfetivo({ recorte: "todos", ver: "saida", verTodos: false })).toBe("todos");
  });

  it("o card clicado vence", () => {
    expect(recorteEfetivo({ recorte: "travado", ver: "emissao", verTodos: false })).toBe("travado");
  });

  it("abrir pela distribuição leva código, em rota e só em andamento, sem 'Em rota agora'", () => {
    expect(buscaDaAbertura({ codigos: [13], recorte: "em_rota", status: "andamento" })).toEqual({
      tab: "andamento",
      recorte: "em_rota",
      romaneado: "todos",
      status: "andamento",
      codigos: ["13"],
      codigo: "",
      page: 1,
    });
  });
});

describe("seleção para exportar", () => {
  it("começa com tudo marcado; desmarcar uma tira só ela", () => {
    const s = alternarLinha(selecaoInicial("f"), "a");
    expect(estaMarcada(s, "a")).toBe(false);
    expect(estaMarcada(s, "b")).toBe(true);
    expect(quantasMarcadas(s, 10)).toBe(9);
    expect(estadoDoCabecalho(s)).toBe("indeterminate");
  });

  it("a caixa do cabeçalho desmarca a lista inteira e depois marca uma a uma", () => {
    const nenhuma = alternarTodas(selecaoInicial("f"));
    expect(estadoDoCabecalho(nenhuma)).toBe(false);
    expect(quantasMarcadas(nenhuma, 10)).toBe(0);
    const uma = alternarLinha(nenhuma, "a");
    expect(estaMarcada(uma, "a")).toBe(true);
    expect(quantasMarcadas(uma, 10)).toBe(1);
    expect(alternarTodas(uma).modo).toBe("todas");
  });
});

describe("ordenação por coluna", () => {
  it("mesma coluna inverte; outra começa crescente", () => {
    expect(proximaOrdem({ ordem: "peso", dir: "asc" }, "peso")).toEqual({
      ordem: "peso",
      dir: "desc",
    });
    expect(proximaOrdem({ ordem: "peso", dir: "desc" }, "volumes")).toEqual({
      ordem: "volumes",
      dir: "asc",
    });
    expect(proximaOrdem({ dir: "asc" }, "peso")).toEqual({ ordem: "peso", dir: "asc" });
  });
});

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
});
