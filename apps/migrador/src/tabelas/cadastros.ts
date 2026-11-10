/**
 * Cadastros de empresa: filiais, unidades, parceiros, prazos, catálogo de códigos e calendário
 * (de-para "Filiais, unidades, parceiros, prazos", "Calendário, metas", "Ocorrências e catálogo").
 */
import {
  anotacoes,
  codigosOcorrencia,
  feriados,
  filiais,
  filiaisApelidos,
  metas,
  parceiros,
  prazosConfigurados,
  processoSsw,
  responsavelOcorrencia,
  tipoAnotacao,
  tipoFeriado,
  tipoMeta,
  tipoSsw,
  unidades,
} from "@erp/db/schema";

import { definirTabela, descartar, migrar, semApoio } from "../motor/tipos";
import { maiusculaAparada } from "../transformacoes/cte";
import { daLista } from "../transformacoes/diversas";
import { codigoDeOcorrencia, decimal } from "../transformacoes/numeros";
import {
  daEmpresa,
  empresaNaChave,
  ESCOPO_DA_EMPRESA,
  ou,
  PELO_ID,
  referenciaEmpresa,
  referenciaPorId,
  referenciaUsuario,
} from "./comum";

interface OrigemFilial {
  sigla: string;
  tipo: string;
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  cidade: string | null;
  uf: string | null;
  atualizado_em: string | null;
  empresa_id: string;
  propria: boolean | null;
}

export const passoFiliais = definirTabela({
  nome: "filiais",
  origem: "public.filiais_ssw",
  tabela: filiais,
  consulta: {
    colunas: "o.*",
    de: "public.filiais_ssw o",
    onde: [daEmpresa("o.empresa_id")],
    chave: [
      { expressao: "o.empresa_id", tipo: "uuid" },
      { expressao: "o.sigla", tipo: "text" },
    ],
  },
  chaveDaLinha: (o: OrigemFilial) => `${o.empresa_id}:${o.sigla}`,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) => {
    const sigla = maiusculaAparada(o.sigla);
    if (sigla === null) return descartar("sigla vazia");
    return migrar({
      empresaId: o.empresa_id,
      sigla,
      tipo: o.tipo,
      nome: o.nome,
      razaoSocial: o.razao_social,
      cnpj: o.cnpj,
      cidade: o.cidade,
      uf: o.uf,
      propria: ou(o.propria, false),
      atualizadoEm: o.atualizado_em ?? filtros.instante,
    });
  },
  conflito: ["empresaId", "sigla"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(filiais, "empresaId")],
});

interface OrigemApelido {
  cidade_normalizada: string;
  filial: string;
  empresa_id: string | null;
}

export const passoFiliaisApelidos = definirTabela({
  nome: "filiais_apelidos",
  origem: "public.filial_alias",
  tabela: filiaisApelidos,
  consulta: {
    colunas: "o.*",
    de: "public.filial_alias o",
    onde: [daEmpresa("o.empresa_id")],
    chave: [empresaNaChave("o.empresa_id"), { expressao: "o.cidade_normalizada", tipo: "text" }],
  },
  chaveDaLinha: (o: OrigemApelido) => o.cidade_normalizada,
  preparar: semApoio,
  transformar: (o) =>
    o.empresa_id === null
      ? descartar("empresa_id nulo")
      : migrar({
          empresaId: o.empresa_id,
          cidadeNormalizada: o.cidade_normalizada,
          filial: o.filial,
        }),
  conflito: ["empresaId", "cidadeNormalizada"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(filiaisApelidos, "empresaId")],
});

interface OrigemUnidade {
  id: string;
  nome: string;
  cidade: string;
  uf: string;
  ativo: boolean | null;
  created_at: string | null;
  empresa_id: string | null;
}

export const passoUnidades = definirTabela({
  nome: "unidades",
  origem: "public.unidades",
  tabela: unidades,
  consulta: {
    colunas: "o.*",
    de: "public.unidades o",
    onde: [daEmpresa("o.empresa_id")],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemUnidade) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    o.empresa_id === null
      ? descartar("empresa_id nulo")
      : migrar({
          id: o.id,
          empresaId: o.empresa_id,
          nome: o.nome,
          cidade: o.cidade,
          uf: o.uf,
          ativo: ou(o.ativo, true),
          criadoEm: o.created_at ?? filtros.instante,
        }),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(unidades, "empresaId")],
});

interface OrigemParceiro {
  id: string;
  nome: string;
  cnpj: string | null;
  usa_ssw: boolean | null;
  prazo_acordo_horas: number | null;
  ativo: boolean | null;
  created_at: string | null;
  empresa_id: string | null;
}

