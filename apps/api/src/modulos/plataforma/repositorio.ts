import { type Transacao } from "@erp/db";
import {
  cargoTelas,
  codigosOcorrencia,
  configuracoes,
  empresaIntegracoes,
  empresaModulos,
  empresas,
  empresaUsuarios,
  plataformaAdmins,
  plataformaIntegracoes,
  usuarios,
} from "@erp/db/schema";
import { ehTela, type Tela } from "@erp/shared/acesso/telas";
import { count, eq, sql } from "drizzle-orm";

import { type EmpresaGravada, type RepositorioPlataforma } from "./casos-de-uso";

const colunasDaEmpresa = {
  id: empresas.id,
  slug: empresas.slug,
  nome: empresas.nome,
  nomeCurto: empresas.nomeCurto,
  razaoSocial: empresas.razaoSocial,
  cnpj: empresas.cnpj,
  dominioSsw: empresas.dominioSsw,
  logoCaminho: empresas.logoCaminho,
  corPrimaria: empresas.corPrimaria,
  corDestaque: empresas.corDestaque,
  slogan: empresas.slogan,
  fuso: empresas.fuso,
  status: empresas.status,
  criadoEm: empresas.criadoEm,
  atualizadoEm: empresas.atualizadoEm,
};

const colunasDaLiberacao = {
  empresaId: empresaModulos.empresaId,
  modulo: empresaModulos.moduloChave,
  ativo: empresaModulos.ativo,
  inicio: empresaModulos.inicio,
  fim: empresaModulos.fim,
  observacao: empresaModulos.observacao,
  atualizadoEm: empresaModulos.atualizadoEm,
};

function contagem(linhas: { chave: string; total: number }[]): Map<string, number> {
  return new Map(linhas.map((l) => [l.chave, l.total]));
}

