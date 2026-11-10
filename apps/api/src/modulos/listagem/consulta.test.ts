import { montarFiltroLista } from "@erp/dominio/listagem/filtro";
import { filtroLista } from "@erp/shared/contratos/listagem";
import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { ordemDaLista, whereDaLista } from "./consulta";

const EMPRESA = "0b7c9d1e-0000-4000-8000-0000000000aa";
const dialeto = new PgDialect();
/** SQL e parâmetros, sem o prefixo do schema (`"erp"."ctes"."x"` → `"ctes"."x"`). */
const render = (consulta: SQL | undefined) => {
  if (!consulta) throw new Error("sem WHERE");
  const { sql, params } = dialeto.sqlToQuery(consulta);
  return { sql: sql.replaceAll('"erp".', ""), params };
};

function filtro(entrada: Record<string, unknown>) {
  const f = montarFiltroLista(filtroLista.parse(entrada), {
    filiaisProprias: ["CAP", "CAS"],
    catalogo: [
      { codigo: 12, tipoSsw: "BAIXA", pendenciaAcompanhada: false },
      { codigo: 13, tipoSsw: "PENDENCIA_TRANSPORTADORA", pendenciaAcompanhada: true },
    ],
    codigosForaDaTela: [],
    limiteSemMovimento: 3,
    agora: new Date("2026-11-10T15:00:00Z"),
  });
  if (!f) throw new Error("filtro vazio");
  return f;
}

describe("WHERE da Listagem", () => {
  it("sempre recorta empresa, universo e filiais próprias", () => {
    const { sql, params } = render(whereDaLista(EMPRESA, filtro({})));
    expect(sql).toContain('"ctes"."empresa_id" = $1 and not "ctes"."fora_universo"');
    expect(sql).toContain('"ctes"."filial_efetiva" = any($2::text[])');
    expect(params.slice(0, 2)).toEqual([EMPRESA, ["CAP", "CAS"]]);
    expect(sql).not.toContain(" or ");
  });

  it("texto digitado só entra como parâmetro, nunca no SQL", () => {
    const perigoso = "x'; drop table erp.ctes; --";
    const { sql, params } = render(
      whereDaLista(EMPRESA, filtro({ remetente: perigoso, destino: "a|b", ctrc: perigoso })),
    );
    expect(sql).not.toContain("drop table");
    expect(sql).toContain('"ctes"."remetente" ilike any(');
    expect(params).toContainEqual(["%x'; drop table erp.ctes; --%"]);
    expect(params).toContainEqual(["%a%", "%b%"]);
  });

  it("período pela base escolhida; busca por CT-e ignora o período", () => {
    const comPeriodo = render(
      whereDaLista(EMPRESA, filtro({ inicio: "2026-11-01", fim: "2026-11-10", base: "prevista" })),
    );
    expect(comPeriodo.sql).toContain('"ctes"."data_prevista_entrega" >= $');
    expect(comPeriodo.params).toContain("2026-11-01");

    const busca = render(
      whereDaLista(EMPRESA, filtro({ inicio: "2026-11-01", fim: "2026-11-10", ctrc: "CAP033214" })),
    );
    expect(busca.sql).not.toContain('"ctes"."data_emissao" >=');
    expect(busca.sql).toContain('"ctes"."sigla" = $');
    expect(busca.params).toEqual(expect.arrayContaining(["33214", "CAP"]));
  });

  it('nota "0" casa nota nula; nota fora do inteiro não casa nada', () => {
    expect(render(whereDaLista(EMPRESA, filtro({ nf: "0" }))).sql).toContain(
      '("ctes"."numero_nf" is null or "ctes"."numero_nf" = 0)',
    );
    expect(render(whereDaLista(EMPRESA, filtro({ nf: "99999999999" }))).sql).toContain("false");
  });

  it("vários recortes viram OU; o filtro de códigos some só nos códigos do recorte", () => {
    const f = filtro({ tipo: "entregues", recortes: ["finalizado_sistema"], codigos: [13] });
    const { sql } = render(whereDaLista(EMPRESA, f));
    expect(sql).toMatch(/\(\(.*\) or \(.*\)\)/s);
    expect(sql).toContain('"ctes"."ocorr_efetiva_codigo_num" = any(');
    const semCodigos = render(whereDaLista(EMPRESA, f, { semCodigos: true }));
    expect(semCodigos.sql.match(/ocorr_efetiva_codigo_num" = any\(/g)?.length ?? 0).toBeLessThan(
      sql.match(/ocorr_efetiva_codigo_num" = any\(/g)?.length ?? 0,
    );
  });

  it("recortes de ocorrência deixam a quarentena de fora (Q21)", () => {
    const { sql } = render(whereDaLista(EMPRESA, filtro({ tipo: "ocorrencia_13" })));
    expect(sql).toContain('not "ocorrencias"."quarentena"');
  });

  it("hoje e o dia do último movimento são de Brasília (Q11)", () => {
    const { params } = render(whereDaLista(EMPRESA, filtro({ tipo: "sem_atualizacao" })));
    expect(params).toContain("2026-11-10");
    expect(params).toContain("America/Sao_Paulo");
  });
});

describe("ordem da lista", () => {
  const f = filtro({});
  const ordem = (o: "atraso" | "emissao", d: "asc" | "desc") =>
    ordemDaLista(f, o, d).map((parte) => render(parte).sql);

  it("emissão desc usa o desempate direto; com desempate fixo por série e id (Q07)", () => {
    expect(ordem("emissao", "desc")).toEqual([
      '"ctes"."data_emissao" desc',
      '"ctes"."numero"::bigint asc',
      '"ctes"."sigla" asc',
      '"ctes"."id" asc',
    ]);
  });

  it("outra coluna vem antes, com vazios no fim", () => {
    const [primeira] = ordem("atraso", "asc");
    expect(primeira).toMatch(/case[\s\S]*end\) asc nulls last$/);
  });
});
