/** Equipes, membros e bonificação (de-para "Equipes, bonificação"). */
import {
  bonificacaoCodigos,
  bonificacaoEfeito,
  bonificacaoFaltas,
  bonificacaoParametros,
  bonificacaoRegraCriterios,
  bonificacaoRegras,
  criteriosDeBonificacao,
  equipeMembros,
  equipes,
  tiposDeFalta,
} from "@erp/db/schema";

import { definirTabela, descartar, migrar, semApoio } from "../motor/tipos";
import { daLista, hashDoTokenPublico } from "../transformacoes/diversas";
import { codigoDeOcorrencia, decimal } from "../transformacoes/numeros";
import {
  daEmpresa,
  ESCOPO_DA_EMPRESA,
  ou,
  PELO_ID,
  referenciaEmpresa,
  referenciaPorId,
  referenciaUsuario,
} from "./comum";

interface OrigemEquipe {
  id: string;
  nome: string;
  unidade_id: string | null;
  ativo: boolean | null;
  share_token: string | null;
  share_token_revogado: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  empresa_id: string | null;
}

export const passoEquipes = definirTabela({
  nome: "equipes",
  origem: "public.equipes_entrega",
  tabela: equipes,
  consulta: {
    colunas: "o.*",
    de: "public.equipes_entrega o",
    onde: [daEmpresa("o.empresa_id")],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemEquipe) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    o.empresa_id === null
      ? descartar("empresa_id nulo")
      : migrar({
          id: o.id,
          empresaId: o.empresa_id,
          nome: o.nome,
          unidadeId: o.unidade_id,
          ativo: ou(o.ativo, true),
          // Só o SHA-256 do token fica no banco; o link público continua o mesmo.
          tokenPublicoHash: hashDoTokenPublico(o.share_token),
          tokenPublicoRevogado: ou(o.share_token_revogado, false),
          criadoEm: o.created_at ?? filtros.instante,
          atualizadoEm: o.updated_at ?? o.created_at ?? filtros.instante,
        }),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    referenciaEmpresa(equipes, "empresaId"),
    referenciaPorId(equipes, "unidadeId", "erp.unidades", {
      anular: "unidadeId",
      motivo: "unidade não migrou (vira nula)",
    }),
  ],
});

interface OrigemMembro {
  id: string;
  equipe_id: string;
  usuario_id: string | null;
  nome: string;
  papel: string;
  cpf: string | null;
  data_saida: string | null;
  created_at: string | null;
  posicao: number | null;
  empresa_id: string | null;
}

const PAPEIS_DE_MEMBRO = ["motorista", "ajudante"] as const;

/** Check `equipe_membros_posicao_ck`: ajudante na posição 1–3; motorista sem posição (ou 0). */
export function posicaoValida(papel: string, posicao: number | null): boolean {
  if (papel === "ajudante") return posicao !== null && posicao >= 1 && posicao <= 3;
  return posicao === null || posicao === 0;
}

export const passoEquipeMembros = definirTabela({
  nome: "equipe_membros",
  origem: "public.membros_equipe",
  tabela: equipeMembros,
  consulta: {
    colunas:
      "o.id, o.equipe_id, o.usuario_id, o.nome, o.papel, o.cpf, o.data_saida, o.created_at, o.posicao, o.empresa_id",
    de: "public.membros_equipe o",
    onde: [daEmpresa("o.empresa_id")],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemMembro) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) => {
    if (o.empresa_id === null) return descartar("empresa_id nulo");
    const papel = daLista(o.papel, PAPEIS_DE_MEMBRO, "papel");
    if (!posicaoValida(papel, o.posicao)) return descartar("posição incoerente com o papel");
    return migrar({
      id: o.id,
      empresaId: o.empresa_id,
      equipeId: o.equipe_id,
      usuarioId: o.usuario_id,
      nome: o.nome,
      papel,
      cpf: o.cpf,
      posicao: o.posicao,
      dataSaida: o.data_saida,
      criadoEm: o.created_at ?? filtros.instante,
    });
  },
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    referenciaEmpresa(equipeMembros, "empresaId"),
    referenciaPorId(equipeMembros, "equipeId", "erp.equipes", { descartar: "equipe não migrou" }),
    referenciaUsuario(equipeMembros, "usuarioId"),
  ],
});

interface OrigemRegra {
  id: string;
  nome: string;
  descricao: string | null;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  ativo: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  empresa_id: string | null;
}

export const passoBonificacaoRegras = definirTabela({
  nome: "bonificacao_regras",
  origem: "public.regras_bonificacao",
  tabela: bonificacaoRegras,
  consulta: {
    colunas:
      "o.id, o.nome, o.descricao, o.vigencia_inicio, o.vigencia_fim, o.ativo, o.created_at, o.updated_at, o.empresa_id",
    de: "public.regras_bonificacao o",
    onde: [daEmpresa("o.empresa_id")],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemRegra) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    o.empresa_id === null
      ? descartar("empresa_id nulo")
      : migrar({
          id: o.id,
          empresaId: o.empresa_id,
          nome: o.nome,
          descricao: o.descricao,
          vigenciaInicio: o.vigencia_inicio,
          vigenciaFim: o.vigencia_fim,
          ativo: ou(o.ativo, true),
          criadoEm: o.created_at ?? filtros.instante,
          atualizadoEm: o.updated_at ?? o.created_at ?? filtros.instante,
        }),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(bonificacaoRegras, "empresaId")],
});

interface OrigemCriterio {
  id: string;
  regra_id: string;
  criterio: string;
  parametros: string | null;
  ordem: number | null;
  created_at: string | null;
  empresa_id: string | null;
}

