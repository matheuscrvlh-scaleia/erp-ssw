import { type Transacao } from "@erp/db";
import { coletas, ctes } from "@erp/db/schema";
import { criarRepositorioGravacao050 } from "@erp/ingestao/infra";
import { and, asc, between, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { type RepositorioColetas } from "./casos-de-uso";

const numero = (valor: string | null) => (valor === null ? null : Number(valor));

export function criarRepositorioColetas(tx: Transacao): RepositorioColetas {
  return {
    ...criarRepositorioGravacao050(tx),
    coletas: async (empresaId, f, limite) => {
      const linhas = await tx
        .select({
          unidade: coletas.unidade,
          numero: coletas.numero,
          tipo: coletas.tipo,
          situacao: coletas.situacao,
          etapa: coletas.etapa,
          situacaoEm: coletas.situacaoEm,
          limiteEm: coletas.limiteEm,
          cadastradaEm: coletas.cadastradaEm,
          diaCadastro: coletas.diaCadastro,
          coletadaEm: coletas.coletadaEm,
          canceladaEm: coletas.canceladaEm,
          solicitante: coletas.solicitante,
          remetenteCnpj: coletas.remetenteCnpj,
          remetenteNome: coletas.remetenteNome,
          remetenteCidade: coletas.remetenteCidade,
          destinatarioNome: coletas.destinatarioNome,
          destinoCidade: coletas.destinoCidade,
          motorista: coletas.motorista,
          placa: coletas.placa,
          volumes: coletas.volumes,
          pesoKg: coletas.pesoKg,
          valorMercadoria: coletas.valorMercadoria,
          tipoFrete: coletas.tipoFrete,
          notasFiscais: coletas.notasFiscais,
          observacao: coletas.observacao,
          cteSigla: coletas.cteSigla,
          cteNumero: coletas.cteNumero,
          cteTipoDocumento455: ctes.tipoDocumento455,
          cteTipoDocumento: ctes.tipoDocumento,
          cteEmissao: ctes.dataEmissao,
          prejudicadaHorario: coletas.prejudicadaHorario,
          ultimoEvento: sql<string | null>`${coletas.historico} -> 0 ->> 'texto'`,
        })
        .from(coletas)
        // Sigla + número identificam um CT-e só: a coleta não duplica (Q24 do dono).
        .leftJoin(
          ctes,
          and(
            eq(ctes.empresaId, coletas.empresaId),
            eq(ctes.sigla, coletas.cteSigla),
            eq(ctes.numero, coletas.cteNumero),
          ),
        )
        .where(
          and(
            eq(coletas.empresaId, empresaId),
            between(coletas.diaCadastro, f.inicio, f.fim),
            f.unidades.length > 0 ? inArray(coletas.unidade, f.unidades) : undefined,
            f.solicitantes.length > 0
              ? inArray(sql`coalesce(${coletas.solicitante}, '')`, f.solicitantes)
              : undefined,
            f.tipo ? eq(coletas.tipo, f.tipo) : undefined,
          ),
        )
        .limit(limite);
      return linhas.flatMap((l) =>
        l.diaCadastro === null
          ? []
          : [
              {
                ...l,
                diaCadastro: l.diaCadastro,
                pesoKg: numero(l.pesoKg),
                valorMercadoria: numero(l.valorMercadoria),
              },
            ],
      );
    },

    resumo: async (empresaId, inicio, fim) => {
      const unidades = await tx
        .selectDistinct({ unidade: coletas.unidade })
        .from(coletas)
        .where(eq(coletas.empresaId, empresaId))
        .orderBy(asc(coletas.unidade));
      const solicitantes = await tx
        .selectDistinct({ solicitante: coletas.solicitante })
        .from(coletas)
        .where(
          and(
            eq(coletas.empresaId, empresaId),
            between(coletas.diaCadastro, inicio, fim),
            isNotNull(coletas.solicitante),
          ),
        )
        .orderBy(asc(coletas.solicitante));
      const [agregado] = await tx
        .select({
          posicaoEm: sql<Date | null>`max(${coletas.relatorioEmitidoEm})`.mapWith(
            coletas.relatorioEmitidoEm,
          ),
          coberturaInicio: sql<string | null>`min(${coletas.diaCadastro})::text`,
          coberturaFim: sql<string | null>`max(${coletas.diaCadastro})::text`,
        })
        .from(coletas)
        .where(eq(coletas.empresaId, empresaId));
      return {
        unidades: unidades.map((u) => u.unidade),
        solicitantes: solicitantes.flatMap((s) => (s.solicitante === null ? [] : [s.solicitante])),
        posicaoEm: agregado?.posicaoEm ?? null,
        coberturaInicio: agregado?.coberturaInicio ?? null,
        coberturaFim: agregado?.coberturaFim ?? null,
      };
    },

    detalhe: async (empresaId, unidade, numeroDaColeta) => {
      const [linha] = await tx
        .select({
          observacao: coletas.observacao,
          mercadoria: coletas.mercadoria,
          setor: coletas.setor,
          romaneio: coletas.romaneio,
          cadastradaPor: coletas.cadastradaPor,
          comandadaEm: coletas.comandadaEm,
          limiteInicial: coletas.limiteInicial,
          relatorioEmitidoEm: coletas.relatorioEmitidoEm,
          historico: coletas.historico,
        })
        .from(coletas)
        .where(
          and(
            eq(coletas.empresaId, empresaId),
            eq(coletas.unidade, unidade),
            eq(coletas.numero, numeroDaColeta),
          ),
        );
      return linha ?? null;
    },
  };
}
