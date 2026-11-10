import { contrato } from "../contrato";
import { ehDataIso } from "../datas";
import { z } from "../zod";
import { contagemTipo } from "./performance";

/**
 * Opções dos filtros de CT-e compartilhados pelas telas (Performance, Listagem e outras):
 * unidade responsável, sugestões de remetente/destino, pagadores e tipos de documento.
 * Só exigem sessão com empresa.
 */

const dataIso = z.string().refine(ehDataIso, "Data inválida (use AAAA-MM-DD).");
const lista = z.array(z.string().max(200)).max(500);

export const CAMPOS_DE_SUGESTAO = ["remetente", "cidade_destino"] as const;
export type CampoDeSugestao = (typeof CAMPOS_DE_SUGESTAO)[number];

export const pagadorOpcao = z.object({
  /** CNPJ só com dígitos: é o valor do filtro `parceiros`. */
  cnpj: z.string(),
  cnpjFormatado: z.string(),
  nome: z.string(),
  qtd: z.number().int(),
});
export type PagadorOpcao = z.infer<typeof pagadorOpcao>;

export const contratosFiltrosCtrc = {
  unidadesResponsaveis: contrato({
    metodo: "POST",
    caminho: "/api/v1/filtros-ctrc/unidades-responsaveis",
    entrada: z.object({
      inicio: dataIso,
      fim: dataIso,
      parceiros: lista.nullish(),
      remetente: z.string().max(500).nullish(),
      destino: z.string().max(500).nullish(),
      codigos: lista.nullish(),
    }),
    saida: z.object({
      /** Siglas próprias com CT-e no período (a tela acrescenta as já marcadas). */
      siglas: z.array(z.string()),
      codigos: z.array(z.object({ codigo: z.number().int(), descricao: z.string() })),
    }),
  }),
  sugestoesTexto: contrato({
    metodo: "POST",
    caminho: "/api/v1/filtros-ctrc/sugestoes",
    entrada: z.object({
      campo: z.enum(CAMPOS_DE_SUGESTAO),
      q: z.string().max(200).default(""),
      inicio: dataIso.nullish(),
      fim: dataIso.nullish(),
      parceiros: lista.nullish(),
      remetente: z.string().max(500).nullish(),
      destino: z.string().max(500).nullish(),
      filiais: lista.nullish(),
      codigos: lista.nullish(),
    }),
    saida: z.array(z.string()),
  }),
  pagadores: contrato({
    metodo: "POST",
    caminho: "/api/v1/filtros-ctrc/pagadores",
    entrada: z.object({
      inicio: dataIso.nullish(),
      fim: dataIso.nullish(),
      unidades: lista.nullish(),
      filiais: lista.nullish(),
      limite: z.number().int().min(1).max(2000).default(500),
    }),
    saida: z.array(pagadorOpcao),
  }),
  tiposDocumento: contrato({
    metodo: "GET",
    caminho: "/api/v1/filtros-ctrc/tipos-documento",
    saida: z.array(contagemTipo),
  }),
} as const;
