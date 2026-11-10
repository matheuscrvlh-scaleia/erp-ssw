import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { z } from "@erp/shared/zod";

/** Quantas chaves de exemplo guardar por motivo (o resto só conta). */
export const EXEMPLOS_POR_MOTIVO = 1000;

const contagem = z.object({ quantidade: z.number().int(), exemplos: z.array(z.string()) });

const erroRegistrado = z.object({
  chave: z.string(),
  coluna: z.string(),
  valor: z.string(),
  motivo: z.string(),
});

const estadoDaTabela = z.object({
  status: z.enum(["em_andamento", "concluida", "falhou"]),
  ultimaChave: z.array(z.string()).nullable(),
  lidas: z.number().int(),
  migradas: z.number().int(),
  descartes: z.record(z.string(), contagem),
  ajustes: z.record(z.string(), contagem),
  erros: z.array(erroRegistrado),
});

const estadoDoMigrador = z.object({
  versao: z.literal(1),
  instante: z.string(),
  empresaId: z.string().nullable(),
  tabelas: z.record(z.string(), estadoDaTabela),
});

export type Contagem = z.infer<typeof contagem>;
export type ErroRegistrado = z.infer<typeof erroRegistrado>;
export type EstadoDaTabela = z.infer<typeof estadoDaTabela>;
export type EstadoDoMigrador = z.infer<typeof estadoDoMigrador>;

export function estadoInicialDaTabela(): EstadoDaTabela {
  return {
    status: "em_andamento",
    ultimaChave: null,
    lidas: 0,
    migradas: 0,
    descartes: {},
    ajustes: {},
    erros: [],
  };
}

export function contar(mapa: Record<string, Contagem>, motivo: string, chave: string): void {
  const atual = mapa[motivo] ?? { quantidade: 0, exemplos: [] };
  atual.quantidade += 1;
  if (atual.exemplos.length < EXEMPLOS_POR_MOTIVO) atual.exemplos.push(chave);
  mapa[motivo] = atual;
}

/** Onde o checkpoint mora. O arquivo é a implementação real; os testes usam memória. */
export interface ArmazemDeEstado {
  ler(): Promise<EstadoDoMigrador | null>;
  salvar(estado: EstadoDoMigrador): Promise<void>;
}

/**
 * Checkpoint em arquivo JSON, gravado de forma atômica (arquivo temporário + rename): uma
 * queda no meio da gravação não corrompe o estado. Salvo depois do commit de cada lote; se cair
 * entre o commit e o salvamento, o lote é relido e o upsert o regrava igual.
 */
export function armazemEmArquivo(caminho: string): ArmazemDeEstado {
  return {
    ler: async () => {
      let texto: string;
      try {
        texto = await readFile(caminho, "utf8");
      } catch (erro) {
        if (erro instanceof Error && "code" in erro && erro.code === "ENOENT") return null;
        throw erro;
      }
      const lido = estadoDoMigrador.safeParse(JSON.parse(texto));
      if (!lido.success) {
        throw new Error(`Checkpoint ${caminho} ilegível. Apague-o ou rode com --recomecar.`);
      }
      return lido.data;
    },
    salvar: async (estado) => {
      await mkdir(dirname(caminho), { recursive: true });
      const temporario = `${caminho}.tmp`;
      await writeFile(temporario, JSON.stringify(estado, null, 2), "utf8");
      await rename(temporario, caminho);
    },
  };
}

export function armazemEmMemoria(inicial: EstadoDoMigrador | null = null): ArmazemDeEstado & {
  atual: () => EstadoDoMigrador | null;
} {
  let estado = inicial === null ? null : structuredClone(inicial);
  return {
    ler: () => Promise.resolve(estado === null ? null : structuredClone(estado)),
    salvar: (novo) => {
      estado = structuredClone(novo);
      return Promise.resolve();
    },
    atual: () => estado,
  };
}
