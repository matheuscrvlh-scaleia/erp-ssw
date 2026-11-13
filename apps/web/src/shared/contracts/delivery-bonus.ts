import { contrato } from "@erp/shared/contract";
import { diferencaEmDias, ehDataIso } from "@erp/shared/dates";
import { dataIsoComMensagem } from "@erp/shared/query";
import { z } from "@erp/shared/zod";

const dataIso = dataIsoComMensagem("Data deve estar no formato YYYY-MM-DD");

const DATA_FINAL_ANTES = "Data final deve ser maior ou igual à data inicial";

export const NIVEIS_DE_BONIFICACAO = ["turbo", "acelerado", "em_rota", "sem_bonus"] as const;

const linhaDeBonificacao = z.object({
  dataRomaneio: z.string(),
  unidade: z.string(),
  romaneio: z.string(),
  placa: z.string().nullable(),
  colaborador: z.string(),
  funcao: z.enum(["Motorista", "Ajudante"]),
  nfsCarregadas: z.number().int(),
  sac: z.number().int(),
  retornos: z.number().int(),
  pendentes: z.number().int(),
  nfsEntregues: z.number().int(),
  exito: z.number(),
  rotaPequena: z.boolean(),
  horaExtra: z.boolean().nullable(),
  semRegistroPonto: z.boolean(),
  nivel: z.enum(NIVEIS_DE_BONIFICACAO),
  bonus: z.number(),
  zeradoPorFalta: z.boolean(),
});

export const parametrosDeBonificacao = z.object({
  id: z.uuid(),
  vigenciaInicio: z.string(),
  vigenciaFim: z.string().nullable(),
  taxaTurbo: z.number(),
  taxaAcelerado: z.number(),
  taxaEmRotaGrande: z.number(),
  taxaEmRotaPequena: z.number(),
  metaRotaPequena: z.number(),
  metaRotaGrande: z.number(),
  metaEmRota: z.number(),
  limiteNfsRotaPequena: z.number().int(),
});

export type ParametrosDeBonificacao = z.infer<typeof parametrosDeBonificacao>;

export const TIPOS_DE_FALTA = ["falta_injustificada", "dois_dias_abaixo_minimo", "outro"] as const;

export const ROTULO_DO_TIPO_DE_FALTA: Record<(typeof TIPOS_DE_FALTA)[number], string> = {
  falta_injustificada: "Falta injustificada",
  dois_dias_abaixo_minimo: "Dois dias abaixo do mínimo",
  outro: "Outro",
};

export const falta = z.object({
  id: z.uuid(),
  colaboradorNome: z.string(),
  dataFalta: z.string(),
  tipo: z.enum(TIPOS_DE_FALTA),
  observacao: z.string().nullable(),
});

export type Falta = z.infer<typeof falta>;

export const contratosBonificacaoEntrega = {
  unidades: contrato({
    metodo: "GET",
    caminho: "/api/v1/bonificacao-entrega/unidades",
    saida: z.array(
      z.object({ unidade: z.string(), romaneios: z.number().int(), ultimoDia: z.string() }),
    ),
  }),
  parametros: contrato({
    metodo: "GET",
    caminho: "/api/v1/bonificacao-entrega/parametros",
    saida: z.array(parametrosDeBonificacao),
  }),
  apurar: contrato({
    metodo: "POST",
    caminho: "/api/v1/bonificacao-entrega/apuracao",
    entrada: z
      .object({
        inicio: dataIso,
        fim: dataIso,
        unidades: z.array(z.string().trim().min(1).max(10)).max(50).optional(),
        usarPonto: z.boolean().default(false),
      })
      .refine((v) => v.fim >= v.inicio, DATA_FINAL_ANTES)
      .refine(
        (v) => !ehDataIso(v.inicio) || !ehDataIso(v.fim) || diferencaEmDias(v.inicio, v.fim) <= 45,
        "Apure no máximo 45 dias por vez — períodos maiores estouram o tempo da consulta",
      ),
    saida: z.array(linhaDeBonificacao),
  }),
  faltas: contrato({
    metodo: "GET",
    caminho: "/api/v1/bonificacao-entrega/faltas",
    entrada: z
      .object({ inicio: dataIso, fim: dataIso })
      .refine((v) => v.fim >= v.inicio, DATA_FINAL_ANTES),
    saida: z.array(falta),
  }),
  registrarFalta: contrato({
    metodo: "POST",
    caminho: "/api/v1/bonificacao-entrega/faltas",
    entrada: z.object({
      colaboradorNome: z.string().trim().min(3, "Informe o nome do colaborador").max(120),
      dataFalta: dataIso,
      tipo: z.enum(TIPOS_DE_FALTA),
      observacao: z.string().trim().max(500).nullish(),
    }),
    saida: z.object({ id: z.uuid() }),
  }),
  excluirFalta: contrato({
    metodo: "DELETE",
    caminho: "/api/v1/bonificacao-entrega/faltas/:id",
    parametros: z.object({ id: z.uuid() }),
    saida: z.object({ ok: z.literal(true) }),
  }),
} as const;
