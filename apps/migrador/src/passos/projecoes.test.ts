import { type ProjecaoDoCte } from "@erp/dominio/romaneio/projecoes";
import { describe, expect, it } from "vitest";

import { destinoFalso, origemFalsa } from "../testes/falsos";
import { passoDasProjecoes, type ProjecoesNoDestino } from "./projecoes";

const EMPRESA = "f0000000-0000-4000-8000-000000000001";
const FILTROS = { empresaId: null, instante: "2026-11-10 12:00:00+00" };

function montar() {
  const gravadas: ProjecaoDoCte[] = [];
  const noDestino: ProjecoesNoDestino = () => (fn) =>
    fn({
      gravadas: () =>
        Promise.resolve({
          viagens: new Map(),
          saidas: new Map(),
          atuais: new Map(),
          dados: new Map(),
          conferentes: new Map(),
        }),
      gravar: (p) => {
        gravadas.push(...p);
        return Promise.resolve();
      },
    });
  const origem = origemFalsa(
    {},
    {
      // Ordem importa: a lista de chaves é a única consulta com `union`.
      union: [{ numero: "38984", sigla: "CAP" }],
      "public.staging_036_romaneios o": [
        {
          sigla: "CAP",
          numero: "38984",
          // De agosto: fora dos 60 dias de `ingestao_linhas`, mas a projeção precisa dele.
          importado_em: "2026-08-01T12:00:00+00:00",
          dados: JSON.stringify({
            ctrc: "CAP038984-6",
            romaneio: "R1",
            data_emissao: "2026-08-01",
            situacao: "BAIXADO",
            conferente: " ANA ",
          }),
        },
      ],
      "count(*)": [{ n: 1 }],
    },
  );
  const destino = destinoFalso();
  destino.consultar = origemFalsa(
    {},
    { "erp.empresas": [{ id: EMPRESA }], "count(*)": [{ n: 1 }] },
  ).consultar;
  return { passo: passoDasProjecoes(noDestino), infra: { origem, destino }, gravadas };
}

describe("projeções do Romaneio no migrador", () => {
  it("não roda na simulação", async () => {
    const { passo, infra, gravadas } = montar();
    expect(await passo.executar(infra, FILTROS, true)).toEqual([
      expect.stringMatching(/não roda na simulação/),
    ]);
    expect(gravadas).toHaveLength(0);
  });

  it("reconstrói pela staging inteira do public com o caso de uso do worker", async () => {
    const { passo, infra, gravadas } = montar();
    const notas = await passo.executar(infra, FILTROS, false);
    expect(gravadas).toMatchObject([
      {
        chave: { sigla: "CAP", numero: "38984" },
        saidas: ["2026-08-01"],
        viagens: [{ romaneio: "R1", dataSaida: "2026-08-01" }],
        conferente: { conferente: "ANA", romaneio: "R1" },
      },
    ]);
    expect(notas[0]).toContain("1 CT-e reconstruídos, 1 gravados");
    expect(notas[0]).toContain("romaneio_viagens_cte 1 (mv_romaneio_viagem_ctrc: 1)");
  });
});
