import { dataIso, inteiro, lista, textoDeFiltro } from "../consulta";
import { contrato } from "../contrato";
import { z } from "../zod";

/** Valor do filtro "Tipo documento" que representa o CT-e sem tipo. */
export const SEM_TIPO_DOCUMENTO = "__SEM_TIPO__";

/** Base de data do seletor de pagadores (o Romaneio usa "saida"). */
export const CAMPOS_DATA_PAGADOR = [
  "emissao",
  "embarque",
  "prevista",
  "saida",
  "conclusao",
] as const;

/** Base de data das telas para o seletor de tipo de documento. */
export const CAMPOS_DATA_TIPO_DOCUMENTO = [
  "emissao",
  "embarque",
  "prevista",
  "conclusao",
  "saida",
  "entrega",
  "romaneio_dia",
] as const;
export type CampoDataTipoDocumento = (typeof CAMPOS_DATA_TIPO_DOCUMENTO)[number];

export const CAMPOS_SUGESTAO = ["remetente", "cidade_destino"] as const;

/** Filtros já escolhidos na tela, que estreitam as opções dos outros seletores. */
const contextoDosFiltros = z.object({
  inicio: dataIso.optional(),
  fim: dataIso.optional(),
  parceiros: lista(z.string().trim().max(20)).optional(),
  remetente: textoDeFiltro.optional(),
  destino: textoDeFiltro.optional(),
  filiais: lista(z.string().trim().max(20)).optional(),
  codigos: lista(inteiro).optional(),
});

export const codigoDoCatalogo = z.object({
  codigo: z.number().int(),
  descricao: z.string(),
  penaliza: z.boolean(),
});

export const pagadorOpcao = z.object({
  /** CNPJ só com dígitos: é o valor do filtro `parceiros`. */
  id: z.string(),
  nome: z.string(),
  cnpjFormatado: z.string(),
});
export type PagadorOpcao = z.infer<typeof pagadorOpcao>;

export const tipoDocumentoOpcao = z.object({ tipo: z.string(), qtd: z.number().int() });
export type TipoDocumentoOpcao = z.infer<typeof tipoDocumentoOpcao>;

/** Filtros compartilhados pelas telas de CT-e (Performance, Lista, Romaneio, Ocorrências...). */
export const contratosFiltros = {
  /** Siglas das filiais próprias da empresa ativa (o universo das telas). */
  filiaisProprias: contrato({
    metodo: "GET",
    caminho: "/api/v1/filtros/filiais-proprias",
    saida: z.array(z.string()),
  }),
  /** Opções de "Unidade responsável" (siglas próprias com CT-e no período) e o catálogo. */
  opcoes: contrato({
    metodo: "GET",
    caminho: "/api/v1/filtros/opcoes",
    entrada: contextoDosFiltros,
    saida: z.object({ filiais: z.array(z.string()), codigos: z.array(codigoDoCatalogo) }),
  }),
  /** Só o catálogo de códigos (seletor "Código"). */
  codigos: contrato({
    metodo: "GET",
    caminho: "/api/v1/filtros/codigos",
    saida: z.array(codigoDoCatalogo),
  }),
  sugestoes: contrato({
    metodo: "GET",
    caminho: "/api/v1/filtros/sugestoes",
    entrada: contextoDosFiltros.extend({
      campo: z.enum(CAMPOS_SUGESTAO),
      q: z.string().max(120).default(""),
    }),
    saida: z.array(z.string()),
  }),
  pagadores: contrato({
    metodo: "GET",
    caminho: "/api/v1/filtros/pagadores",
    entrada: z.object({
      inicio: dataIso.optional(),
      fim: dataIso.optional(),
      /** Sigla ou id de `unidades`. */
      unidades: lista(z.string().trim().max(60)).optional(),
      filiais: lista(z.string().trim().max(20)).optional(),
      campoData: z.enum(CAMPOS_DATA_PAGADOR).default("emissao"),
    }),
    saida: z.array(pagadorOpcao),
  }),
  /** Tipos de documento da base inteira, do mais comum ao mais raro. */
  tiposDocumento: contrato({
    metodo: "GET",
    caminho: "/api/v1/filtros/tipos-documento",
    saida: z.array(tipoDocumentoOpcao),
  }),
  /** Quantos CT-e de cada tipo há no período (nulo = não deu para contar; mostre todos). */
  tiposDocumentoNoPeriodo: contrato({
    metodo: "GET",
    caminho: "/api/v1/filtros/tipos-documento-periodo",
    entrada: z.object({
      inicio: dataIso,
      fim: dataIso,
      campoData: z.enum(CAMPOS_DATA_TIPO_DOCUMENTO),
    }),
    saida: z.array(tipoDocumentoOpcao).nullable(),
  }),
} as const;
