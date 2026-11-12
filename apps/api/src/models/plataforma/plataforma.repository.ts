import { type Transacao } from "@erp/db";
import {
  cargoPermissoes,
  codigosOcorrencia,
  configuracoes,
  ctes,
  empresaIntegracoes,
  empresaModulos,
  empresas,
  empresaUsuarios,
  plataformaAdmins,
  plataformaCargoPermissoes,
  plataformaCargos,
  plataformaIntegracoes,
  usuarios,
} from "@erp/db/schema";
import { ehPermissao, partesDaPermissao, type Permissao } from "@erp/shared/acesso/permissoes";
import { and, count, eq, gte, isNotNull, max, sql } from "drizzle-orm";

import { type EmpresaGravada, type RepositorioPlataforma } from "./plataforma.service";

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

    ultimoLoginPorEmpresa: async () => {
      const linhas = await tx
        .select({ empresaId: empresaUsuarios.empresaId, em: max(usuarios.ultimoLoginEm) })
        .from(empresaUsuarios)
        .innerJoin(usuarios, eq(usuarios.id, empresaUsuarios.usuarioId))
        .where(and(eq(empresaUsuarios.ativo, true), isNotNull(usuarios.ultimoLoginEm)))
        .groupBy(empresaUsuarios.empresaId);
      return new Map(linhas.flatMap((l) => (l.em ? [[l.empresaId, l.em] as const] : [])));
    },

    integracoesAtivasPorEmpresa: async () =>
      contagem(
        await tx
          .select({ chave: empresaIntegracoes.empresaId, total: count() })
          .from(empresaIntegracoes)
          .where(eq(empresaIntegracoes.ativo, true))
          .groupBy(empresaIntegracoes.empresaId),
      ),

    usuariosComAcessoDesde: async (desde) =>
      contagem(
        await tx
          .select({ chave: empresaUsuarios.empresaId, total: count() })
          .from(empresaUsuarios)
          .innerJoin(usuarios, eq(usuarios.id, empresaUsuarios.usuarioId))
          .where(and(eq(empresaUsuarios.ativo, true), gte(usuarios.ultimoLoginEm, desde)))
          .groupBy(empresaUsuarios.empresaId),
      ),

    integracoesLigadas: () =>
      tx
        .select({ empresaId: empresaIntegracoes.empresaId, tipo: empresaIntegracoes.tipo })
        .from(empresaIntegracoes)
        .where(eq(empresaIntegracoes.ativo, true)),

    // Mesmo universo das telas (sem cancelado no dia nem duplicado), pela data de emissão.
    ctesPorMes: async (desde) => {
      const mes = sql<string>`to_char(${ctes.dataEmissao}, 'YYYY-MM')`;
      const linhas = await tx
        .select({ mes, total: count() })
        .from(ctes)
        .where(and(eq(ctes.foraUniverso, false), gte(ctes.dataEmissao, desde)))
        .groupBy(mes);
      return linhas;
    },

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
      const linhas = await tx
        .select({
          cargo: cargoPermissoes.cargoChave,
          tela: cargoPermissoes.telaChave,
          acao: cargoPermissoes.acao,
        })
        .from(cargoPermissoes)
        .where(eq(cargoPermissoes.empresaId, modeloId));
      const permissoesDosCargos = new Map<string, Permissao[]>();
      for (const { cargo, tela, acao } of linhas) {
        const p = `${tela}.${acao}`;
        if (!ehPermissao(p)) continue;
        permissoesDosCargos.set(cargo, [...(permissoesDosCargos.get(cargo) ?? []), p]);
      }
      return {
        codigos: codigos.map(
          ({ empresaId: _e, atualizadoEm: _a, atualizadoPor: _p, ...codigo }) => codigo,
        ),
        configuracoes: configs,
        permissoesDosCargos,
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
          ativo: usuarios.ativo,
          cargo: plataformaAdmins.cargo,
          cargoRotulo: plataformaCargos.rotulo,
          ultimoLoginEm: usuarios.ultimoLoginEm,
          criadoEm: plataformaAdmins.criadoEm,
        })
        .from(plataformaAdmins)
        .innerJoin(usuarios, eq(usuarios.id, plataformaAdmins.usuarioId))
        .innerJoin(plataformaCargos, eq(plataformaCargos.chave, plataformaAdmins.cargo)),

    travarAdmins: () =>
      tx
        .select({ usuarioId: plataformaAdmins.usuarioId, cargo: plataformaAdmins.cargo })
        .from(plataformaAdmins)
        .for("update"),

    adicionarAdmin: async (usuarioId, cargo, criadoPor) => {
      await tx
        .insert(plataformaAdmins)
        .values({ usuarioId, cargo, criadoPor })
        .onConflictDoNothing();
    },

    trocarCargoDoAdmin: async (usuarioId, cargo) => {
      await tx
        .update(plataformaAdmins)
        .set({ cargo })
        .where(eq(plataformaAdmins.usuarioId, usuarioId));
    },

    removerAdmin: async (usuarioId) => {
      await tx.delete(plataformaAdmins).where(eq(plataformaAdmins.usuarioId, usuarioId));
    },

    cargosDaPlataforma: () => cargosDaPlataforma(tx, null),

    cargoDaPlataforma: async (chave) => (await cargosDaPlataforma(tx, chave))[0] ?? null,

    criarCargoDaPlataforma: async (cargo, permissoes) => {
      await tx.insert(plataformaCargos).values(cargo);
      await gravarPermissoesDoCargoDaPlataforma(tx, cargo.chave, permissoes);
    },

    alterarCargoDaPlataforma: async (chave, rotulo) => {
      await tx
        .update(plataformaCargos)
        .set({ rotulo, atualizadoEm: new Date() })
        .where(eq(plataformaCargos.chave, chave));
    },

    trocarPermissoesDoCargoDaPlataforma: async (chave, permissoes) => {
      await tx
        .delete(plataformaCargoPermissoes)
        .where(eq(plataformaCargoPermissoes.cargoChave, chave));
      await gravarPermissoesDoCargoDaPlataforma(tx, chave, permissoes);
    },

    excluirCargoDaPlataforma: async (chave) => {
      await tx.delete(plataformaCargos).where(eq(plataformaCargos.chave, chave));
    },
  };
}