export function criarRepositorioPlataforma(tx: Transacao): RepositorioPlataforma {
  return {
    empresas: (): Promise<EmpresaGravada[]> => tx.select(colunasDaEmpresa).from(empresas),

    empresa: async (id) => {
      const [linha] = await tx.select(colunasDaEmpresa).from(empresas).where(eq(empresas.id, id));
      return linha ?? null;
    },

    slugEmUso: async (slug) => {
      const linhas = await tx
        .select({ id: empresas.id })
        .from(empresas)
        .where(eq(empresas.slug, slug));
      return linhas.length > 0;
    },

    criarEmpresa: async (e) => {
      await tx.insert(empresas).values({
        id: e.id,
        slug: e.slug,
        nome: e.nome,
        nomeCurto: e.nomeCurto,
        cnpj: e.cnpj,
        status: "implantacao",
        criadoPor: e.criadoPor,
        atualizadoPor: e.criadoPor,
      });
    },

    alterarEmpresa: async (id, dados, atualizadoPor) => {
      await tx
        .update(empresas)
        .set({ ...dados, atualizadoPor, atualizadoEm: new Date() })
        .where(eq(empresas.id, id));
    },

    definirLogo: async (id, caminho, atualizadoPor) => {
      await tx
        .update(empresas)
        .set({ logoCaminho: caminho, atualizadoPor, atualizadoEm: new Date() })
        .where(eq(empresas.id, id));
    },

    usuariosAtivosPorEmpresa: async () =>
      contagem(
        await tx
          .select({ chave: empresaUsuarios.empresaId, total: count() })
          .from(empresaUsuarios)
          .where(eq(empresaUsuarios.ativo, true))
          .groupBy(empresaUsuarios.empresaId),
      ),

    integracoesAtivasPorEmpresa: async () =>
      contagem(
        await tx
          .select({ chave: empresaIntegracoes.empresaId, total: count() })
          .from(empresaIntegracoes)
          .where(eq(empresaIntegracoes.ativo, true))
          .groupBy(empresaIntegracoes.empresaId),
      ),

    liberacoes: (empresaId) =>
      tx
        .select(colunasDaLiberacao)
        .from(empresaModulos)
        .where(empresaId ? eq(empresaModulos.empresaId, empresaId) : undefined),

    gravarModulo: async (empresaId, modulo, dados, atualizadoPor) => {
      const valores = { ...dados, atualizadoPor, atualizadoEm: new Date() };
      await tx
        .insert(empresaModulos)
        .values({ empresaId, moduloChave: modulo, ...valores })
        .onConflictDoUpdate({
          target: [empresaModulos.empresaId, empresaModulos.moduloChave],
          set: valores,
        });
    },

    vinculos: (empresaId) =>
      tx
        .select({
          usuarioId: empresaUsuarios.usuarioId,
          nome: usuarios.nome,
          email: usuarios.email,
          papel: empresaUsuarios.papel,
          departamento: empresaUsuarios.departamentoChave,
          ativo: empresaUsuarios.ativo,
          criadoEm: empresaUsuarios.criadoEm,
          // Contexto de Plataforma: a RLS deixa ver os vínculos de todas as empresas.
          totalEmpresas: sql<number>`(select count(*)::int from erp.empresa_usuarios outros
            where outros.usuario_id = ${empresaUsuarios.usuarioId})`,
          adminPlataforma: sql<boolean>`exists (select 1 from erp.plataforma_admins pa
            where pa.usuario_id = ${empresaUsuarios.usuarioId})`,
        })
        .from(empresaUsuarios)
        .innerJoin(usuarios, eq(usuarios.id, empresaUsuarios.usuarioId))
        .where(eq(empresaUsuarios.empresaId, empresaId)),

    integracoes: async (empresaId) =>
      tx
        .select({
          tipo: empresaIntegracoes.tipo,
          ativo: empresaIntegracoes.ativo,
          parametros: empresaIntegracoes.parametros,
          segredoDefinidoEm: empresaIntegracoes.segredoDefinidoEm,
          ultimoTesteEm: empresaIntegracoes.ultimoTesteEm,
          ultimoTesteOk: empresaIntegracoes.ultimoTesteOk,
          ultimoTesteMsg: empresaIntegracoes.ultimoTesteMsg,
          atualizadoEm: empresaIntegracoes.atualizadoEm,
        })
        .from(empresaIntegracoes)
        .where(eq(empresaIntegracoes.empresaId, empresaId)),

    gravarIntegracao: async (empresaId, tipo, dados, atualizadoPor) => {
      const valores = { ...dados, atualizadoPor, atualizadoEm: new Date() };
      await tx
        .insert(empresaIntegracoes)
        .values({ empresaId, tipo, ...valores })
        .onConflictDoUpdate({
          target: [empresaIntegracoes.empresaId, empresaIntegracoes.tipo],
          set: valores,
        });
    },

    gravarSegredo: async (empresaId, tipo, segredo, atualizadoPor) => {
      const valores = {
        segredoCifrado: segredo?.cifrado ?? null,
        segredoVersaoChave: segredo?.versaoChave ?? null,
        segredoDefinidoEm: segredo?.definidoEm ?? null,
        atualizadoPor,
        atualizadoEm: new Date(),
      };
      // Webhook: o segredo que sai vira o "anterior" (o reprocesso aceita eventos assinados com ele).
      const guardaAnterior =
        tipo === "ssw_webhook"
          ? {
              segredoAnteriorCifrado: sql<string>`coalesce(${empresaIntegracoes.segredoCifrado}, ${empresaIntegracoes.segredoAnteriorCifrado})`,
              segredoAnteriorVersaoChave: sql<number>`coalesce(${empresaIntegracoes.segredoVersaoChave}, ${empresaIntegracoes.segredoAnteriorVersaoChave})`,
            }
          : {};
      await tx
        .insert(empresaIntegracoes)
        .values({ empresaId, tipo, ativo: false, ...valores })
        .onConflictDoUpdate({
          target: [empresaIntegracoes.empresaId, empresaIntegracoes.tipo],
          set: { ...valores, ...guardaAnterior },
        });
    },

    integracoesDaPlataforma: async () => {
      const t = plataformaIntegracoes;
      const linhas = await tx
        .select({
          tipo: t.tipo,
          parametros: t.parametros,
          cifrado: t.segredoCifrado,
          versaoChave: t.segredoVersaoChave,
          segredoDefinidoEm: t.segredoDefinidoEm,
          atualizadoEm: t.atualizadoEm,
        })
        .from(t);
      return linhas.map(({ cifrado, versaoChave, ...l }) => ({
        ...l,
        segredo: cifrado === null || versaoChave === null ? null : { cifrado, versaoChave },
      }));
    },

    gravarIntegracaoDaPlataforma: async (tipo, parametros, atualizadoPor) => {
      const valores = { parametros, atualizadoPor, atualizadoEm: new Date() };
      await tx
        .insert(plataformaIntegracoes)
        .values({ tipo, ...valores })
        .onConflictDoUpdate({ target: plataformaIntegracoes.tipo, set: valores });
    },

    gravarSegredoDaPlataforma: async (tipo, segredo, atualizadoPor) => {
      const valores = {
        segredoCifrado: segredo?.cifrado ?? null,
        segredoVersaoChave: segredo?.versaoChave ?? null,
        segredoDefinidoEm: segredo?.definidoEm ?? null,
        atualizadoPor,
        atualizadoEm: new Date(),
      };
      await tx
        .insert(plataformaIntegracoes)
        .values({ tipo, ...valores })
        .onConflictDoUpdate({ target: plataformaIntegracoes.tipo, set: valores });
    },

    copiaDoModelo: async (modeloId) => {
      const codigos = await tx
        .select()
        .from(codigosOcorrencia)
        .where(eq(codigosOcorrencia.empresaId, modeloId));
      const configs = await tx
        .select({
          chave: configuracoes.chave,
          valor: configuracoes.valor,
          descricao: configuracoes.descricao,
          grupo: configuracoes.grupo,
        })
        .from(configuracoes)
        .where(eq(configuracoes.empresaId, modeloId));
      const telas = await tx
        .select({ cargo: cargoTelas.cargoChave, tela: cargoTelas.telaChave })
        .from(cargoTelas)
        .where(eq(cargoTelas.empresaId, modeloId));
      const telasDosCargos = new Map<string, Tela[]>();
      for (const { cargo, tela } of telas) {
        if (ehTela(tela)) telasDosCargos.set(cargo, [...(telasDosCargos.get(cargo) ?? []), tela]);
      }
      return {
        codigos: codigos.map(
          ({ empresaId: _e, atualizadoEm: _a, atualizadoPor: _p, ...codigo }) => codigo,
        ),
        configuracoes: configs,
        telasDosCargos,
      };
    },

    copiarParaEmpresa: async (empresaId, copia) => {
      if (copia.codigos.length > 0) {
        await tx
          .insert(codigosOcorrencia)
          .values(copia.codigos.map((c) => ({ ...c, empresaId })))
          .onConflictDoNothing();
      }
      if (copia.configuracoes.length > 0) {
        await tx
          .insert(configuracoes)
          .values(copia.configuracoes.map((c) => ({ ...c, empresaId })))
          .onConflictDoNothing();
      }
    },

    admins: () =>
      tx
        .select({
          usuarioId: plataformaAdmins.usuarioId,
          nome: usuarios.nome,
          email: usuarios.email,
          criadoEm: plataformaAdmins.criadoEm,
        })
        .from(plataformaAdmins)
        .innerJoin(usuarios, eq(usuarios.id, plataformaAdmins.usuarioId)),

    travarAdmins: async () => {
      const linhas = await tx.select().from(plataformaAdmins).for("update");
      return linhas.length;
    },

    adicionarAdmin: async (usuarioId, criadoPor) => {
      await tx.insert(plataformaAdmins).values({ usuarioId, criadoPor }).onConflictDoNothing();
    },

    removerAdmin: async (usuarioId) => {
      await tx.delete(plataformaAdmins).where(eq(plataformaAdmins.usuarioId, usuarioId));
    },
  };
}
