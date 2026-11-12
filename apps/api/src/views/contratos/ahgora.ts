import { dataIsoComMensagem } from "@erp/shared/consulta";
import { contrato } from "@erp/shared/contrato";
import { diferencaEmDias, ehDataIso } from "@erp/shared/datas";
import { z } from "@erp/shared/zod";

const dataIso = dataIsoComMensagem("Data deve estar no formato YYYY-MM-DD");

const DATA_FINAL_ANTES = "Data final deve ser maior ou igual à data inicial";

const ateDias = (dias: number) => (de: string, ate: string) =>
  !ehDataIso(de) || !ehDataIso(ate) || diferencaEmDias(de, ate) <= dias;

export const funcionarioAhgora = z.object({
  id: z.string(),
  register: z.string(),
  name: z.string(),
  cpf: z.string().optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  terminationDate: z.string().optional(),
});

export type FuncionarioAhgora = z.infer<typeof funcionarioAhgora>;

export const batidaAhgora = z.object({
  punchTime: z.string(),
  type: z.string(),
  deviceName: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  reason: z.string().optional(),
});

export const MOTIVOS_DE_REVISAO = ["impar", "excluida"] as const;

export const diaApurado = z.object({
  data: z.string(),
  batidas: z.array(z.object({ hora: z.string(), tipo: z.string() })),
  minutosTrabalhados: z.number().int().nullable(),
  motivoRevisao: z.enum(MOTIVOS_DE_REVISAO).nullable(),
});

export const funcionarioApurado = z.object({
  register: z.string(),
  name: z.string(),
  department: z.string(),
  demitido: z.boolean(),
  diasComRegistro: z.number().int(),
  minutosApurados: z.number().int(),
  diasARevisar: z.number().int(),
  dias: z.array(diaApurado),
});

export type FuncionarioApurado = z.infer<typeof funcionarioApurado>;

/** Ponto (Ahgora): só a equipe da Plataforma, sempre na empresa ativa. */
export const contratosAhgora = {
  funcionarios: contrato({
    metodo: "GET",
    caminho: "/api/v1/ahgora/funcionarios",
    saida: z.array(funcionarioAhgora),
  }),
  departamentos: contrato({
    metodo: "GET",
    caminho: "/api/v1/ahgora/departamentos",
    saida: z.array(z.string()),
  }),
  batidas: contrato({
    metodo: "GET",
    caminho: "/api/v1/ahgora/batidas",
    entrada: z
      .object({
        funcionarioId: z.string().max(64).optional(),
        matricula: z.string().max(64).optional(),
        pis: z.string().max(64).optional(),
        inicio: dataIso,
        fim: dataIso,
      })
      .refine(
        (v) => v.funcionarioId || v.matricula || v.pis,
        "Informe o funcionário (id, matrícula ou PIS)",
      )
      .refine((v) => v.fim >= v.inicio, DATA_FINAL_ANTES)
      .refine((v) => ateDias(30)(v.inicio, v.fim), "O período máximo por consulta é de 30 dias"),
    saida: z.object({ data: z.array(batidaAhgora), total: z.number().int() }),
  }),
  apuracao: contrato({
    metodo: "GET",
    caminho: "/api/v1/ahgora/apuracao",
    entrada: z
      .object({
        inicio: dataIso,
        fim: dataIso,
        departamento: z.string().max(200).optional(),
        incluirDemitidos: z
          .enum(["true", "false"])
          .default("false")
          .transform((v) => v === "true"),
      })
      .refine((v) => v.fim >= v.inicio, DATA_FINAL_ANTES)
      .refine((v) => ateDias(30)(v.inicio, v.fim), "O período máximo por apuração é de um mês"),
    saida: z.object({
      inicio: z.string(),
      fim: z.string(),
      funcionarios: z.array(funcionarioApurado),
    }),
  }),
} as const;
