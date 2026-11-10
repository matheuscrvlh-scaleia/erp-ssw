import { lerChavesDeSegredo } from "@erp/db/segredos";
import { type PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { metadadosDe } from "../motor/metadados";
import { montarLoteDeOrigem } from "../motor/sql";
import { type DefinicaoDeTabela } from "../motor/tipos";
import { criarPassos } from "./registro";

const chaves = lerChavesDeSegredo(`1:${Buffer.alloc(32, 1).toString("base64")}`, 1);
const passos = criarPassos(chaves);
const filtros = { empresaId: null, instante: "2026-11-10 12:00:00+00" };

async function cadaDefinicao(
  verificar: <O extends object, T extends PgTable, A>(def: DefinicaoDeTabela<O, T, A>) => void,
) {
  for (const passo of passos) {
    await passo.aplicar({
      executar: (def) => {
        verificar(def);
        return Promise.resolve();
      },
    });
  }
}

describe("registro de passos", () => {
  it("nomes únicos", () => {
    const nomes = passos.map((p) => p.nome);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("toda coluna citada (conflito, keyset, referências, conferência) existe no destino", async () => {
    await cadaDefinicao((def) => {
      const meta = metadadosDe(def.tabela);
      const citadas = [
        ...def.conflito,
        ...(def.chaveDestino ?? []),
        ...(def.foraDaConferencia ?? []),
        ...def.referencias.flatMap((r) => [
          ...r.colunas,
          ...("anular" in r.seAusente ? [r.seAusente.anular] : []),
        ]),
        ...(def.identidade ? [def.identidade.coluna] : []),
      ];
      for (const coluna of citadas) {
        expect(meta.colunas.has(coluna), `${def.nome}.${coluna}`).toBe(true);
      }
      for (const r of def.referencias) {
        expect(r.colunasDestino).toHaveLength(r.colunas.length);
        expect(r.tipos).toHaveLength(r.colunas.length);
      }
    });
  });

  it("toda consulta de origem monta (com e sem checkpoint) sem parâmetro solto", async () => {
    await cadaDefinicao((def) => {
      expect(def.consulta.chave.length, def.nome).toBeGreaterThan(0);
      const apos = def.consulta.chave.map(() => "x");
      for (const sql of [
        montarLoteDeOrigem(def.consulta, filtros, null, 10),
        montarLoteDeOrigem(def.consulta, filtros, apos, 10),
      ]) {
        expect(sql.texto, def.nome).not.toMatch(/@[a-z]/);
      }
    });
  });

  it("dependências antes: o pai de cada FK é migrado num passo anterior", () => {
    const ordem = passos.map((p) => p.destino);
    const antes = (pai: string, filho: string) => {
      expect(ordem.indexOf(pai), `${pai} antes de ${filho}`).toBeLessThan(ordem.indexOf(filho));
    };
    antes("empresas", "usuarios");
    antes("usuarios", "empresa_usuarios");
    antes("cargos", "empresa_usuarios");
    antes("departamentos", "empresa_usuarios");
    antes("unidades", "empresa_usuarios");
    antes("unidades", "equipes");
    antes("equipes", "ctes");
    antes("parceiros", "ctes");
    antes("codigos_ocorrencia", "ocorrencias");
    antes("ctes", "ocorrencias");
    antes("ctes", "cte_prazo_historico");
    antes("ingestao_arquivos", "ingestao_linhas");
    antes("xml_cte_arquivos", "xml_cte_itens");
    antes("ocorrencias", "ssw_webhook_eventos");
  });
});
