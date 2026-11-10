/**
 * Gravação de CT-e pelo núcleo no banco do ERP (a regra é `regravarCte`/`criarCte` de
 * `@erp/dominio/nucleo`). Usada pelos jobs de recálculo; o worker-ssw tem a cópia dele (ADR 0012).
 * Preso a uma transação no contexto da empresa (RLS); toda gravação leva a empresa explícita.
 */
import { type Transacao } from "@erp/db";
import {
  codigosOcorrencia,
  configuracoes,
  ctePrazoHistorico,
  ctes,
  empresaIntegracoes,
  empresas,
  filiais,
  ocorrencias,
  prazosConfigurados,
} from "@erp/db/schema";
import { configuracoesVigentes } from "@erp/dominio/configuracoes";
import {
  cnpjsPropriosDaEmpresa,
  type CteGravado,
  type CteNucleo,
  lerConfiguracaoDoNucleo,
  montarCatalogo,
  type OcorrenciaDoCte,
  type RepositorioCteNucleo,
} from "@erp/dominio/nucleo";
import { and, eq, inArray, sql } from "drizzle-orm";

/** Linha de `ctes` com os tipos do núcleo (ex.: `ocorrEfetivaFonte` fechado). */
type CteDoErp = Omit<typeof ctes.$inferSelect, keyof CteNucleo> & CteNucleo;

/** O schema guarda `ocorr_efetiva_fonte` como texto; o núcleo o fecha num tipo. */
export const comoCte = (c: typeof ctes.$inferSelect) => c as CteDoErp;

/** Configurações que o núcleo lê (padrões em `CONFIGURACAO_PADRAO`). */
const CHAVES_DO_NUCLEO = [
  "alerta_dias_sem_movimento",
  "ctrc_data_minima_emissao",
  "prazo_padrao_dias",
  "raiz_cnpj_troca",
];

const LOTE_DE_GRAVACAO = 500;
const LOTE_DE_LEITURA = 5000;

function emBlocos<T>(itens: readonly T[], tamanho: number): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) blocos.push(itens.slice(i, i + tamanho));
  return blocos;
}

export function criarRepositorioCteNucleo(
  tx: Transacao,
  empresaId: string,
): RepositorioCteNucleo<CteGravado> {
  return {
    async cadastrosDoNucleo() {
      const codigos = await tx
        .select({
          codigo: codigosOcorrencia.codigo,
          descricao: codigosOcorrencia.descricao,
          tipoSsw: codigosOcorrencia.tipoSsw,
          processoSsw: codigosOcorrencia.processoSsw,
          responsavel: codigosOcorrencia.responsavel,
          penaliza: codigosOcorrencia.penaliza,
        })
        .from(codigosOcorrencia)
        .where(eq(codigosOcorrencia.empresaId, empresaId));
      const listaDeFiliais = await tx
        .select({
          sigla: filiais.sigla,
          cidade: filiais.cidade,
          uf: filiais.uf,
          propria: filiais.propria,
        })
        .from(filiais)
        .where(eq(filiais.empresaId, empresaId));
      const regras = await tx
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
        .where(eq(prazosConfigurados.empresaId, empresaId));
      const [xml] = await tx
        .select({ parametros: empresaIntegracoes.parametros })
        .from(empresaIntegracoes)
        .where(
          and(eq(empresaIntegracoes.empresaId, empresaId), eq(empresaIntegracoes.tipo, "xml_cte")),
        );
      const [empresa] = await tx
        .select({ cnpj: empresas.cnpj, dominioSsw: empresas.dominioSsw })
        .from(empresas)
        .where(eq(empresas.id, empresaId));
      if (!empresa) throw new Error(`Empresa inexistente: ${empresaId}`);
      const config = await tx
        .select({
          empresaId: configuracoes.empresaId,
          chave: configuracoes.chave,
          valor: configuracoes.valor,
        })
        .from(configuracoes)
        .where(
          and(
            inArray(configuracoes.chave, CHAVES_DO_NUCLEO),
            sql`(${configuracoes.empresaId} = ${empresaId} or ${configuracoes.empresaId} is null)`,
          ),
        );
      const emitentes = xml?.parametros.cnpjs_emitentes;
      return {
        catalogo: montarCatalogo(codigos),
        filiais: listaDeFiliais,
        regrasDePrazo: regras,
        config: lerConfiguracaoDoNucleo(configuracoesVigentes(config)),
        cnpjsProprios: cnpjsPropriosDaEmpresa(
          empresa.cnpj,
          Array.isArray(emitentes) ? emitentes.map(String) : [],
        ),
        dominioSsw: empresa.dominioSsw,
      };
    },

    async ocorrenciasDosCtes(ids) {
      const saida = new Map<string, OcorrenciaDoCte[]>();
      for (const bloco of emBlocos([...new Set(ids)], LOTE_DE_LEITURA)) {
        const linhas = await tx
          .select({
            id: ocorrencias.id,
            cteId: ocorrencias.cteId,
            codigo: ocorrencias.codigo,
            descricao: ocorrencias.descricao,
            dataHora: ocorrencias.dataHora,
            filial: ocorrencias.filial,
            origem: ocorrencias.origem,
            quarentena: ocorrencias.quarentena,
            criadoEm: ocorrencias.criadoEm,
          })
          .from(ocorrencias)
          .where(and(eq(ocorrencias.empresaId, empresaId), inArray(ocorrencias.cteId, bloco)));
        for (const { cteId, ...o } of linhas) saida.set(cteId, [...(saida.get(cteId) ?? []), o]);
      }
      return saida;
    },

    async inserirCtes(novos) {
      const saida: CteGravado[] = [];
      for (const bloco of emBlocos(novos, LOTE_DE_GRAVACAO)) {
        const linhas = await tx
          .insert(ctes)
          .values(bloco.map((c) => ({ ...c, empresaId, camposSsw: [...c.camposSsw] })))
          .onConflictDoNothing()
          .returning();
        saida.push(...linhas.map(comoCte));
      }
      return saida;
    },

    async atualizarCte(id, campos) {
      const { camposSsw, ...resto } = campos;
      await tx
        .update(ctes)
        .set({ ...resto, ...(camposSsw ? { camposSsw: [...camposSsw] } : {}) })
        .where(and(eq(ctes.empresaId, empresaId), eq(ctes.id, id)));
    },

    async registrarTrocaDePrevisao(cteId, troca) {
      await tx.insert(ctePrazoHistorico).values({ empresaId, cteId, ...troca });
    },
  };
}