export const passoBonificacaoRegraCriterios = definirTabela({
  nome: "bonificacao_regra_criterios",
  origem: "public.regra_criterios",
  tabela: bonificacaoRegraCriterios,
  consulta: {
    colunas: "o.*",
    de: "public.regra_criterios o",
    onde: [daEmpresa("o.empresa_id")],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemCriterio) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    o.empresa_id === null
      ? descartar("empresa_id nulo")
      : migrar({
          id: o.id,
          empresaId: o.empresa_id,
          regraId: o.regra_id,
          criterio: daLista(o.criterio, criteriosDeBonificacao, "criterio"),
          parametros: o.parametros ?? "{}",
          ordem: ou(o.ordem, 0),
          criadoEm: o.created_at ?? filtros.instante,
        }),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    referenciaEmpresa(bonificacaoRegraCriterios, "empresaId"),
    referenciaPorId(bonificacaoRegraCriterios, "regraId", "erp.bonificacao_regras", {
      descartar: "regra não migrou",
    }),
  ],
});

interface OrigemParametros {
  id: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  taxa_turbo: string;
  taxa_acelerado: string;
  taxa_em_rota_grande: string;
  taxa_em_rota_pequena: string;
  meta_rota_pequena: string;
  meta_rota_grande: string;
  meta_em_rota: string;
  limite_nfs_rota_pequena: number | null;
  criado_em: string | null;
  criado_por: string | null;
  empresa_id: string | null;
}

const taxa = (valor: string, coluna: string) => decimal(valor, coluna, 10, 4) ?? valor;
const fracao = (valor: string, coluna: string) => decimal(valor, coluna, 5, 4) ?? valor;

export const passoBonificacaoParametros = definirTabela({
  nome: "bonificacao_parametros",
  origem: "public.bonificacao_parametros",
  tabela: bonificacaoParametros,
  consulta: {
    colunas: "o.*",
    de: "public.bonificacao_parametros o",
    onde: [daEmpresa("o.empresa_id")],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemParametros) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    o.empresa_id === null
      ? descartar("empresa_id nulo")
      : migrar({
          id: o.id,
          empresaId: o.empresa_id,
          vigenciaInicio: o.vigencia_inicio,
          vigenciaFim: o.vigencia_fim,
          taxaTurbo: taxa(o.taxa_turbo, "taxa_turbo"),
          taxaAcelerado: taxa(o.taxa_acelerado, "taxa_acelerado"),
          taxaEmRotaGrande: taxa(o.taxa_em_rota_grande, "taxa_em_rota_grande"),
          taxaEmRotaPequena: taxa(o.taxa_em_rota_pequena, "taxa_em_rota_pequena"),
          metaRotaPequena: fracao(o.meta_rota_pequena, "meta_rota_pequena"),
          metaRotaGrande: fracao(o.meta_rota_grande, "meta_rota_grande"),
          metaEmRota: fracao(o.meta_em_rota, "meta_em_rota"),
          limiteNfsRotaPequena: ou(o.limite_nfs_rota_pequena, 15),
          criadoPor: o.criado_por,
          criadoEm: o.criado_em ?? filtros.instante,
        }),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    referenciaEmpresa(bonificacaoParametros, "empresaId"),
    referenciaUsuario(bonificacaoParametros, "criadoPor"),
  ],
});

interface OrigemFalta {
  id: string;
  colaborador_nome: string;
  data_falta: string;
  tipo: string;
  observacao: string | null;
  registrado_em: string | null;
  registrado_por: string | null;
  empresa_id: string | null;
}

export const passoBonificacaoFaltas = definirTabela({
  nome: "bonificacao_faltas",
  origem: "public.bonificacao_faltas",
  tabela: bonificacaoFaltas,
  consulta: {
    colunas: "o.*",
    de: "public.bonificacao_faltas o",
    onde: [daEmpresa("o.empresa_id")],
    chave: PELO_ID,
  },
  chaveDaLinha: (o: OrigemFalta) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    o.empresa_id === null
      ? descartar("empresa_id nulo")
      : migrar({
          id: o.id,
          empresaId: o.empresa_id,
          colaboradorNome: o.colaborador_nome,
          dataFalta: o.data_falta,
          tipo: daLista(o.tipo, tiposDeFalta, "tipo"),
          observacao: o.observacao,
          registradoPor: o.registrado_por,
          criadoEm: o.registrado_em ?? filtros.instante,
        }),
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [
    referenciaEmpresa(bonificacaoFaltas, "empresaId"),
    referenciaUsuario(bonificacaoFaltas, "registradoPor"),
  ],
});

interface OrigemCodigoBonificacao {
  codigo: number;
  efeito: string;
  observacao: string | null;
  atualizado_em: string | null;
  empresa_id: string;
}

export const passoBonificacaoCodigos = definirTabela({
  nome: "bonificacao_codigos",
  origem: "public.bonificacao_codigos",
  tabela: bonificacaoCodigos,
  consulta: {
    colunas: "o.codigo, o.efeito::text as efeito, o.observacao, o.atualizado_em, o.empresa_id",
    de: "public.bonificacao_codigos o",
    onde: [daEmpresa("o.empresa_id")],
    chave: [
      { expressao: "o.empresa_id", tipo: "uuid" },
      { expressao: "o.codigo", tipo: "integer" },
    ],
  },
  chaveDaLinha: (o: OrigemCodigoBonificacao) => `${o.empresa_id}:${String(o.codigo)}`,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    migrar({
      empresaId: o.empresa_id,
      codigo: codigoDeOcorrencia(o.codigo, "codigo"),
      efeito: daLista(o.efeito, bonificacaoEfeito.enumValues, "efeito"),
      observacao: o.observacao,
      atualizadoEm: o.atualizado_em ?? filtros.instante,
    }),
  conflito: ["empresaId", "codigo"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(bonificacaoCodigos, "empresaId")],
});