/** Cargos da Plataforma (um só, se `chave`) com as permissões e quantos da equipe estão em cada. */
async function cargosDaPlataforma(tx: Transacao, chave: string | null) {
  const filtro = chave === null ? undefined : eq(plataformaCargos.chave, chave);
  const [linhas, permissoes, membros] = await Promise.all([
    tx.select().from(plataformaCargos).where(filtro),
    tx
      .select({
        cargo: plataformaCargoPermissoes.cargoChave,
        tela: plataformaCargoPermissoes.telaChave,
        acao: plataformaCargoPermissoes.acao,
      })
      .from(plataformaCargoPermissoes)
      .where(chave === null ? undefined : eq(plataformaCargoPermissoes.cargoChave, chave)),
    tx
      .select({ cargo: plataformaAdmins.cargo, total: count() })
      .from(plataformaAdmins)
      .groupBy(plataformaAdmins.cargo),
  ]);
  return linhas.map((c) => ({
    chave: c.chave,
    rotulo: c.rotulo,
    protegido: c.protegido,
    permissoes: permissoes.filter((p) => p.cargo === c.chave).map((p) => `${p.tela}.${p.acao}`),
    usuarios: membros.find((m) => m.cargo === c.chave)?.total ?? 0,
  }));
}

async function gravarPermissoesDoCargoDaPlataforma(
  tx: Transacao,
  chave: string,
  permissoes: readonly Permissao[],
): Promise<void> {
  if (permissoes.length === 0) return;
  await tx.insert(plataformaCargoPermissoes).values(
    permissoes.map((p) => {
      const { tela, acao } = partesDaPermissao(p);
      return { cargoChave: chave, telaChave: tela, acao };
    }),
  );
}
