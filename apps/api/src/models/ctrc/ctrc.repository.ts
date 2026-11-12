import { type Transacao } from "@erp/db";
import {
  bi2Bruto,
  codigosOcorrencia,
  ctes,
  filiais,
  ocorrencias,
  parceiros,
  romaneioCteAtual,
} from "@erp/db/schema";
import { and, asc, desc, eq, not } from "drizzle-orm";

import { type LeitorDeConfiguracoes } from "../configuracoes/leitor";
import { type RepositorioCtrc } from "./ctrc.service";

/** Teto de segurança: um número repete em poucas séries. */
const LIMITE_DE_SERIES = 20;
/** Teto de segurança das ocorrências de um CT-e (hoje o maior tem algumas dezenas). */
const LIMITE_DE_OCORRENCIAS = 2000;

const numeroOuNulo = (valor: string | null) => (valor === null ? null : Number(valor));

export function criarRepositorioCtrc(
  tx: Transacao,
  configuracoesVigentes: LeitorDeConfiguracoes,
): RepositorioCtrc {
  return {
    filiaisProprias: async (empresaId) => {
      const linhas = await tx
        .select({ sigla: filiais.sigla })
        .from(filiais)
        .where(and(eq(filiais.empresaId, empresaId), eq(filiais.propria, true)))
        .orderBy(asc(filiais.sigla));
      return linhas.map((l) => l.sigla);
    },

    catalogo: (empresaId) =>
      tx
        .select({
          codigo: codigosOcorrencia.codigo,
          descricao: codigosOcorrencia.descricao,
          tipoSsw: codigosOcorrencia.tipoSsw,
          penaliza: codigosOcorrencia.penaliza,
          pendenciaAcompanhada: codigosOcorrencia.pendenciaAcompanhada,
        })
        .from(codigosOcorrencia)
        .where(eq(codigosOcorrencia.empresaId, empresaId))
        .orderBy(asc(codigosOcorrencia.codigo)),

    configuracoes: configuracoesVigentes,

    ctesPorNumero: (empresaId, numero, sigla) =>
      tx
        .select({
          sigla: ctes.sigla,
          numero: ctes.numero,
          dataEmissao: ctes.dataEmissao,
          destinatario: ctes.destinatario,
          cidadeDestino: ctes.cidadeDestino,
        })
        .from(ctes)
        .where(
          and(
            eq(ctes.empresaId, empresaId),
            eq(ctes.numero, numero),
            sigla === null ? undefined : eq(ctes.sigla, sigla),
            not(ctes.foraUniverso),
          ),
        )
        .orderBy(desc(ctes.dataEmissao), asc(ctes.sigla))
        .limit(LIMITE_DE_SERIES),

    ctrc: async (empresaId, sigla, numero) => {
      const [linha] = await tx
        .select({
          id: ctes.id,
          sigla: ctes.sigla,
          numero: ctes.numero,
          numeroNf: ctes.numeroNf,
          chave: ctes.chave,
          chaveNfe: ctes.chaveNfe,
          dataEmissao: ctes.dataEmissao,
          dataEmbarque: ctes.dataEmbarque,
          statusAtual: ctes.statusAtual,
          prazoContratadoDias: ctes.prazoContratadoDias,
          dataPrevistaEntrega: ctes.dataPrevistaEntrega,
          prazoOrigem: ctes.prazoOrigem,
          prazoFonte: ctes.prazoFonte,
          prazoPadraoDias: ctes.prazoPadraoDias,
          prazoPadraoData: ctes.prazoPadraoData,
          dataEntregaRealizada: ctes.dataEntregaRealizada,
          performanceDias: ctes.performanceDias,
          noPrazo: ctes.noPrazo,
          responsabilidadeCliente: ctes.responsabilidadeCliente,
          fontePerformance: ctes.fontePerformance,
          unidadeOrigem: ctes.unidadeOrigem,
          unidadeDestino: ctes.unidadeDestino,
          unidadeAtual: ctes.unidadeAtual,
          filial: ctes.filial,
          unidadeCidade: ctes.unidadeCidade,
          unidadeUf: ctes.unidadeUf,
          localizacaoAtual: ctes.localizacaoAtual,
          ultOcorrInstrucao0174: ctes.ultOcorrInstrucao0174,
          remetente: ctes.remetente,
          destinatario: ctes.destinatario,
          logradouroDestino: ctes.logradouroDestino,
          numeroEnderecoDestino: ctes.numeroEnderecoDestino,
          complementoDestino: ctes.complementoDestino,
          bairroDestino: ctes.bairroDestino,
          cidadeDestino: ctes.cidadeDestino,
          ufDestino: ctes.ufDestino,
          cepDestinatario: ctes.cepDestinatario,
          setor: ctes.setor,
          setorDestino: ctes.setorDestino,
          peso: ctes.peso,
          volumes: ctes.volumes,
          valorFrete: ctes.valorFrete,
          valorMercadoria: ctes.valorMercadoria,
          primeiroManifesto: ctes.primeiroManifesto,
          ultimoManifesto: ctes.ultimoManifesto,
          parceiroNome: ctes.parceiroNome,
          parceiroCnpj: ctes.parceiroCnpj,
          parceiroId: parceiros.id,
          parceiroCadastroNome: parceiros.nome,
          parceiroCadastroCnpj: parceiros.cnpj,
          ocorrEfetivaCodigo: ctes.ocorrEfetivaCodigo,
          ocorrEfetivaDescricao: ctes.ocorrEfetivaDescricao,
          ocorrEfetivaData: ctes.ocorrEfetivaData,
          ocorrEfetivaFonte: ctes.ocorrEfetivaFonte,
          criadoEm: ctes.criadoEm,
          atualizadoEm: ctes.atualizadoEm,
        })
        .from(ctes)
        .leftJoin(parceiros, eq(parceiros.id, ctes.parceiroId))
        .where(
          and(
            eq(ctes.empresaId, empresaId),
            eq(ctes.sigla, sigla),
            eq(ctes.numero, numero),
            not(ctes.foraUniverso),
          ),
        );
      if (!linha) return null;
      const { parceiroId, parceiroCadastroNome, parceiroCadastroCnpj, ...resto } = linha;
      return {
        ...resto,
        peso: numeroOuNulo(resto.peso),
        valorFrete: numeroOuNulo(resto.valorFrete),
        valorMercadoria: numeroOuNulo(resto.valorMercadoria),
        parceiro:
          parceiroId !== null && parceiroCadastroNome !== null
            ? { id: parceiroId, nome: parceiroCadastroNome, cnpj: parceiroCadastroCnpj }
            : null,
      };
    },

    ocorrencias: (cteId) =>
      tx
        .select({
          id: ocorrencias.id,
          codigo: ocorrencias.codigo,
          descricao: ocorrencias.descricao,
          dataHora: ocorrencias.dataHora,
          responsavel: ocorrencias.responsavel,
          penaliza: ocorrencias.penaliza,
          criadoEm: ocorrencias.criadoEm,
        })
        .from(ocorrencias)
        .where(and(eq(ocorrencias.cteId, cteId), not(ocorrencias.quarentena)))
        .orderBy(desc(ocorrencias.dataHora), desc(ocorrencias.criadoEm))
        .limit(LIMITE_DE_OCORRENCIAS),

    romaneioAtual: async (empresaId, sigla, numero) => {
      const [linha] = await tx
        .select({
          placa: romaneioCteAtual.placa,
          motorista: romaneioCteAtual.motorista,
          romaneio: romaneioCteAtual.romaneio,
        })
        .from(romaneioCteAtual)
        .where(
          and(
            eq(romaneioCteAtual.empresaId, empresaId),
            eq(romaneioCteAtual.sigla, sigla),
            eq(romaneioCteAtual.numero, numero),
          ),
        );
      return linha ?? null;
    },

    ultimoBi2: async (empresaId, numero) => {
      const [linha] = await tx
        .select({
          codigoRelatorio: bi2Bruto.codigoRelatorio,
          dataAlvo: bi2Bruto.dataAlvo,
          atualizadoEm: bi2Bruto.atualizadoEm,
        })
        .from(bi2Bruto)
        .where(and(eq(bi2Bruto.empresaId, empresaId), eq(bi2Bruto.numero, numero)))
        .orderBy(desc(bi2Bruto.atualizadoEm))
        .limit(1);
      return linha ?? null;
    },
  };
}
