// TODO(performance): contrato da série SLA (`sla_serie`, spec 02 §1.11) criado pelo Ranking para
// consumir o endpoint do agente de Performance. Ao juntar, fica só a versão dele.
import { contrato } from "../contrato";
import { ehDataIso } from "../datas";
import { z } from "../zod";

const dataIso = z.string().refine(ehDataIso, "Data inválida (use AAAA-MM-DD).");

/** Lista na query string: `?x=a&x=b` chega como array, `?x=a` como texto. */
const listaDaQuery = z.preprocess(
  (v) => (typeof v === "string" ? [v] : v),
  z.array(z.string().max(60)).max(500).optional(),
);

export const pontoDaSerie = z.object({
  periodo: z.string(),
  totalCtrcs: z.number().int(),
  entregue: z.number().int(),
  foraTransp: z.number().int(),
  noPrazoOp: z.number().int(),
  foraPrazoOp: z.number().int(),
  noPrazoCli: z.number().int(),
  foraPrazoCli: z.number().int(),
});

export type PontoDaSerie = z.infer<typeof pontoDaSerie>;

export const contratoSlaSerie = contrato({
  metodo: "GET",
  caminho: "/api/v1/performance/sla-serie",
  entrada: z.object({
    granularidade: z.enum(["dia", "mes"]),
    inicio: dataIso,
    fim: dataIso,
    base_data: z.enum(["emissao", "prevista", "concluido"]).default("emissao"),
    filiais: listaDaQuery,
    parceiros: listaDaQuery,
    tipos: listaDaQuery,
    destino: z.string().max(500).optional(),
    remetente: z.string().max(500).optional(),
  }),
  saida: z.array(pontoDaSerie),
});
