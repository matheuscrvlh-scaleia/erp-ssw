import {
  atribuicoes,
  comInstantes,
  type Sql,
  sql,
  type Transacao,
  valoresDeInsercao,
} from "@erp/db";
import { ehPermissao, partesDaPermissao, type Permissao } from "@erp/shared/access/permissions";

import {
  type AdminGravado,
  type CodigoDoModelo,
  type EmpresaGravada,
  type IntegracaoGravada,
  type LiberacaoGravada,
  type RepositorioPlataforma,
} from "./platform.service";

type Retorno<K extends keyof RepositorioPlataforma> = Awaited<ReturnType<RepositorioPlataforma[K]>>;

const SELECT_EMPRESA = sql`
  select id, slug, nome, nome_curto as "nomeCurto", razao_social as "razaoSocial", cnpj,
         dominio_ssw as "dominioSsw", logo_caminho as "logoCaminho",
         favicon_caminho as "faviconCaminho",
         cor_primaria as "corPrimaria", cor_destaque as "corDestaque", slogan, fuso, status,
         criado_em as "criadoEm", atualizado_em as "atualizadoEm"
  from erp.empresas`;

/** Contagem por chave (`chave`, `total`). */
async function contagem(tx: Transacao, consulta: Sql): Promise<Map<string, number>> {
  const linhas = await tx.consultar<{ chave: string; total: number }>(consulta);
  return new Map(linhas.map((l) => [l.chave, l.total]));
}

/** Segredo da integração; no webhook, o que sai vira o "anterior". */
function gravacaoDoSegredo(
  segredo: { cifrado: string; versaoChave: number; definidoEm: Date } | null,
  atualizadoPor: string,
) {
  return {
    segredoCifrado: segredo?.cifrado ?? null,
    segredoVersaoChave: segredo?.versaoChave ?? null,
    segredoDefinidoEm: segredo?.definidoEm ?? null,
    atualizadoPor,
  };
}

