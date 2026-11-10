import { contrato } from "../contrato";
import { ehDataIso } from "../datas";
import { z } from "../zod";

export const STATUS_DE_COMPROVANTE = ["todos", "digitalizados", "pendentes"] as const;
export type StatusDeComprovante = (typeof STATUS_DE_COMPROVANTE)[number];

/** Tipo de documento da tabela "Por tipo de documento" para CT-e sem tipo. */
export const TIPO_NAO_INFORMADO = "NAO INFORMADO";

const dataIso = z.string().refine(ehDataIso, "Data inválida (use AAAA-MM-DD).");
const lista = <T extends z.ZodType>(item: T, maximo: number) =>
  z.array(item).max(maximo).default([]);
const sigla = z.string().trim().toUpperCase().max(10);

export const filtrosDeComprovantes = z.object({
  inicio: dataIso,
  fim: dataIso,
  /** Siglas (só por URL). */
  unidades: lista(sigla, 100),
  filiais: lista(sigla, 100),
  pagadores: lista(z.string().regex(/^\d{1,14}$/, "CNPJ só com dígitos."), 500),
  ctrc: z.string().max(60).default(""),
  nf: z.string().max(60).default(""),
  tipos: lista(z.string().max(80), 50),
  remetente: z.string().max(2000).default(""),
  destino: z.string().max(2000).default(""),
});
export type FiltrosDeComprovantes = z.infer<typeof filtrosDeComprovantes>;

const contagens = {
  entregues: z.number().int(),
  digitalizados: z.number().int(),
  pendentes: z.number().int(),
  /** Digitalizados ÷ entregues nos dias cobertos (0 a 1, 4 casas); nulo sem dia coberto. */
  pct: z.number().nullable(),
};

export const painelDeComprovantes = z.object({
  totais: z.object(contagens),
  porUnidade: z.array(z.object({ unidade: z.string(), ...contagens })),
  porDia: z.array(z.object({ dia: z.string(), coberto: z.boolean(), ...contagens })),
  porTipoDocumento: z.array(z.object({ tipoDocumento: z.string(), ...contagens })),
  /** Contagem por tipo com todos os filtros menos o de tipo (números do seletor). */
  tiposContagem: z.array(z.object({ tipo: z.string(), qtd: z.number().int() })),
});
export type PainelDeComprovantes = z.infer<typeof painelDeComprovantes>;

export const linhaDeComprovante = z.object({
  id: z.uuid(),
  numeroCtrc: z.string(),
  siglaCtrc: z.string(),
  numeroNf: z.number().int().nullable(),
  dataEntrega: z.string(),
  dataEmissao: z.string(),
  unidade: z.string().nullable(),
  setor: z.string().nullable(),
  pagadorNome: z.string().nullable(),
  remetente: z.string().nullable(),
  destinatario: z.string().nullable(),
  cidadeDestino: z.string().nullable(),
  tipoDocumento: z.string(),
  digitalizado: z.boolean(),
});
export type LinhaDeComprovante = z.infer<typeof linhaDeComprovante>;

const filtrosDaLista = filtrosDeComprovantes.extend({
  status: z.enum(STATUS_DE_COMPROVANTE).default("todos"),
});

export const contratosComprovantes = {
  painel: contrato({
    metodo: "POST",
    caminho: "/api/v1/comprovantes/painel",
    entrada: filtrosDeComprovantes,
    saida: painelDeComprovantes,
  }),
  lista: contrato({
    metodo: "POST",
    caminho: "/api/v1/comprovantes/lista",
    entrada: filtrosDaLista.extend({
      pagina: z.number().int().min(1).default(1),
      tamanho: z.number().int().min(1).max(500).default(50),
    }),
    saida: z.object({ linhas: z.array(linhaDeComprovante), total: z.number().int() }),
  }),
  /** A lista inteira de um card numa leitura só, na ordem da tela (até 200 mil linhas). */
  exportar: contrato({
    metodo: "POST",
    caminho: "/api/v1/comprovantes/lista/exportacao",
    entrada: filtrosDaLista,
    saida: z.object({ linhas: z.array(linhaDeComprovante) }),
  }),
} as const;
