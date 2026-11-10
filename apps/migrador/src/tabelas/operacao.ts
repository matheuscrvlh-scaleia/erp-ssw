/** Ocorrências, coletas e a saída para entrega por CT-e (de-para "Ocorrências", "Coletas", "Projeções"). */
import { coletas, ocorrencias, responsavelOcorrencia, romaneioSaidasCte } from "@erp/db/schema";

import { definirTabela, descartar, migrar, semApoio } from "../motor/tipos";
import { daLista, etapaDaColeta } from "../transformacoes/diversas";
import { codigoDeOcorrencia, dinheiro, peso } from "../transformacoes/numeros";
import { daEmpresa, ESCOPO_DA_EMPRESA, ou, referenciaEmpresa, referenciaPorId } from "./comum";

interface OrigemOcorrencia {
  id: string;
  ctrc_id: string;
  codigo: number;
  descricao: string | null;
  data_hora: string | null;
  responsavel: string;
  penaliza: boolean | null;
  created_at: string | null;
  protocolo_ssw: string | null;
  complemento: string | null;
  origem: string | null;
  filial: string | null;
  quarentena: boolean | null;
  empresa_id: string;
}

/**
 * 1,5 mi de linhas: lidas na ordem do CT-e (`ctrc_id`, `id`), que é a ordem da chave única
 * `(cte_id, codigo, data_hora)` — os lotes caem em páginas vizinhas do índice.
 */
export const passoOcorrencias = definirTabela({
  nome: "ocorrencias",
  origem: "public.ocorrencias",
  tabela: ocorrencias,
  consulta: {
    colunas: `o.id, o.ctrc_id, o.codigo, o.descricao, o.data_hora, o.responsavel::text as responsavel,
      o.penaliza, o.created_at, o.protocolo_ssw, o.complemento, o.origem, o.filial, o.quarentena,
      o.empresa_id`,
    de: "public.ocorrencias o",
    onde: [daEmpresa("o.empresa_id")],
    chave: [
      { expressao: "o.ctrc_id", tipo: "uuid" },
      { expressao: "o.id", tipo: "uuid" },
    ],
  },
  chaveDaLinha: (o: OrigemOcorrencia) => o.id,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) => {
    if (o.data_hora === null) return descartar("ocorrência sem data/hora");
    return migrar({
      id: o.id,
      empresaId: o.empresa_id,
      cteId: o.ctrc_id,
      codigo: codigoDeOcorrencia(o.codigo, "codigo"),
      descricao: o.descricao,
      complemento: o.complemento,
      dataHora: o.data_hora,
      filial: o.filial,
      protocoloSsw: o.protocolo_ssw,
      origem: ou(o.origem, "manual"),
      responsavel: daLista(o.responsavel, responsavelOcorrencia.enumValues, "responsavel"),
      // penaliza/quarentena são decididas na gravação (código da época, chegada); copiadas como estão.
      penaliza: ou(o.penaliza, false),
      quarentena: ou(o.quarentena, false),
      criadoEm: o.created_at ?? filtros.instante,
    });
  },
  conflito: ["id"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  chaveDestino: ["id"],
  referencias: [
    referenciaPorId(ocorrencias, "cteId", "erp.ctes", { descartar: "CT-e não migrou" }),
    {
      colunas: ["empresaId", "codigo"],
      tabela: "erp.codigos_ocorrencia",
      colunasDestino: ["empresa_id", "codigo"],
      tipos: ["uuid", "smallint"],
      seAusente: { descartar: "código fora do catálogo da empresa" },
    },
  ],
});

export interface OrigemColeta {
  unidade: string;
  numero: number;
  tipo: string | null;
  remetente_cnpj: string | null;
  remetente_nome: string | null;
  remetente_cidade: string | null;
  setor: string | null;
  destinatario_cnpj: string | null;
  destinatario_nome: string | null;
  destino_cidade: string | null;
  solicitante: string | null;
  motorista: string | null;
  placa: string | null;
  situacao: string | null;
  situacao_em: string | null;
  limite_em: string | null;
  limite_inicial: string | null;
  cadastrada_em: string | null;
  cadastrada_por: string | null;
  dia_cadastro: string | null;
  comandada_em: string | null;
  coletada_em: string | null;
  cancelada_em: string | null;
  valor_mercadoria: string | null;
  volumes: number | null;
  peso_kg: string | null;
  mercadoria: string | null;
  tipo_frete: string | null;
  notas_fiscais: string | null;
  observacao: string | null;
  ctrc_sigla: string | null;
  ctrc_numero: string | null;
  romaneio: string | null;
  prejudicada_horario: boolean | null;
  historico: string | null;
  relatorio_emitido_em: string;
  arquivo_origem: string | null;
  atualizado_em: string | null;
  empresa_id: string;
}