export function criarRepositorioPlataforma(tx: Transacao): RepositorioPlataforma {
  return {
    empresas: async () =>
      comInstantes<EmpresaGravada>(await tx.consultar(SELECT_EMPRESA), [
        "criadoEm",
        "atualizadoEm",
      ]),

    empresa: async (id) => {
      const [linha] = comInstantes<EmpresaGravada>(
        await tx.consultar(sql`${SELECT_EMPRESA} where id = ${id}`),
        ["criadoEm", "atualizadoEm"],
      );
      return linha ?? null;
    },

    slugEmUso: async (slug) => {
      const linhas = await tx.consultar(sql`select 1 from erp.empresas where slug = ${slug}`);
      return linhas.length > 0;
    },

    criarEmpresa: async (e) => {
      await tx.executar(sql`
        insert into erp.empresas (id, slug, nome, nome_curto, cnpj, status, criado_por,
                                  atualizado_por)
        values (${e.id}, ${e.slug}, ${e.nome}, ${e.nomeCurto}, ${e.cnpj}, 'implantacao',
                ${e.criadoPor}, ${e.criadoPor})`);
    },

    alterarEmpresa: async (id, dados, atualizadoPor) => {
      await tx.executar(sql`
        update erp.empresas
        set ${atribuicoes({ ...dados, atualizadoPor })}, atualizado_em = now()
        where id = ${id}`);
    },

    definirImagem: async (id, imagem, caminho, atualizadoPor) => {
      const coluna = imagem === "logo" ? sql`logo_caminho` : sql`favicon_caminho`;
      await tx.executar(sql`
        update erp.empresas
        set ${coluna} = ${caminho}, atualizado_por = ${atualizadoPor}, atualizado_em = now()
        where id = ${id}`);
    },

    usuariosAtivosPorEmpresa: () =>
      contagem(
        tx,
        sql`select empresa_id as chave, count(*)::int as total
            from erp.empresa_usuarios where ativo group by empresa_id`,
      ),

    ultimoLoginPorEmpresa: async () => {
      const linhas = await tx.consultar<{ empresaId: string; em: string }>(sql`
        select eu.empresa_id as "empresaId", max(u.ultimo_login_em) as em
        from erp.empresa_usuarios eu
        join erp.usuarios u on u.id = eu.usuario_id
        where eu.ativo and u.ultimo_login_em is not null
        group by eu.empresa_id`);
      return new Map(linhas.map((l) => [l.empresaId, new Date(l.em)]));
    },

    integracoesAtivasPorEmpresa: () =>
      contagem(
        tx,
        sql`select empresa_id as chave, count(*)::int as total
            from erp.empresa_integracoes where ativo group by empresa_id`,
      ),

    usuariosComAcessoDesde: (desde) =>
      contagem(
        tx,
        sql`select eu.empresa_id as chave, count(*)::int as total
            from erp.empresa_usuarios eu
            join erp.usuarios u on u.id = eu.usuario_id
            where eu.ativo and u.ultimo_login_em >= ${desde}
            group by eu.empresa_id`,
      ),

    integracoesLigadas: () =>
      tx.consultar(sql`
        select empresa_id as "empresaId", tipo from erp.empresa_integracoes where ativo`),

    // Mesmo universo das telas (sem cancelado no dia nem duplicado), pela data de emissão.
    ctesPorMes: (desde) =>
      tx.consultar(sql`
        select to_char(data_emissao, 'YYYY-MM') as mes, count(*)::int as total
        from erp.ctes
        where not fora_universo and data_emissao >= ${desde}
        group by 1`),

    liberacoes: async (empresaId) =>
      comInstantes<LiberacaoGravada>(
        await tx.consultar(sql`
          select empresa_id as "empresaId", modulo_chave as modulo, ativo, inicio, fim,
                 observacao, atualizado_em as "atualizadoEm"
          from erp.empresa_modulos
          ${empresaId ? sql`where empresa_id = ${empresaId}` : sql.vazio()}`),
        ["atualizadoEm"],
      ),

    gravarModulo: async (empresaId, modulo, dados, atualizadoPor) => {
      await tx.executar(sql`
        insert into erp.empresa_modulos (empresa_id, modulo_chave, ativo, inicio, fim, observacao,
                                         atualizado_por, atualizado_em)
        values (${empresaId}, ${modulo}, ${dados.ativo}, ${dados.inicio}, ${dados.fim},
                ${dados.observacao}, ${atualizadoPor}, now())
        on conflict (empresa_id, modulo_chave) do update
        set ativo = excluded.ativo, inicio = excluded.inicio, fim = excluded.fim,
            observacao = excluded.observacao, atualizado_por = excluded.atualizado_por,
            atualizado_em = excluded.atualizado_em`);
    },

    integracoes: async (empresaId) =>
      comInstantes<IntegracaoGravada>(
        await tx.consultar(sql`
          select tipo, ativo, parametros, segredo_definido_em as "segredoDefinidoEm",
                 ultimo_teste_em as "ultimoTesteEm", ultimo_teste_ok as "ultimoTesteOk",
                 ultimo_teste_msg as "ultimoTesteMsg", atualizado_em as "atualizadoEm"
          from erp.empresa_integracoes where empresa_id = ${empresaId}`),
        ["segredoDefinidoEm", "ultimoTesteEm", "atualizadoEm"],
      ),

    gravarIntegracao: async (empresaId, tipo, dados, atualizadoPor) => {
      await tx.executar(sql`
        insert into erp.empresa_integracoes (empresa_id, tipo, ativo, parametros, atualizado_por,
                                             atualizado_em)
        values (${empresaId}, ${tipo}, ${dados.ativo}, ${sql.json(dados.parametros)},
                ${atualizadoPor}, now())
        on conflict (empresa_id, tipo) do update
        set ativo = excluded.ativo, parametros = excluded.parametros,
            atualizado_por = excluded.atualizado_por, atualizado_em = excluded.atualizado_em`);
    },

    gravarSegredo: async (empresaId, tipo, segredo, atualizadoPor) => {
      const s = gravacaoDoSegredo(segredo, atualizadoPor);
      // Webhook: o segredo que sai vira o "anterior" (o reprocesso aceita eventos assinados com ele).
      const guardaAnterior =
        tipo === "ssw_webhook"
          ? sql`, segredo_anterior_cifrado = coalesce(empresa_integracoes.segredo_cifrado,
                  empresa_integracoes.segredo_anterior_cifrado),
                segredo_anterior_versao_chave = coalesce(empresa_integracoes.segredo_versao_chave,
                  empresa_integracoes.segredo_anterior_versao_chave)`
          : sql.vazio();
      await tx.executar(sql`
        insert into erp.empresa_integracoes (empresa_id, tipo, ativo, segredo_cifrado,
          segredo_versao_chave, segredo_definido_em, atualizado_por, atualizado_em)
        values (${empresaId}, ${tipo}, false, ${s.segredoCifrado}, ${s.segredoVersaoChave},
                ${s.segredoDefinidoEm}, ${s.atualizadoPor}, now())
        on conflict (empresa_id, tipo) do update
        set segredo_cifrado = excluded.segredo_cifrado,
            segredo_versao_chave = excluded.segredo_versao_chave,
            segredo_definido_em = excluded.segredo_definido_em,
            atualizado_por = excluded.atualizado_por, atualizado_em = excluded.atualizado_em
            ${guardaAnterior}`);
    },

    integracoesDaPlataforma: async () => {
      const linhas = comInstantes<
        Omit<Retorno<"integracoesDaPlataforma">[number], "segredo"> & {
          cifrado: string | null;
          versaoChave: number | null;
        }
      >(
        await tx.consultar(sql`
          select tipo, parametros, segredo_cifrado as cifrado,
                 segredo_versao_chave as "versaoChave", segredo_definido_em as "segredoDefinidoEm",
                 atualizado_em as "atualizadoEm"
          from erp.plataforma_integracoes`),
        ["segredoDefinidoEm", "atualizadoEm"],
      );
      return linhas.map(({ cifrado, versaoChave, ...l }) => ({
        ...l,
        segredo: cifrado === null || versaoChave === null ? null : { cifrado, versaoChave },
      }));
    },

    gravarIntegracaoDaPlataforma: async (tipo, parametros, atualizadoPor) => {
      await tx.executar(sql`
        insert into erp.plataforma_integracoes (tipo, parametros, atualizado_por, atualizado_em)
        values (${tipo}, ${sql.json(parametros)}, ${atualizadoPor}, now())
        on conflict (tipo) do update
        set parametros = excluded.parametros, atualizado_por = excluded.atualizado_por,
            atualizado_em = excluded.atualizado_em`);
    },

    gravarSegredoDaPlataforma: async (tipo, segredo, atualizadoPor) => {
      const s = gravacaoDoSegredo(segredo, atualizadoPor);
      await tx.executar(sql`
        insert into erp.plataforma_integracoes (tipo, segredo_cifrado, segredo_versao_chave,
          segredo_definido_em, atualizado_por, atualizado_em)
        values (${tipo}, ${s.segredoCifrado}, ${s.segredoVersaoChave}, ${s.segredoDefinidoEm},
                ${s.atualizadoPor}, now())
        on conflict (tipo) do update
        set segredo_cifrado = excluded.segredo_cifrado,
            segredo_versao_chave = excluded.segredo_versao_chave,
            segredo_definido_em = excluded.segredo_definido_em,
            atualizado_por = excluded.atualizado_por, atualizado_em = excluded.atualizado_em`);
    },

    copiaDoModelo: async (modeloId) => {
      const codigos = await tx.consultar<CodigoDoModelo>(sql`
        select codigo, descricao, tipo_ssw as "tipoSsw", processo_ssw as "processoSsw",
               tipo_ssw_manual as "tipoSswManual", responsavel,
               letra_responsavel as "letraResponsavel", penaliza, ativo,
               pendente_classificacao as "pendenteClassificacao",
               pendencia_acompanhada as "pendenciaAcompanhada", notas
        from erp.codigos_ocorrencia where empresa_id = ${modeloId}`);
      const configs = await tx.consultar<Retorno<"copiaDoModelo">["configuracoes"][number]>(sql`
        select chave, valor, descricao, grupo from erp.configuracoes
        where empresa_id = ${modeloId}`);
      const linhas = await tx.consultar<{ cargo: string; tela: string; acao: string }>(sql`
        select cargo_chave as cargo, tela_chave as tela, acao from erp.cargo_permissoes
        where empresa_id = ${modeloId}`);
      const permissoesDosCargos = new Map<string, Permissao[]>();
      for (const { cargo, tela, acao } of linhas) {
        const p = `${tela}.${acao}`;
        if (!ehPermissao(p)) continue;
        permissoesDosCargos.set(cargo, [...(permissoesDosCargos.get(cargo) ?? []), p]);
      }
      return { codigos, configuracoes: configs, permissoesDosCargos };
    },

    copiarParaEmpresa: async (empresaId, copia) => {
      if (copia.codigos.length > 0) {
        await tx.executar(sql`
          insert into erp.codigos_ocorrencia
            ${valoresDeInsercao(copia.codigos.map((c) => ({ ...c, empresaId })))}
          on conflict do nothing`);
      }
      if (copia.configuracoes.length > 0) {
        await tx.executar(sql`
          insert into erp.configuracoes
            ${valoresDeInsercao(copia.configuracoes.map((c) => ({ ...c, empresaId })))}
          on conflict do nothing`);
      }
    },

    admins: async () =>
      comInstantes<AdminGravado>(
        await tx.consultar(sql`
          select pa.usuario_id as "usuarioId", u.nome, u.email, u.ativo, pa.cargo,
                 pc.rotulo as "cargoRotulo", u.ultimo_login_em as "ultimoLoginEm",
                 pa.criado_em as "criadoEm"
          from erp.plataforma_admins pa
          join erp.usuarios u on u.id = pa.usuario_id
          join erp.plataforma_cargos pc on pc.chave = pa.cargo`),
        ["ultimoLoginEm", "criadoEm"],
      ),

    travarAdmins: () =>
      tx.consultar(sql`
        select usuario_id as "usuarioId", cargo from erp.plataforma_admins for update`),

    adicionarAdmin: async (usuarioId, cargo, criadoPor) => {
      await tx.executar(sql`
        insert into erp.plataforma_admins (usuario_id, cargo, criado_por)
        values (${usuarioId}, ${cargo}, ${criadoPor})
        on conflict do nothing`);
    },

    trocarCargoDoAdmin: async (usuarioId, cargo) => {
      await tx.executar(sql`
        update erp.plataforma_admins set cargo = ${cargo} where usuario_id = ${usuarioId}`);
    },

    removerAdmin: async (usuarioId) => {
      await tx.executar(sql`delete from erp.plataforma_admins where usuario_id = ${usuarioId}`);
    },

    cargosDaPlataforma: () => cargosDaPlataforma(tx, null),

    cargoDaPlataforma: async (chave) => (await cargosDaPlataforma(tx, chave))[0] ?? null,

    criarCargoDaPlataforma: async (cargo, permissoes) => {
      await tx.executar(sql`insert into erp.plataforma_cargos ${valoresDeInsercao([cargo])}`);
      await gravarPermissoesDoCargoDaPlataforma(tx, cargo.chave, permissoes);
    },

    alterarCargoDaPlataforma: async (chave, rotulo) => {
      await tx.executar(sql`
        update erp.plataforma_cargos set rotulo = ${rotulo}, atualizado_em = now()
        where chave = ${chave}`);
    },

    trocarPermissoesDoCargoDaPlataforma: async (chave, permissoes) => {
      await tx.executar(sql`
        delete from erp.plataforma_cargo_permissoes where cargo_chave = ${chave}`);
      await gravarPermissoesDoCargoDaPlataforma(tx, chave, permissoes);
    },

    excluirCargoDaPlataforma: async (chave) => {
      await tx.executar(sql`delete from erp.plataforma_cargos where chave = ${chave}`);
    },
  };
}

/** Cargos da Plataforma (um só, se `chave`) com as permissões e quantos da equipe estão em cada. */
async function cargosDaPlataforma(tx: Transacao, chave: string | null) {
  const doCargo = (coluna: Sql) => (chave === null ? sql.vazio() : sql`where ${coluna} = ${chave}`);
  const linhas = await tx.consultar<{ chave: string; rotulo: string; protegido: boolean }>(sql`
    select chave, rotulo, protegido from erp.plataforma_cargos ${doCargo(sql`chave`)}`);
  const permissoes = await tx.consultar<{ cargo: string; tela: string; acao: string }>(sql`
    select cargo_chave as cargo, tela_chave as tela, acao from erp.plataforma_cargo_permissoes
    ${doCargo(sql`cargo_chave`)}`);
  const membros = await tx.consultar<{ cargo: string; total: number }>(sql`
    select cargo, count(*)::int as total from erp.plataforma_admins group by cargo`);
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
  const linhas = permissoes.map((p) => {
    const { tela, acao } = partesDaPermissao(p);
    return { cargoChave: chave, telaChave: tela, acao };
  });
  await tx.executar(sql`insert into erp.plataforma_cargo_permissoes ${valoresDeInsercao(linhas)}`);
}
