import { type Transacao } from "@erp/db";
import {
  codigosOcorrencia,
  configuracoes,
  ctePrazoHistorico,
  ctes,
  empresas,
  filiais,
  ocorrencias,
  prazosConfigurados,
} from "@erp/db/schema";
import {
  type FonteDaEfetiva,
  FONTES_DA_EFETIVA,
  lerConfiguracaoDoNucleo,
  montarCatalogo,
  type OcorrenciaDoCte,
} from "@erp/dominio/nucleo";
import { eq, inArray, isNull, or, sql } from "drizzle-orm";

import { type CteGravado, type RepositorioCteNucleo } from "./cte-nucleo";
import { exigirEmpresa } from "./empresa";

/** Colunas de `ctes` que a ingestão lê e grava (as do núcleo + identidade + NF). */
export const COLUNAS_DO_CTE = {
  id: ctes.id,
  sigla: ctes.sigla,
  numero: ctes.numero,
  prazoEntrega: ctes.prazoEntrega,
  chaveNfe: ctes.chaveNfe,
  numeroNf: ctes.numeroNf,
  serieNf: ctes.serieNf,
  cnpjRemetente: ctes.cnpjRemetente,
  dataEmissao: ctes.dataEmissao,
  criadoEm: ctes.criadoEm,
  duplicadoDe: ctes.duplicadoDe,
  dataEntregaRealizada: ctes.dataEntregaRealizada,
  pagadorCnpj: ctes.pagadorCnpj,
  parceiroCnpj: ctes.parceiroCnpj,
  filial: ctes.filial,
  unidadeDestino: ctes.unidadeDestino,
  unidadeAtual: ctes.unidadeAtual,
  camposSsw: ctes.camposSsw,
  ultOcorrCodigo0174: ctes.ultOcorrCodigo0174,
  ultOcorrDescricao0174: ctes.ultOcorrDescricao0174,
  ultOcorrData0174: ctes.ultOcorrData0174,
  ultOcorrLocal0174: ctes.ultOcorrLocal0174,
  ultOcorrInstrucao0174: ctes.ultOcorrInstrucao0174,
  ultimaOcorrCodigo0013: ctes.ultimaOcorrCodigo0013,
  ultimaOcorrData0013: ctes.ultimaOcorrData0013,
  ocorr036Codigo: ctes.ocorr036Codigo,
  ocorr036Descricao: ctes.ocorr036Descricao,
  ocorr036Data: ctes.ocorr036Data,
  ocorrEfetivaCodigo: ctes.ocorrEfetivaCodigo,
  ocorrEfetivaDescricao: ctes.ocorrEfetivaDescricao,
  ocorrEfetivaData: ctes.ocorrEfetivaData,
  ocorrEfetivaFonte: ctes.ocorrEfetivaFonte,
  ocorrEfetivaLocal: ctes.ocorrEfetivaLocal,
  ocorrEfetivaCodigoNum: ctes.ocorrEfetivaCodigoNum,
  dataPrevistaEntrega: ctes.dataPrevistaEntrega,
  prazoFonte: ctes.prazoFonte,
  dataBasePrazo: ctes.dataBasePrazo,
  previsaoSswData: ctes.previsaoSswData,
  previsaoSswFonte: ctes.previsaoSswFonte,
  previsaoSswDataBase: ctes.previsaoSswDataBase,
  dataEmbarque: ctes.dataEmbarque,
  dataConclusaoEfetiva: ctes.dataConclusaoEfetiva,
  pagadorCnpjDigitos: ctes.pagadorCnpjDigitos,
  filialEfetiva: ctes.filialEfetiva,
  unidadeCidade: ctes.unidadeCidade,
  unidadeUf: ctes.unidadeUf,
  prazoPadraoDias: ctes.prazoPadraoDias,
  prazoPadraoData: ctes.prazoPadraoData,
  statusAtual: ctes.statusAtual,
  canceladoMesmoDia: ctes.canceladoMesmoDia,
  foraUniverso: ctes.foraUniverso,
};

type LinhaDoCte = Omit<CteGravado, "ocorrEfetivaFonte"> & { ocorrEfetivaFonte: string | null };

function ehFonteDaEfetiva(fonte: string): fonte is FonteDaEfetiva {
  return (FONTES_DA_EFETIVA as readonly string[]).includes(fonte);
}

/** A fonte da efetiva é texto no banco; fora da lista vira nula (o núcleo recalcula). */
export function paraCteGravado(linha: LinhaDoCte): CteGravado {
  const fonte = linha.ocorrEfetivaFonte;
  return { ...linha, ocorrEfetivaFonte: fonte !== null && ehFonteDaEfetiva(fonte) ? fonte : null };
}