export const passoParceiros = definirTabela({
  nome: "parceiros",
  origem: "public.parceiros",
  tabela: parceiros,
  consulta: {
    colunas: "o.*",
    de: "public.parceiros o",
    onde: [daEmpresa("o.empresa_id")],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemParceiro) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    o.empresa_id === null
      ? descartar("empresa_id nulo")
      : migrar({
          id: o.id,
          empresaId: o.empresa_id,
          nome: o.nome,
          cnpj: o.cnpj,
          usaSsw: ou(o.usa_ssw, false),
          prazoAcordoHoras: ou(o.prazo_acordo_horas, 48),
          ativo: ou(o.ativo, true),
          criadoEm: o.created_at ?? filtros.instante,
        }),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(parceiros, "empresaId")],
});

interface OrigemPrazo {
  id: string;
  tipo: string;
  unidade_codigo: string | null;
  unidade_destino_codigo: string | null;
  parceiro_cnpj: string | null;
  parceiro_nome: string | null;
  prazo_horas: number | null;
  prazo_dias: number | null;
  ativo: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  empresa_id: string | null;
}

const TIPOS_DE_PRAZO = ["unidade", "parceiro", "transbordo"] as const;

/** Mesma regra do check `prazos_configurados_campos_ck` do destino. */
export function prazoCompleto(o: OrigemPrazo): boolean {
  switch (o.tipo) {
    case "unidade":
      return o.unidade_codigo !== null && o.prazo_horas !== null;
    case "parceiro":
      return o.parceiro_cnpj !== null && o.prazo_dias !== null;
    case "transbordo":
      return (
        o.unidade_codigo !== null && o.unidade_destino_codigo !== null && o.prazo_dias !== null
      );
    default:
      return false;
  }
}

export const passoPrazosConfigurados = definirTabela({
  nome: "prazos_configurados",
  origem: "public.prazos_configurados",
  tabela: prazosConfigurados,
  consulta: {
    colunas: "o.*",
    de: "public.prazos_configurados o",
    onde: [daEmpresa("o.empresa_id")],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemPrazo) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) => {
    if (o.empresa_id === null) return descartar("empresa_id nulo");
    const tipo = daLista(o.tipo, TIPOS_DE_PRAZO, "tipo");
    if (!prazoCompleto(o)) return descartar("regra de prazo sem os campos do tipo");
    return migrar({
      id: o.id,
      empresaId: o.empresa_id,
      tipo,
      unidadeCodigo: o.unidade_codigo,
      unidadeDestinoCodigo: o.unidade_destino_codigo,
      parceiroCnpj: o.parceiro_cnpj,
      parceiroNome: o.parceiro_nome,
      prazoHoras: o.prazo_horas,
      prazoDias: o.prazo_dias,
      ativo: ou(o.ativo, true),
      criadoEm: o.created_at ?? filtros.instante,
      atualizadoEm: o.updated_at ?? o.created_at ?? filtros.instante,
    });
  },
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(prazosConfigurados, "empresaId")],
});

interface OrigemCodigo {
  codigo: number;
  descricao: string;
  responsavel: string;
  penaliza: boolean | null;
  updated_at: string | null;
  letra_responsavel: string | null;
  ativo: boolean | null;
  pendente_classificacao: boolean | null;
  notas: string | null;
  atualizado_por: string | null;
  tipo_ssw: string | null;
  processo_ssw: string | null;
  tipo_ssw_manual: boolean | null;
  pendencia_acompanhada: boolean | null;
  empresa_id: string;
}

export const passoCodigosOcorrencia = definirTabela({
  nome: "codigos_ocorrencia",
  origem: "public.codigos_ocorrencia",
  tabela: codigosOcorrencia,
  consulta: {
    colunas: `o.codigo, o.descricao, o.responsavel::text as responsavel, o.penaliza, o.updated_at,
      o.letra_responsavel, o.ativo, o.pendente_classificacao, o.notas, o.atualizado_por,
      o.tipo_ssw::text as tipo_ssw, o.processo_ssw::text as processo_ssw, o.tipo_ssw_manual,
      o.pendencia_acompanhada, o.empresa_id`,
    de: "public.codigos_ocorrencia o",
    onde: [daEmpresa("o.empresa_id")],
    chave: [
      { expressao: "o.empresa_id", tipo: "uuid" },
      { expressao: "o.codigo", tipo: "integer" },
    ],
  },
  chaveDaLinha: (o: OrigemCodigo) => `${o.empresa_id}:${String(o.codigo)}`,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    migrar({
      empresaId: o.empresa_id,
      codigo: codigoDeOcorrencia(o.codigo, "codigo"),
      descricao: o.descricao,
      tipoSsw: o.tipo_ssw === null ? null : daLista(o.tipo_ssw, tipoSsw.enumValues, "tipo_ssw"),
      processoSsw:
        o.processo_ssw === null
          ? null
          : daLista(o.processo_ssw, processoSsw.enumValues, "processo_ssw"),
      tipoSswManual: ou(o.tipo_ssw_manual, false),
      responsavel: daLista(o.responsavel, responsavelOcorrencia.enumValues, "responsavel"),
      letraResponsavel: o.letra_responsavel,
      penaliza: ou(o.penaliza, false),
      ativo: ou(o.ativo, true),
      pendenteClassificacao: ou(o.pendente_classificacao, false),
      pendenciaAcompanhada: ou(o.pendencia_acompanhada, false),
      notas: o.notas,
      atualizadoPor: o.atualizado_por,
      atualizadoEm: o.updated_at ?? filtros.instante,
    }),
  conflito: ["empresaId", "codigo"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    referenciaEmpresa(codigosOcorrencia, "empresaId"),
    referenciaUsuario(codigosOcorrencia, "atualizadoPor"),
  ],
});

