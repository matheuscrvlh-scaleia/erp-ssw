import { dataIso } from "@erp/shared/consulta";
import { contrato } from "@erp/shared/contrato";
import { z } from "@erp/shared/zod";

import { contratosCalendario, feriado, UFS } from "./calendario";

export const TIPOS_ANOTACAO = ["clima", "operacional", "feriado", "outro"] as const;
export type TipoAnotacao = (typeof TIPOS_ANOTACAO)[number];

/** Rótulos da tela ("feriado" aparece como "Externo"). */
export const ROTULO_DO_TIPO_DE_ANOTACAO: Record<TipoAnotacao, string> = {
  clima: "Clima",
  operacional: "Operacional",
  feriado: "Externo",
  outro: "Outro",
};

/** Teto de registros por consulta; acima disso a tela avisa que a lista foi cortada (Q04). */
export const LIMITE_DO_HISTORICO = 5000;

/** Lista de UUIDs na query string, separados por vírgula ("" = nenhum). */
const uuidsNaQuery = z
  .string()
  .max(4000)
  .default("")
  .transform((texto) => texto.split(",").filter((item) => item !== ""))
  .pipe(z.array(z.uuid()).max(100));

export const anotacao = z.object({
  id: z.uuid(),
  data: z.string(),
  tipo: z.enum(TIPOS_ANOTACAO),
  texto: z.string(),
  autorId: z.uuid().nullable(),
  autorNome: z.string().nullable(),
  unidadeId: z.uuid().nullable(),
  unidadeNome: z.string().nullable(),
  criadoEm: z.string(),
});
export type Anotacao = z.infer<typeof anotacao>;

export const dadosDaAnotacao = z.object({
  data: dataIso,
  tipo: z.enum(TIPOS_ANOTACAO),
  texto: z.string().trim().min(1, "Escreva o que aconteceu").max(2000),
  unidadeId: z.uuid().nullable().default(null),
});
export type DadosDaAnotacao = z.infer<typeof dadosDaAnotacao>;

const parametrosId = z.object({ id: z.uuid() });
const ok = z.object({ ok: z.literal(true) });

export const feriadoDoHistorico = feriado.extend({
  /** Nacional sem empresa vale para todas: só a Plataforma altera. */
  global: z.boolean(),
});
export type FeriadoDoHistorico = z.infer<typeof feriadoDoHistorico>;

export const contratosHistorico = {
  obter: contrato({
    metodo: "GET",
    caminho: "/api/v1/historico",
    entrada: z.object({ inicio: dataIso, fim: dataIso, unidades: uuidsNaQuery }),
    saida: z.object({
      anotacoes: z.array(anotacao),
      feriados: z.array(feriado),
      unidades: z.array(z.object({ id: z.uuid(), nome: z.string() })),
      autores: z.array(z.object({ id: z.uuid(), nome: z.string() })),
      totais: z.object({
        anotacoes: z.number().int(),
        feriados: z.number().int(),
        diasComContexto: z.number().int(),
      }),
      /** Mais de `LIMITE_DO_HISTORICO` anotações ou feriados: a lista veio cortada. */
      truncado: z.boolean(),
    }),
  }),
  criarAnotacao: contrato({
    metodo: "POST",
    caminho: "/api/v1/historico/anotacoes",
    entrada: dadosDaAnotacao,
    saida: z.object({ id: z.uuid() }),
  }),
  alterarAnotacao: contrato({
    metodo: "PUT",
    caminho: "/api/v1/historico/anotacoes/:id",
    parametros: parametrosId,
    entrada: dadosDaAnotacao,
    saida: ok,
  }),
  excluirAnotacao: contrato({
    metodo: "DELETE",
    caminho: "/api/v1/historico/anotacoes/:id",
    parametros: parametrosId,
    saida: ok,
  }),
  listarFeriados: contrato({
    metodo: "GET",
    caminho: "/api/v1/historico/feriados",
    entrada: z.object({
      ano: z.coerce.number().int().min(2000).max(2100).optional(),
      tipo: z.enum(["nacional", "municipal"]).optional(),
      uf: z.enum(UFS).optional(),
    }),
    saida: z.object({ feriados: z.array(feriadoDoHistorico), truncado: z.boolean() }),
  }),
  /** Escritas de feriado: as mesmas regras do Calendário, pela permissão desta tela. */
  criarFeriado: contrato({
    metodo: "POST",
    caminho: "/api/v1/historico/feriados",
    entrada: contratosCalendario.alterarFeriado.entrada,
    saida: z.object({ inseridos: z.number().int() }),
  }),
  alterarFeriado: contrato({
    metodo: "PUT",
    caminho: "/api/v1/historico/feriados/:id",
    parametros: parametrosId,
    entrada: contratosCalendario.alterarFeriado.entrada,
    saida: ok,
  }),
  excluirFeriado: contrato({
    metodo: "DELETE",
    caminho: "/api/v1/historico/feriados/:id",
    parametros: parametrosId,
    saida: ok,
  }),
  importarNacionais: contrato({
    metodo: "POST",
    caminho: "/api/v1/historico/feriados-nacionais",
    entrada: z.object({ ano: z.number().int().min(2000).max(2100) }),
    saida: z.object({ inseridos: z.number().int() }),
  }),
} as const;