/** Ocorrências do CT-e no formato do núcleo. */
export const COLUNAS_DA_OCORRENCIA = {
  id: ocorrencias.id,
  cteId: ocorrencias.cteId,
  codigo: ocorrencias.codigo,
  descricao: ocorrencias.descricao,
  dataHora: ocorrencias.dataHora,
  filial: ocorrencias.filial,
  origem: ocorrencias.origem,
  quarentena: ocorrencias.quarentena,
  criadoEm: ocorrencias.criadoEm,
};

export function criarRepositorioCteNucleo(
  tx: Transacao,
  empresaDoContexto: string | null,
): RepositorioCteNucleo {
  const empresa = () => exigirEmpresa(empresaDoContexto);
  return {
    contextoDaEmpresa: async () => {
      const empresaId = empresa();
      const [catalogo, filiaisDaEmpresa, regras, valores, dadosDaEmpresa] = await Promise.all([
        tx
          .select({
            codigo: codigosOcorrencia.codigo,
            descricao: codigosOcorrencia.descricao,
            tipoSsw: codigosOcorrencia.tipoSsw,
            processoSsw: codigosOcorrencia.processoSsw,
            responsavel: codigosOcorrencia.responsavel,
            penaliza: codigosOcorrencia.penaliza,
          })
          .from(codigosOcorrencia)
          .where(eq(codigosOcorrencia.empresaId, empresaId)),
        tx
          .select({
            sigla: filiais.sigla,
            cidade: filiais.cidade,
            uf: filiais.uf,
            propria: filiais.propria,
          })
          .from(filiais)
          .where(eq(filiais.empresaId, empresaId)),
        tx
          .select({
            id: prazosConfigurados.id,
            tipo: prazosConfigurados.tipo,
            unidadeCodigo: prazosConfigurados.unidadeCodigo,
            unidadeDestinoCodigo: prazosConfigurados.unidadeDestinoCodigo,
            parceiroCnpj: prazosConfigurados.parceiroCnpj,
            prazoHoras: prazosConfigurados.prazoHoras,
            prazoDias: prazosConfigurados.prazoDias,
            ativo: prazosConfigurados.ativo,
            criadoEm: prazosConfigurados.criadoEm,
          })
          .from(prazosConfigurados)
          .where(eq(prazosConfigurados.empresaId, empresaId)),
        // Valor da empresa vence o padrão da plataforma (empresa nula): nulos primeiro.
        tx
          .select({ chave: configuracoes.chave, valor: configuracoes.valor })
          .from(configuracoes)
          .where(or(eq(configuracoes.empresaId, empresaId), isNull(configuracoes.empresaId)))
          .orderBy(sql`${configuracoes.empresaId} nulls first`),
        tx
          .select({ dominioSsw: empresas.dominioSsw })
          .from(empresas)
          .where(eq(empresas.id, empresaId)),
      ]);
      return {
        catalogo: montarCatalogo(catalogo),
        filiais: filiaisDaEmpresa,
        regrasDePrazo: regras,
        config: lerConfiguracaoDoNucleo(new Map(valores.map((v) => [v.chave, v.valor]))),
        dominioSsw: dadosDaEmpresa[0]?.dominioSsw ?? null,
      };
    },

    ocorrenciasDosCtes: async (ids) => {
      const porCte = new Map<string, OcorrenciaDoCte[]>(ids.map((id) => [id, []]));
      if (ids.length === 0) return porCte;
      const linhas = await tx
        .select(COLUNAS_DA_OCORRENCIA)
        .from(ocorrencias)
        .where(inArray(ocorrencias.cteId, [...ids]));
      for (const { cteId, ...ocorrencia } of linhas) porCte.get(cteId)?.push(ocorrencia);
      return porCte;
    },

    atualizarCte: async (cte, agora) => {
      const { id, criadoEm: _criadoEm, ...colunas } = cte;
      await tx
        .update(ctes)
        .set({ ...colunas, camposSsw: [...colunas.camposSsw], atualizadoEm: agora })
        .where(eq(ctes.id, id));
    },

    inserirCte: async (cte) => {
      const [linha] = await tx
        .insert(ctes)
        .values({ ...cte, camposSsw: [...cte.camposSsw], empresaId: empresa() })
        .returning(COLUNAS_DO_CTE);
      if (!linha) throw new Error("Inserção do CT-e não devolveu a linha.");
      return paraCteGravado(linha);
    },

    registrarTrocaDePrevisao: async (cteId, troca) => {
      await tx.insert(ctePrazoHistorico).values({ empresaId: empresa(), cteId, ...troca });
    },
  };
}
