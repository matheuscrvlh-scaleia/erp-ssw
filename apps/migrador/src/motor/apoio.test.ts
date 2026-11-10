import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { auditoria, ctes, ingestaoLinhas, ocorrencias } from "@erp/db/schema";
import { afterEach, describe, expect, it } from "vitest";

import { SomaDeConferencia } from "./checksum";
import { armazemEmArquivo, type Contagem, contar, EXEMPLOS_POR_MOTIVO } from "./estado";
import { type Relatorio } from "./executar";
import { chaveDaTupla, textoDoValor } from "./infra";
import { metadadosDe } from "./metadados";
import { relatorioEmMarkdown } from "./relatorio";
import { daEmpresa, montarLoteDeOrigem, montarSql, nosUltimosDias } from "./sql";

const filtros = { empresaId: null, instante: "2026-11-10 12:00:00+00" };

describe("montarSql", () => {
  it("troca @nome por $n::tipo, um parâmetro por nome", () => {
    const sql = montarSql("select 1 where a = @x and b = @y and c = @x", {
      x: { valor: 1, tipo: "integer" },
      y: { valor: "t", tipo: "text" },
    });
    expect(sql.texto).toBe("select 1 where a = $1::integer and b = $2::text and c = $1::integer");
    expect(sql.parametros).toEqual([1, "t"]);
  });

  it("não confunde cast `::` com parâmetro e recusa nome sem valor", () => {
    expect(montarSql("select x::text", {}).texto).toBe("select x::text");
    expect(() => montarSql("select @falta", {})).toThrow(/@falta/);
  });

  it("filtro de empresa e janela de retenção ficam parametrizados", () => {
    const sql = montarSql(`${daEmpresa("o.empresa_id")} and ${nosUltimosDias("o.criado", 60)}`, {
      empresa: { valor: null, tipo: "uuid" },
      instante: { valor: filtros.instante, tipo: "timestamptz" },
    });
    expect(sql.texto).toBe(
      "($1::uuid is null or o.empresa_id = $1::uuid) and o.criado >= $2::timestamptz - interval '60 days'",
    );
  });
});

describe("montarLoteDeOrigem (keyset)", () => {
  const consulta = {
    colunas: "o.*",
    de: "public.ocorrencias o",
    onde: [daEmpresa("o.empresa_id")],
    chave: [
      { expressao: "o.ctrc_id", tipo: "uuid" },
      { expressao: "o.id", tipo: "uuid" },
    ],
  };

  it("primeira página: sem condição de chave, ordenada e limitada", () => {
    const sql = montarLoteDeOrigem(consulta, filtros, null, 500);
    expect(sql.texto).toContain("(o.ctrc_id)::text as __k0, (o.id)::text as __k1");
    expect(sql.texto).toContain("order by o.ctrc_id, o.id");
    expect(sql.texto).not.toContain(">");
    expect(sql.parametros).toEqual([null, 500]);
  });

  it("páginas seguintes comparam a tupla com o tipo nativo", () => {
    const sql = montarLoteDeOrigem(consulta, filtros, ["a", "b"], 500);
    expect(sql.texto).toContain("(o.ctrc_id, o.id) > ($2::uuid, $3::uuid)");
    expect(sql.parametros).toEqual([null, "a", "b", 500]);
  });

  it("checkpoint com chave de outro formato é erro", () => {
    expect(() => montarLoteDeOrigem(consulta, filtros, ["a"], 1)).toThrow(/outro formato/);
  });
});

describe("SomaDeConferencia", () => {
  it("não depende da ordem das linhas nem das chaves", () => {
    const a = new SomaDeConferencia();
    const b = new SomaDeConferencia();
    a.adicionar({ id: "1", v: "2.00" }, new Set());
    a.adicionar({ id: "2", v: null }, new Set());
    b.adicionar({ v: null, id: "2" }, new Set());
    b.adicionar({ v: "2.00", id: "1" }, new Set());
    expect(a.valor).toBe(b.valor);
    expect(a.quantidade).toBe(2);
  });

  it("jsonb em texto (origem) e objeto (montado) comparam igual", () => {
    const a = new SomaDeConferencia();
    const b = new SomaDeConferencia();
    a.adicionar({ p: '{"b": 1, "a": [1]}' }, new Set(["p"]));
    b.adicionar({ p: { a: [1], b: 1 } }, new Set(["p"]));
    expect(a.valor).toBe(b.valor);
  });

  it("qualquer diferença de valor muda a soma", () => {
    const a = new SomaDeConferencia();
    const b = new SomaDeConferencia();
    a.adicionar({ v: "1.00" }, new Set());
    b.adicionar({ v: "1.0" }, new Set());
    expect(a.valor).not.toBe(b.valor);
  });
});