export const passoColetas = definirTabela({
  nome: "coletas",
  origem: "public.coletas",
  tabela: coletas,
  consulta: {
    colunas: "o.*",
    de: "public.coletas o",
    onde: [daEmpresa("o.empresa_id")],
    chave: [
      { expressao: "o.empresa_id", tipo: "uuid" },
      { expressao: "o.unidade", tipo: "text" },
      { expressao: "o.numero", tipo: "integer" },
    ],
  },
  chaveDaLinha: (o: OrigemColeta) => `${o.unidade}:${String(o.numero)}`,
  preparar: semApoio,
  transformar: (o, _apoio, filtros) =>
    migrar({
      empresaId: o.empresa_id,
      unidade: o.unidade,
      numero: o.numero,
      tipo: ou(o.tipo, "NORMAL"),
      remetenteCnpj: o.remetente_cnpj,
      remetenteNome: o.remetente_nome,
      remetenteCidade: o.remetente_cidade,
      setor: o.setor,
      destinatarioCnpj: o.destinatario_cnpj,
      destinatarioNome: o.destinatario_nome,
      destinoCidade: o.destino_cidade,
      solicitante: o.solicitante,
      motorista: o.motorista,
      placa: o.placa,
      situacao: o.situacao,
      // Gravada (antes `vw_coletas`): depende só da situação.
      etapa: etapaDaColeta(o.situacao),
      situacaoEm: o.situacao_em,
      limiteEm: o.limite_em,
      limiteInicial: o.limite_inicial,
      cadastradaEm: o.cadastrada_em,
      cadastradaPor: o.cadastrada_por,
      diaCadastro: o.dia_cadastro,
      comandadaEm: o.comandada_em,
      coletadaEm: o.coletada_em,
      canceladaEm: o.cancelada_em,
      valorMercadoria: dinheiro(o.valor_mercadoria, "valor_mercadoria"),
      volumes: o.volumes,
      pesoKg: peso(o.peso_kg, "peso_kg"),
      mercadoria: o.mercadoria,
      tipoFrete: o.tipo_frete,
      notasFiscais: o.notas_fiscais,
      observacao: o.observacao,
      cteSigla: o.ctrc_sigla,
      cteNumero: o.ctrc_numero,
      romaneio: o.romaneio,
      prejudicadaHorario: ou(o.prejudicada_horario, false),
      historico: o.historico ?? "[]",
      relatorioEmitidoEm: o.relatorio_emitido_em,
      arquivoOrigem: o.arquivo_origem,
      atualizadoEm: o.atualizado_em ?? filtros.instante,
    }),
  conflito: ["empresaId", "unidade", "numero"],
  aoConflitar: "atualizar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(coletas, "empresaId")],
});

interface OrigemSaida {
  numero_ctrc: string;
  sigla_ctrc: string | null;
  data_saida: string;
  empresa_id: string;
}

/**
 * Saída para entrega por CT-e: cópia direta da tabela (era gatilho, não matview). Sem sigla não
 * há chave nova: fica de fora e vai para o relatório.
 */
export const passoRomaneioSaidasCte = definirTabela({
  nome: "romaneio_saidas_cte",
  origem: "public.romaneio_saida_ctrc",
  tabela: romaneioSaidasCte,
  consulta: {
    colunas: "o.numero_ctrc, o.sigla_ctrc, o.data_saida, o.empresa_id",
    de: "public.romaneio_saida_ctrc o",
    onde: [daEmpresa("o.empresa_id")],
    chave: [
      { expressao: "o.empresa_id", tipo: "uuid" },
      { expressao: "coalesce(o.sigla_ctrc, '')", tipo: "text" },
      { expressao: "o.numero_ctrc", tipo: "text" },
      { expressao: "o.data_saida", tipo: "date" },
    ],
  },
  chaveDaLinha: (o: OrigemSaida) => `${o.sigla_ctrc ?? "?"}${o.numero_ctrc}@${o.data_saida}`,
  preparar: semApoio,
  transformar: (o) =>
    o.sigla_ctrc === null
      ? descartar("saída sem sigla do CT-e")
      : migrar({
          empresaId: o.empresa_id,
          sigla: o.sigla_ctrc,
          numero: o.numero_ctrc,
          dataSaida: o.data_saida,
        }),
  conflito: ["empresaId", "sigla", "numero", "dataSaida"],
  aoConflitar: "ignorar",
  escopoDestino: ESCOPO_DA_EMPRESA,
  referencias: [referenciaEmpresa(romaneioSaidasCte, "empresaId")],
});
