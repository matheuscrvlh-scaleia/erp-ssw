import { comInstantes, sql, type Transacao } from "@erp/db";

import { type LeitorDeConfiguracoes } from "../settings/reader";
import { type RepositorioCtrc } from "./ctrc.service";

/** Teto de segurança: um número repete em poucas séries. */
const LIMITE_DE_SERIES = 20;
/** Teto de segurança das ocorrências de um CT-e (hoje o maior tem algumas dezenas). */
const LIMITE_DE_OCORRENCIAS = 2000;

const numeroOuNulo = (valor: string | null) => (valor === null ? null : Number(valor));

type CtrcLido = NonNullable<Awaited<ReturnType<RepositorioCtrc["ctrc"]>>>;

/** Linha do CT-e como sai do banco: numeric em texto e o cadastro do parceiro em colunas. */
type LinhaDoCtrc = Omit<CtrcLido, "peso" | "valorFrete" | "valorMercadoria" | "parceiro"> & {
  peso: string | null;
  valorFrete: string | null;
  valorMercadoria: string | null;
  parceiroId: string | null;
  parceiroCadastroNome: string | null;
  parceiroCadastroCnpj: string | null;
};

export function criarRepositorioCtrc(
  tx: Transacao,
  configuracoesVigentes: LeitorDeConfiguracoes,
): RepositorioCtrc {
  return {
    filiaisProprias: async (empresaId) => {
      const linhas = await tx.consultar<{ sigla: string }>(sql`
        select sigla from erp.filiais where empresa_id = ${empresaId} and propria
        order by sigla`);
      return linhas.map((l) => l.sigla);
    },

    catalogo: (empresaId) =>
      tx.consultar(sql`
        select codigo, descricao, tipo_ssw as "tipoSsw", penaliza,
               pendencia_acompanhada as "pendenciaAcompanhada"
        from erp.codigos_ocorrencia where empresa_id = ${empresaId}
        order by codigo`),

    configuracoes: configuracoesVigentes,

    ctesPorNumero: (empresaId, numero, sigla) =>
      tx.consultar(sql`
        select sigla, numero, data_emissao as "dataEmissao", destinatario,
               cidade_destino as "cidadeDestino"
        from erp.ctes
        where empresa_id = ${empresaId} and numero = ${numero}
          ${sigla === null ? sql.vazio() : sql`and sigla = ${sigla}`}
          and not fora_universo
        order by data_emissao desc, sigla asc
        limit ${LIMITE_DE_SERIES}`),

    ctrc: async (empresaId, sigla, numero) => {
      const [linha] = comInstantes<LinhaDoCtrc>(
        await tx.consultar(sql`
          select
          ctes.id, ctes.sigla, ctes.numero, ctes.numero_nf as "numeroNf", ctes.chave,
          ctes.chave_nfe as "chaveNfe", ctes.data_emissao as "dataEmissao",
          ctes.data_embarque as "dataEmbarque", ctes.status_atual as "statusAtual",
          ctes.prazo_contratado_dias as "prazoContratadoDias",
          ctes.data_prevista_entrega as "dataPrevistaEntrega",
          ctes.prazo_origem as "prazoOrigem", ctes.prazo_fonte as "prazoFonte",
          ctes.prazo_padrao_dias as "prazoPadraoDias",
          ctes.prazo_padrao_data as "prazoPadraoData",
          ctes.data_entrega_realizada as "dataEntregaRealizada",
          ctes.performance_dias as "performanceDias", ctes.no_prazo as "noPrazo",
          ctes.responsabilidade_cliente as "responsabilidadeCliente",
          ctes.fonte_performance as "fontePerformance", ctes.unidade_origem as "unidadeOrigem",
          ctes.unidade_destino as "unidadeDestino", ctes.unidade_atual as "unidadeAtual",
          ctes.filial, ctes.unidade_cidade as "unidadeCidade", ctes.unidade_uf as "unidadeUf",
          ctes.localizacao_atual as "localizacaoAtual",
          ctes.ult_ocorr_instrucao_0174 as "ultOcorrInstrucao0174", ctes.remetente,
          ctes.destinatario, ctes.logradouro_destino as "logradouroDestino",
          ctes.numero_endereco_destino as "numeroEnderecoDestino",
          ctes.complemento_destino as "complementoDestino",
          ctes.bairro_destino as "bairroDestino", ctes.cidade_destino as "cidadeDestino",
          ctes.uf_destino as "ufDestino", ctes.cep_destinatario as "cepDestinatario", ctes.setor,
          ctes.setor_destino as "setorDestino", ctes.peso, ctes.volumes,
          ctes.valor_frete as "valorFrete", ctes.valor_mercadoria as "valorMercadoria",
          ctes.primeiro_manifesto as "primeiroManifesto",
          ctes.ultimo_manifesto as "ultimoManifesto", ctes.parceiro_nome as "parceiroNome",
          ctes.parceiro_cnpj as "parceiroCnpj", parceiros.id as "parceiroId",
          parceiros.nome as "parceiroCadastroNome", parceiros.cnpj as "parceiroCadastroCnpj",
          ctes.ocorr_efetiva_codigo as "ocorrEfetivaCodigo",
          ctes.ocorr_efetiva_descricao as "ocorrEfetivaDescricao",
          ctes.ocorr_efetiva_data as "ocorrEfetivaData",
          ctes.ocorr_efetiva_fonte as "ocorrEfetivaFonte", ctes.criado_em as "criadoEm",
          ctes.atualizado_em as "atualizadoEm"
          from erp.ctes
          left join erp.parceiros on parceiros.id = ctes.parceiro_id
          where ctes.empresa_id = ${empresaId} and ctes.sigla = ${sigla}
            and ctes.numero = ${numero} and not ctes.fora_universo`),
        ["dataEntregaRealizada", "ocorrEfetivaData", "criadoEm", "atualizadoEm"],
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

    ocorrencias: async (cteId) =>
      comInstantes<Awaited<ReturnType<RepositorioCtrc["ocorrencias"]>>[number]>(
        await tx.consultar(sql`
          select id, codigo, descricao, data_hora as "dataHora", responsavel, penaliza,
                 criado_em as "criadoEm"
          from erp.ocorrencias
          where cte_id = ${cteId} and not quarentena
          order by data_hora desc, criado_em desc
          limit ${LIMITE_DE_OCORRENCIAS}`),
        ["dataHora", "criadoEm"],
      ),

    romaneioAtual: async (empresaId, sigla, numero) => {
      const [linha] = await tx.consultar<
        NonNullable<Awaited<ReturnType<RepositorioCtrc["romaneioAtual"]>>>
      >(sql`
        select placa, motorista, romaneio from erp.romaneio_cte_atual
        where empresa_id = ${empresaId} and sigla = ${sigla} and numero = ${numero}`);
      return linha ?? null;
    },

    ultimoBi2: async (empresaId, numero) => {
      const [linha] = comInstantes<NonNullable<Awaited<ReturnType<RepositorioCtrc["ultimoBi2"]>>>>(
        await tx.consultar(sql`
          select codigo_relatorio as "codigoRelatorio", data_alvo as "dataAlvo",
                 atualizado_em as "atualizadoEm"
          from erp.bi2_bruto
          where empresa_id = ${empresaId} and numero = ${numero}
          order by atualizado_em desc
          limit 1`),
        ["atualizadoEm"],
      );
      return linha ?? null;
    },
  };
}