interface OrigemFeriado {
  id: string;
  data: string;
  tipo: string;
  cidade: string | null;
  uf: string | null;
  descricao: string;
  gerado_automaticamente: boolean | null;
  empresa_id: string | null;
}

/** `empresa_id` nulo = feriado nacional: migra nulo (única exceção da regra geral). */
export const passoFeriados = definirTabela({
  nome: "feriados",
  origem: "public.feriados",
  tabela: feriados,
  consulta: {
    colunas:
      "o.id, o.data, o.tipo::text as tipo, o.cidade, o.uf, o.descricao, o.gerado_automaticamente, o.empresa_id",
    de: "public.feriados o",
    onde: ["(@empresa is null or o.empresa_id = @empresa or o.empresa_id is null)"],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemFeriado) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    migrar({
      id: o.id,
      empresaId: o.empresa_id,
      data: o.data,
      tipo: daLista(o.tipo, tipoFeriado.enumValues, "tipo"),
      cidade: o.cidade,
      uf: o.uf,
      descricao: o.descricao,
      geradoAutomaticamente: ou(o.gerado_automaticamente, false),
      // A origem não tem carimbo de tempo: instante da migração.
      criadoEm: filtros.instante,
      atualizadoEm: filtros.instante,
    }),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: "(@empresa is null or empresa_id = @empresa or empresa_id is null)",
  referencias: [
    referenciaPorId(feriados, "empresaId", "erp.empresas", { descartar: "empresa não migrou" }),
  ],
});

interface OrigemAnotacao {
  id: string;
  data: string;
  unidade_id: string | null;
  tipo: string;
  texto: string;
  autor: string | null;
  criado_em: string | null;
  empresa_id: string | null;
}

export const passoAnotacoes = definirTabela({
  nome: "anotacoes",
  origem: "public.anotacoes",
  tabela: anotacoes,
  consulta: {
    colunas:
      "o.id, o.data, o.unidade_id, o.tipo::text as tipo, o.texto, o.autor, o.criado_em, o.empresa_id",
    de: "public.anotacoes o",
    onde: [daEmpresa("o.empresa_id")],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemAnotacao) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    o.empresa_id === null
      ? descartar("empresa_id nulo")
      : migrar({
          id: o.id,
          empresaId: o.empresa_id,
          data: o.data,
          unidadeId: o.unidade_id,
          tipo: daLista(o.tipo, tipoAnotacao.enumValues, "tipo"),
          texto: o.texto,
          autorId: o.autor,
          criadoEm: o.criado_em ?? filtros.instante,
          // Sem `updated_at` na origem: o melhor instante da linha é a criação.
          atualizadoEm: o.criado_em ?? filtros.instante,
        }),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    referenciaEmpresa(anotacoes, "empresaId"),
    referenciaPorId(anotacoes, "unidadeId", "erp.unidades", {
      anular: "unidadeId",
      motivo: "unidade não migrou (vira nula)",
    }),
    referenciaUsuario(anotacoes, "autorId"),
  ],
});

interface OrigemMeta {
  id: string;
  unidade_id: string | null;
  tipo_meta: string;
  valor: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  empresa_id: string | null;
}

export const passoMetas = definirTabela({
  nome: "metas",
  origem: "public.metas",
  tabela: metas,
  consulta: {
    colunas:
      "o.id, o.unidade_id, o.tipo_meta::text as tipo_meta, o.valor, o.vigencia_inicio, o.vigencia_fim, o.empresa_id",
    de: "public.metas o",
    onde: [daEmpresa("o.empresa_id")],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemMeta) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    o.empresa_id === null
      ? descartar("empresa_id nulo")
      : migrar({
          id: o.id,
          empresaId: o.empresa_id,
          unidadeId: o.unidade_id,
          tipoMeta: daLista(o.tipo_meta, tipoMeta.enumValues, "tipo_meta"),
          valor: decimal(o.valor, "valor", 8, 4) ?? o.valor,
          vigenciaInicio: o.vigencia_inicio,
          vigenciaFim: o.vigencia_fim,
          criadoEm: filtros.instante,
          atualizadoEm: filtros.instante,
        }),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    referenciaEmpresa(metas, "empresaId"),
    // Meta de unidade que não existe mais não vira meta "da empresa toda".
    referenciaPorId(metas, "unidadeId", "erp.unidades", { descartar: "unidade não migrou" }),
  ],
});