describe("metadadosDe", () => {
  it("lê nome, tipo e natureza das colunas do schema Drizzle", () => {
    const meta = metadadosDe(ctes);
    expect(meta.nomeSql).toBe('"erp"."ctes"');
    expect(meta.colunas.get("valorFrete")).toMatchObject({
      nome: "valor_frete",
      tipo: "numeric(14, 2)",
    });
    expect(meta.colunas.get("prazoOrigem")?.tipo).toBe('"erp"."prazo_origem"');
    expect(meta.colunas.get("camposSsw")?.tipo).toBe("text[]");
    expect(metadadosDe(ocorrencias).colunas.get("responsavel")?.tipo).toBe(
      '"erp"."responsavel_ocorrencia"',
    );
    expect(metadadosDe(ingestaoLinhas).colunas.get("dados")?.json).toBe(true);
    expect(metadadosDe(auditoria).colunas.get("id")?.identidade).toBe(true);
  });
});

describe("tuplas de referência", () => {
  it("valores viram o texto que o Postgres devolve", () => {
    expect(textoDoValor(12)).toBe("12");
    expect(textoDoValor(null)).toBeNull();
    expect(chaveDaTupla(["a", 3])).toBe(chaveDaTupla(["a", "3"]));
  });
});

describe("estado (checkpoint)", () => {
  let pasta: string | null = null;
  afterEach(async () => {
    if (pasta) await rm(pasta, { recursive: true, force: true });
  });

  it("grava e relê o checkpoint; arquivo ausente é estado nulo", async () => {
    pasta = await mkdtemp(join(tmpdir(), "migrador-"));
    const armazem = armazemEmArquivo(join(pasta, "sub", "checkpoint.json"));
    expect(await armazem.ler()).toBeNull();
    const estado = {
      versao: 1 as const,
      instante: "2026-11-10 12:00:00+00",
      empresaId: null,
      tabelas: {},
    };
    await armazem.salvar(estado);
    expect(await armazem.ler()).toEqual(estado);
  });

  it("checkpoint corrompido pede --recomecar", async () => {
    pasta = await mkdtemp(join(tmpdir(), "migrador-"));
    const caminho = join(pasta, "checkpoint.json");
    await armazemEmArquivo(caminho).salvar({
      versao: 1,
      instante: "x",
      empresaId: null,
      tabelas: {},
    });
    const texto = await readFile(caminho, "utf8");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(caminho, texto.replace('"versao": 1', '"versao": 9'), "utf8");
    await expect(armazemEmArquivo(caminho).ler()).rejects.toThrow(/--recomecar/);
  });

  it("conta tudo mas guarda só os primeiros exemplos", () => {
    const mapa: Record<string, Contagem> = {};
    for (let i = 0; i < EXEMPLOS_POR_MOTIVO + 5; i++) contar(mapa, "m", String(i));
    expect(mapa.m?.quantidade).toBe(EXEMPLOS_POR_MOTIVO + 5);
    expect(mapa.m?.exemplos).toHaveLength(EXEMPLOS_POR_MOTIVO);
  });
});

describe("relatório", () => {
  it("mostra contagens, descartes, erros, conferência e pendências", () => {
    const relatorio: Relatorio = {
      iniciadoEm: "2026-11-10T12:00:00.000Z",
      finalizadoEm: "2026-11-10T13:00:00.000Z",
      simulacao: false,
      empresaId: null,
      instante: "2026-11-10 12:00:00+00",
      sucesso: false,
      passosFinais: [{ nome: "reconstruir-projecoes", notas: ["PENDENTE: x"] }],
      tabelas: [
        {
          nome: "ctes",
          origem: "public.ctrcs",
          destino: "ctes",
          retomadaConcluida: false,
          notas: ["duplicado_de gravado"],
          conferencia: {
            origem: 2,
            destino: 1,
            checksumOrigem: "a",
            checksumDestino: "b",
            errosDeConversao: 0,
            confere: false,
          },
          estado: {
            status: "falhou",
            ultimaChave: null,
            lidas: 3,
            migradas: 2,
            descartes: { "sem sigla": { quantidade: 1, exemplos: ["id-1"] } },
            ajustes: {},
            erros: [{ chave: "id-2", coluna: "tde", valor: "1.005", motivo: "tde: casas" }],
          },
        },
      ],
    };
    const md = relatorioEmMarkdown(relatorio, ["bi2_viagens: sem uso"]);
    expect(md).toContain("**com falhas**");
    expect(md).toContain("- Lidas: 3; migradas: 2");
    expect(md).toContain("**NÃO CONFERE** — origem 2 × destino 1");
    expect(md).toContain("- sem sigla: 1 (id-1)");
    expect(md).toContain("- id-2: tde: casas (valor `1.005`)");
    expect(md).toContain("PENDENTE: x");
    expect(md).toContain("- bi2_viagens: sem uso");
  });
});
