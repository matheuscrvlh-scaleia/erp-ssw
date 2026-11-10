import { contrato } from "../contrato";
import { ehDataIso } from "../datas";
import { z } from "../zod";

export const TIPOS_FERIADO = ["nacional", "estadual", "municipal"] as const;
export type TipoFeriado = (typeof TIPOS_FERIADO)[number];

export const UFS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
] as const;

const dataIso = z.string().refine(ehDataIso, "Data inválida (use AAAA-MM-DD).");
const ano = z.coerce.number().int().min(2000).max(2100);

export const feriado = z.object({
  id: z.uuid(),
  data: z.string(),
  tipo: z.enum(TIPOS_FERIADO),
  cidade: z.string().nullable(),
  uf: z.string().nullable(),
  descricao: z.string(),
  geradoAutomaticamente: z.boolean(),
});

export type Feriado = z.infer<typeof feriado>;

export const unidadeDoCalendario = z.object({
  id: z.uuid(),
  nome: z.string(),
  cidade: z.string().nullable(),
  uf: z.string().nullable(),
});

export type UnidadeDoCalendario = z.infer<typeof unidadeDoCalendario>;

const dadosDoFeriado = z.object({
  data: dataIso,
  tipo: z.enum(TIPOS_FERIADO),
  cidade: z.string().trim().max(120).nullable().optional(),
  uf: z.enum(UFS).nullable().optional(),
  descricao: z.string().trim().min(3).max(200),
});

export type DadosDoFeriado = z.infer<typeof dadosDoFeriado>;

const resultadoGravacao = z.object({
  inseridos: z.number().int(),
  atualizados: z.number().int(),
});

const parametrosId = z.object({ id: z.uuid() });

export const contratosCalendario = {
  obter: contrato({
    metodo: "GET",
    caminho: "/api/v1/calendario",
    entrada: z.object({ ano }),
    saida: z.object({
      ano: z.number().int(),
      feriados: z.array(feriado),
      unidades: z.array(unidadeDoCalendario),
      contagens: z.object({
        nacional: z.number().int(),
        estadual: z.number().int(),
        municipal: z.number().int(),
      }),
      proximo: feriado.nullable(),
    }),
  }),
  criarFeriado: contrato({
    metodo: "POST",
    caminho: "/api/v1/calendario/feriados",
    entrada: dadosDoFeriado.extend({
      recorrente: z.boolean().default(false),
      anosAFrente: z.number().int().min(0).max(10).default(5),
    }),
    saida: resultadoGravacao,
  }),
  alterarFeriado: contrato({
    metodo: "PUT",
    caminho: "/api/v1/calendario/feriados/:id",
    parametros: parametrosId,
    entrada: dadosDoFeriado,
    saida: resultadoGravacao,
  }),
  excluirFeriado: contrato({
    metodo: "DELETE",
    caminho: "/api/v1/calendario/feriados/:id",
    parametros: parametrosId,
    saida: z.object({ ok: z.literal(true) }),
  }),
  gerarNacionais: contrato({
    metodo: "POST",
    caminho: "/api/v1/calendario/feriados-nacionais",
    entrada: z.object({ ano, anosAFrente: z.number().int().min(0).max(10).default(4) }),
    saida: z.object({
      inseridos: z.number().int(),
      existiam: z.number().int(),
      anos: z.array(z.number().int()),
    }),
  }),
} as const;
