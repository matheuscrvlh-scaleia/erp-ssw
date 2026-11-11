import { randomUUID } from "node:crypto";

import { type ContextoBanco } from "@erp/db";
import { configuracoesVigentes } from "@erp/dominio/configuracoes";
import { ehTela, type Tela } from "@erp/shared/acesso/telas";
import { type OrigemIntegracao } from "@erp/shared/contratos/auditoria";
import { type TipoIntegracao, type TipoIntegracaoPlataforma } from "@erp/shared/plataforma";

import { type RepositorioCadastros } from "../modulos/cadastros/casos-de-uso";
import { type RepositorioConfiguracoes } from "../modulos/configuracoes/casos-de-uso";
import { type Execucao, type RepositorioLogs } from "../modulos/logs/casos-de-uso";
import {
  type CopiaDoModelo,
  type EmpresaGravada,
  type IntegracaoDaPlataformaGravada,
  type IntegracaoGravada,
  type RepositorioPlataforma,
} from "../modulos/plataforma/casos-de-uso";
import { type RegraGravada, type RepositorioPrazos } from "../modulos/prazos/casos-de-uso";
import { type RepositorioUsuarios } from "../modulos/usuarios/casos-de-uso";
import { type BancoEmMemoria } from "./banco-em-memoria";

/*
 * Repositórios falsos de Admin, Plataforma e Logs, sobre o estado do `BancoEmMemoria`. Como o
 * banco falso, não simula SQL; a RLS só é simulada onde o teste de segurança depende dela
 * (vínculos de uma pessoa em todas as empresas).
 */

interface DepartamentoFalso {
  empresaId: string;
  chave: string;
  rotulo: string;
  descricao: string | null;
  ativo: boolean;
  protegido: boolean;
}

interface ConfiguracaoFalsa {
  empresaId: string;
  chave: string;
  valor: string;
  descricao: string;
  grupo: string;
  atualizadoEm: Date;
  atualizadoPor: string | null;
}

interface IntegracaoFalsa extends IntegracaoGravada {
  empresaId: string;
  segredoCifrado: string | null;
  segredoVersaoChave: number | null;
  segredoAnteriorCifrado: string | null;
  segredoAnteriorVersaoChave: number | null;
}

/** Só dados (sem métodos): a transação falsa copia e restaura este estado. */
export class EstadoDeAdministracao {
  detalhesDaEmpresa = new Map<
    string,
    Pick<
      EmpresaGravada,
      "slug" | "razaoSocial" | "cnpj" | "dominioSsw" | "criadoEm" | "atualizadoEm"
    >
  >();
  departamentos: DepartamentoFalso[] = [];
  configuracoes: ConfiguracaoFalsa[] = [];
  prazos: (RegraGravada & { empresaId: string })[] = [];
  ctes: {
    empresaId: string;
    filial: string | null;
    unidadeCidade: string | null;
    parceiroCnpj: string | null;
    parceiroNome: string | null;
  }[] = [];
  codigos: { empresaId: string; codigo: number; descricao: string }[] = [];
  observacoesDeModulo = new Map<string, { observacao: string | null; atualizadoEm: Date }>();
  integracoes: IntegracaoFalsa[] = [];
  integracoesDaPlataforma: IntegracaoDaPlataformaGravada[] = [];
  execucoes: { empresaId: string; origem: OrigemIntegracao; execucao: Execucao }[] = [];
  adminsDesde = new Map<string, Date>();
  logos: string[] = [];
}

const agoraFixo = () => new Date("2026-11-10T12:00:00Z");

export function criarRepositoriosDeAdministracao(
  banco: BancoEmMemoria,
  contexto: ContextoBanco,
): {
  usuarios: RepositorioUsuarios;
  cadastros: RepositorioCadastros;
  configuracoes: RepositorioConfiguracoes;
  prazos: RepositorioPrazos;
  logs: RepositorioLogs;
  plataforma: RepositorioPlataforma;
} {
  const adm = banco.adm;
  const chaveCargo = (empresaId: string, chave: string) => `${empresaId}:${chave}`;
  const telasValidas = (telas: readonly string[]): Tela[] => telas.filter(ehTela);
  const cargosDaEmpresa = (empresaId: string) =>
    [...banco.cargos.entries()]
      .filter(([k]) => k.startsWith(`${empresaId}:`))
      .map(([k, c]) => ({ chave: k.slice(empresaId.length + 1), ...c }));
  const usoNaEmpresa = (empresaId: string, campo: "papel" | "departamento", chave: string) =>
    banco.vinculos.filter((v) => v.empresaId === empresaId && v[campo] === chave).length;

  function empresaGravada(id: string): EmpresaGravada | null {
    const base = banco.empresas.find((e) => e.id === id);
    if (!base) return null;
    const detalhes = adm.detalhesDaEmpresa.get(id) ?? {
      slug: base.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      razaoSocial: null,
      cnpj: null,
      dominioSsw: null,
      criadoEm: new Date("2026-01-01"),
      atualizadoEm: new Date("2026-01-01"),
    };
    const status =
      base.status === "ativa" ||
      base.status === "implantacao" ||
      base.status === "suspensa" ||
      base.status === "encerrada"
        ? base.status
        : "ativa";
    return { ...base, ...detalhes, status };
  }

  const usuarios: RepositorioUsuarios = {
    listar: (empresaId) =>
      Promise.resolve(
        banco.vinculos
          .filter((v) => v.empresaId === empresaId)
          .map((v) => {
            const u = banco.usuario(v.usuarioId);
            return {
              id: u.id,
              nome: u.nome,
              email: u.email,
              temSenha: u.senhaHash !== null,
              contaAtiva: u.ativo,
              papel: v.papel,
              departamento: v.departamento,
              setor: v.setor,
              ativo: v.ativo,
            };
          }),
      ),
    excecoes: (empresaId) =>
      Promise.resolve(
        banco.excecoes.flatMap((e) =>
          e.empresaId === empresaId && ehTela(e.tela)
            ? [{ usuarioId: e.usuarioId, tela: e.tela, permitido: e.permitido }]
            : [],
        ),
      ),
    contaPorEmail: (email) => {
      const u = banco.usuarios.find((x) => x.email === email);
      return Promise.resolve(
        u
          ? { id: u.id, email: u.email, nome: u.nome, ativo: u.ativo, temSenha: !!u.senhaHash }
          : null,
      );
    },
    conta: (id) => {
      const u = banco.usuarios.find((x) => x.id === id);
      return Promise.resolve(
        u
          ? { id: u.id, email: u.email, nome: u.nome, ativo: u.ativo, temSenha: !!u.senhaHash }
          : null,
      );
    },
    vinculo: (empresaId, usuarioId) => {
      const v = banco.vinculos.find((x) => x.empresaId === empresaId && x.usuarioId === usuarioId);
      return Promise.resolve(
        v ? { papel: v.papel, departamento: v.departamento, setor: v.setor, ativo: v.ativo } : null,
      );
    },
    // RLS simulada: fora do contexto de Plataforma, só aparecem os vínculos da empresa da sessão.
    vinculosEmTodasAsEmpresas: (usuarioId) =>
      Promise.resolve(
        banco.vinculos
          .filter((v) => v.usuarioId === usuarioId)
          .filter((v) => contexto.plataforma || v.empresaId === contexto.empresaId)
          .map((v) => ({ empresaId: v.empresaId, papel: v.papel })),
      ),
    existeCargo: (empresaId, chave) =>
      Promise.resolve(banco.cargos.has(chaveCargo(empresaId, chave))),
    existeDepartamento: (empresaId, chave) =>
      Promise.resolve(
        adm.departamentos.some((d) => d.empresaId === empresaId && d.chave === chave),
      ),
    criarConta: (conta) => {
      const u = banco.criarUsuario({
        email: conta.email,
        nome: conta.nome,
        senhaHash: conta.senhaHash,
        senhaAlgoritmo: conta.senhaHash ? "argon2id" : null,
        empresaPreferidaId: conta.empresaPreferidaId,
      });
      return Promise.resolve(u.id);
    },
    alterarConta: (id, dados) => {
      Object.assign(banco.usuario(id), dados);
      return Promise.resolve();
    },
    gravarVinculo: (empresaId, usuarioId, v) => {
      const atual = banco.vinculos.find(
        (x) => x.empresaId === empresaId && x.usuarioId === usuarioId,
      );
      if (atual) Object.assign(atual, v);
      else banco.vincular(usuarioId, empresaId, { ...v, criadoEm: agoraFixo() });
      return Promise.resolve();
    },
    definirPreferidaSeVazia: (usuarioId, empresaId) => {
      const u = banco.usuario(usuarioId);
      u.empresaPreferidaId ??= empresaId;
      return Promise.resolve();
    },
    trocarExcecoes: (empresaId, usuarioId, excecoes) => {
      banco.excecoes = banco.excecoes.filter(
        (e) => !(e.empresaId === empresaId && e.usuarioId === usuarioId),
      );
      for (const e of excecoes) banco.excecoes.push({ empresaId, usuarioId, ...e });
      return Promise.resolve();
    },
  };

  const cadastros: RepositorioCadastros = {
    cargos: (empresaId) =>
      Promise.resolve(
        cargosDaEmpresa(empresaId).map((c) => ({
          chave: c.chave,
          rotulo: c.rotulo,
          protegido: c.protegido ?? false,
          telas: telasValidas(c.telas),
          usuarios: usoNaEmpresa(empresaId, "papel", c.chave),
        })),
      ),
    cargo: (empresaId, chave) => {
      const c = banco.cargos.get(chaveCargo(empresaId, chave));
      return Promise.resolve(
        c
          ? {
              chave,
              rotulo: c.rotulo,
              protegido: c.protegido ?? false,
              telas: telasValidas(c.telas),
            }
          : null,
      );
    },
    criarCargo: (empresaId, cargo, telas) => {
      banco.definirCargo(empresaId, cargo.chave, { ...cargo, telas: [...telas] });
      return Promise.resolve();
    },
    alterarCargo: (empresaId, chave, rotulo) => {
      const c = banco.cargos.get(chaveCargo(empresaId, chave));
      if (c) c.rotulo = rotulo;
      return Promise.resolve();
    },
    trocarTelasDoCargo: (empresaId, chave, telas) => {
      const c = banco.cargos.get(chaveCargo(empresaId, chave));
      if (c) c.telas = [...telas];
      return Promise.resolve();
    },
    excluirCargo: (empresaId, chave) => {
      banco.cargos.delete(chaveCargo(empresaId, chave));
      return Promise.resolve();
    },
    departamentos: (empresaId) =>
      Promise.resolve(
        adm.departamentos
          .filter((d) => d.empresaId === empresaId)
          .map((d) => ({
            chave: d.chave,
            rotulo: d.rotulo,
            descricao: d.descricao,
            ativo: d.ativo,
            protegido: d.protegido,
            telas: telasValidas(
              banco.departamentoTelas
                .filter((t) => t.empresaId === empresaId && t.departamento === d.chave)
                .map((t) => t.tela),
            ),
            usuarios: usoNaEmpresa(empresaId, "departamento", d.chave),
          })),
      ),
    departamento: (empresaId, chave) => {
      const d = adm.departamentos.find((x) => x.empresaId === empresaId && x.chave === chave);
      return Promise.resolve(
        d
          ? {
              chave: d.chave,
              rotulo: d.rotulo,
              descricao: d.descricao,
              ativo: d.ativo,
              protegido: d.protegido,
              telas: telasValidas(
                banco.departamentoTelas
                  .filter((t) => t.empresaId === empresaId && t.departamento === chave)
                  .map((t) => t.tela),
              ),
            }
          : null,
      );
    },
    criarDepartamento: async (empresaId, d, telas) => {
      adm.departamentos.push({ empresaId, ...d });
      await cadastros.trocarTelasDoDepartamento(empresaId, d.chave, telas);
    },
    alterarDepartamento: (empresaId, chave, dados) => {
      const d = adm.departamentos.find((x) => x.empresaId === empresaId && x.chave === chave);
      if (d) Object.assign(d, dados);
      return Promise.resolve();
    },
    trocarTelasDoDepartamento: (empresaId, chave, telas) => {
      banco.departamentoTelas = banco.departamentoTelas.filter(
        (t) => !(t.empresaId === empresaId && t.departamento === chave),
      );
      for (const tela of telas)
        banco.departamentoTelas.push({ empresaId, departamento: chave, tela });
      return Promise.resolve();
    },
    excluirDepartamento: (empresaId, chave) => {
      adm.departamentos = adm.departamentos.filter(
        (d) => !(d.empresaId === empresaId && d.chave === chave),
      );
      return Promise.resolve();
    },
    usuariosCom: (empresaId, campo, chave) =>
      Promise.resolve(usoNaEmpresa(empresaId, campo, chave)),
  };

  const configuracoes: RepositorioConfiguracoes = {
    daEmpresa: (empresaId, grupos) =>
      Promise.resolve(
        adm.configuracoes
          .filter((c) => c.empresaId === empresaId && grupos.includes(c.grupo))
          .map(({ chave, valor, descricao, grupo, atualizadoEm }) => ({
            chave,
            valor,
            descricao,
            grupo,
            atualizadoEm,
          })),
      ),
    vigentes: (empresaId, chaves) =>
      Promise.resolve(
        new Map(
          [
            ...configuracoesVigentes(adm.configuracoes.filter((c) => c.empresaId === empresaId)),
          ].filter(([chave]) => chaves.includes(chave)),
        ),
      ),
    gravarValor: (empresaId, chave, valor, atualizadoPor) => {
      const c = adm.configuracoes.find((x) => x.empresaId === empresaId && x.chave === chave);
      if (c) Object.assign(c, { valor, atualizadoPor, atualizadoEm: agoraFixo() });
      return Promise.resolve();
    },
  };

  const semEmpresa = <T extends { empresaId: string }>({ empresaId: _e, ...resto }: T) => resto;

  const prazos: RepositorioPrazos = {
    regras: (empresaId) =>
      Promise.resolve(adm.prazos.filter((p) => p.empresaId === empresaId).map(semEmpresa)),
    regra: (empresaId, id) => {
      const p = adm.prazos.find((x) => x.empresaId === empresaId && x.id === id);
      return Promise.resolve(p ? semEmpresa(p) : null);
    },
    criar: (empresaId, dados) => {
      const id = randomUUID();
      adm.prazos.push({
        ...dados,
        id,
        empresaId,
        criadoEm: agoraFixo(),
        atualizadoEm: agoraFixo(),
      });
      return Promise.resolve(id);
    },
    alterar: (empresaId, id, dados) => {
      const p = adm.prazos.find((x) => x.empresaId === empresaId && x.id === id);
      if (p) Object.assign(p, dados);
      return Promise.resolve();
    },
    ligar: (empresaId, id, ativo) => {
      const p = adm.prazos.find((x) => x.empresaId === empresaId && x.id === id);
      if (p) p.ativo = ativo;
      return Promise.resolve();
    },
    excluir: (empresaId, id) => {
      adm.prazos = adm.prazos.filter((p) => !(p.empresaId === empresaId && p.id === id));
      return Promise.resolve();
    },
    unidadesDosCtes: (empresaId) => {
      const porFilial = new Map<string, string>();
      for (const c of adm.ctes) {
        if (c.empresaId === empresaId && c.filial && c.unidadeCidade && !porFilial.has(c.filial)) {
          porFilial.set(c.filial, c.unidadeCidade);
        }
      }
      return Promise.resolve(
        [...porFilial]
          .map(([codigo, cidade]) => ({ codigo, cidade }))
          .sort((a, b) => a.codigo.localeCompare(b.codigo)),
      );
    },
    parceirosDosCtes: (empresaId) => {
      const porCnpj = new Map<string, string>();
      for (const c of adm.ctes) {
        if (
          c.empresaId === empresaId &&
          c.parceiroCnpj &&
          c.parceiroNome &&
          !porCnpj.has(c.parceiroCnpj)
        ) {
          porCnpj.set(c.parceiroCnpj, c.parceiroNome);
        }
      }
      return Promise.resolve(
        [...porCnpj]
          .map(([cnpj, nome]) => ({ cnpj, nome }))
          .sort((a, b) => a.nome.localeCompare(b.nome)),
      );
    },
  };

  const logs: RepositorioLogs = {
    auditoria: (f) =>
      Promise.resolve(
        banco.auditoria
          .map((a, i) => ({
            id: i + 1,
            empresaId: a.empresaId,
            empresaNome: banco.empresas.find((e) => e.id === a.empresaId)?.nome ?? null,
            atorEmail: a.ator.email,
            atorTipo: a.ator.plataforma ? ("plataforma" as const) : ("usuario" as const),
            acao: a.acao,
            entidade: a.entidade,
            entidadeId: a.entidadeId,
            resumo: a.resumo,
            antes: a.antes,
            depois: a.depois,
            ip: a.ator.ip,
            criadoEm: new Date(Date.UTC(2026, 10, 10, 12, 0, i)),
          }))
          .filter((l) =>
            f.escopo.tipo === "empresa"
              ? l.empresaId === f.escopo.empresaId
              : f.escopo.tipo === "plataforma"
                ? l.empresaId === null
                : true,
          )
          .filter((l) => !f.ator || l.atorEmail.includes(f.ator))
          .filter((l) => !f.entidade || l.entidade === f.entidade)
          .filter((l) => !f.acao || l.acao === f.acao)
          .reverse()
          .slice(0, f.limite),
      ),
    execucoes: (empresaId, origem, _periodo, limite) =>
      Promise.resolve(
        adm.execucoes
          .filter((e) => e.empresaId === empresaId && e.origem === origem)
          .map((e) => e.execucao)
          .slice(0, limite),
      ),
  };

  const plataforma: RepositorioPlataforma = {
    empresas: () =>
      Promise.resolve(
        banco.empresas.flatMap((e) => {
          const g = empresaGravada(e.id);
          return g ? [g] : [];
        }),
      ),
    empresa: (id) => Promise.resolve(empresaGravada(id)),
    slugEmUso: (slug) =>
      Promise.resolve(banco.empresas.some((e) => empresaGravada(e.id)?.slug === slug)),
    criarEmpresa: (e) => {
      banco.criarEmpresa({ id: e.id, nome: e.nome, nomeCurto: e.nomeCurto, status: "implantacao" });
      adm.detalhesDaEmpresa.set(e.id, {
        slug: e.slug,
        razaoSocial: null,
        cnpj: e.cnpj,
        dominioSsw: null,
        criadoEm: agoraFixo(),
        atualizadoEm: agoraFixo(),
      });
      return Promise.resolve();
    },
    alterarEmpresa: (id, dados) => {
      const base = banco.empresas.find((e) => e.id === id);
      const atual = empresaGravada(id);
      if (base && atual) {
        Object.assign(base, {
          nome: dados.nome,
          nomeCurto: dados.nomeCurto,
          corPrimaria: dados.corPrimaria,
          corDestaque: dados.corDestaque,
          slogan: dados.slogan,
          fuso: dados.fuso,
          status: dados.status,
        });
        adm.detalhesDaEmpresa.set(id, {
          slug: atual.slug,
          razaoSocial: dados.razaoSocial,
          cnpj: dados.cnpj,
          dominioSsw: dados.dominioSsw,
          criadoEm: atual.criadoEm,
          atualizadoEm: agoraFixo(),
        });
      }
      return Promise.resolve();
    },
    definirLogo: (id, caminho) => {
      const base = banco.empresas.find((e) => e.id === id);
      if (base) base.logoCaminho = caminho;
      return Promise.resolve();
    },
    usuariosAtivosPorEmpresa: () => {
      const m = new Map<string, number>();
      for (const v of banco.vinculos)
        if (v.ativo) m.set(v.empresaId, (m.get(v.empresaId) ?? 0) + 1);
      return Promise.resolve(m);
    },
    integracoesAtivasPorEmpresa: () => {
      const m = new Map<string, number>();
      for (const i of adm.integracoes)
        if (i.ativo) m.set(i.empresaId, (m.get(i.empresaId) ?? 0) + 1);
      return Promise.resolve(m);
    },
    liberacoes: (empresaId) =>
      Promise.resolve(
        banco.liberacoes
          .filter((l) => empresaId === null || l.empresaId === empresaId)
          .map((l) => ({
            ...l,
            observacao:
              adm.observacoesDeModulo.get(`${l.empresaId}:${l.modulo}`)?.observacao ?? null,
            atualizadoEm:
              adm.observacoesDeModulo.get(`${l.empresaId}:${l.modulo}`)?.atualizadoEm ??
              agoraFixo(),
          })),
      ),
    gravarModulo: (empresaId, modulo, dados) => {
      banco.liberacoes = banco.liberacoes.filter(
        (l) => !(l.empresaId === empresaId && l.modulo === modulo),
      );
      banco.liberacoes.push({
        empresaId,
        modulo,
        ativo: dados.ativo,
        inicio: dados.inicio,
        fim: dados.fim,
      });
      adm.observacoesDeModulo.set(`${empresaId}:${modulo}`, {
        observacao: dados.observacao,
        atualizadoEm: agoraFixo(),
      });
      return Promise.resolve();
    },
    vinculos: (empresaId) =>
      Promise.resolve(
        banco.vinculos
          .filter((v) => v.empresaId === empresaId)
          .map((v) => {
            const u = banco.usuario(v.usuarioId);
            return {
              usuarioId: u.id,
              nome: u.nome,
              email: u.email,
              papel: v.papel,
              departamento: v.departamento,
              ativo: v.ativo,
              criadoEm: v.criadoEm,
              totalEmpresas: banco.vinculos.filter((x) => x.usuarioId === u.id).length,
              adminPlataforma: banco.plataformaAdmins.has(u.id),
            };
          }),
      ),
    integracoes: (empresaId) =>
      Promise.resolve(
        adm.integracoes
          .filter((i) => i.empresaId === empresaId)
          .map(
            ({
              empresaId: _e,
              segredoCifrado: _s,
              segredoVersaoChave: _v,
              segredoAnteriorCifrado: _sa,
              segredoAnteriorVersaoChave: _va,
              ...i
            }) => i,
          ),
      ),
    gravarIntegracao: (empresaId, tipo, dados) => {
      const atual = integracaoFalsa(empresaId, tipo);
      Object.assign(atual, dados, { atualizadoEm: agoraFixo() });
      return Promise.resolve();
    },
    gravarSegredo: (empresaId, tipo, segredo) => {
      const atual = integracaoFalsa(empresaId, tipo);
      if (tipo === "ssw_webhook" && atual.segredoCifrado !== null) {
        atual.segredoAnteriorCifrado = atual.segredoCifrado;
        atual.segredoAnteriorVersaoChave = atual.segredoVersaoChave;
      }
      Object.assign(atual, {
        segredoCifrado: segredo?.cifrado ?? null,
        segredoVersaoChave: segredo?.versaoChave ?? null,
        segredoDefinidoEm: segredo?.definidoEm ?? null,
      });
      return Promise.resolve();
    },
    integracoesDaPlataforma: () =>
      Promise.resolve(adm.integracoesDaPlataforma.map((i) => ({ ...i }))),
    gravarIntegracaoDaPlataforma: (tipo, parametros) => {
      Object.assign(integracaoDaPlataformaFalsa(tipo), { parametros, atualizadoEm: agoraFixo() });
      return Promise.resolve();
    },
    gravarSegredoDaPlataforma: (tipo, segredo) => {
      Object.assign(integracaoDaPlataformaFalsa(tipo), {
        segredo: segredo ? { cifrado: segredo.cifrado, versaoChave: segredo.versaoChave } : null,
        segredoDefinidoEm: segredo?.definidoEm ?? null,
      });
      return Promise.resolve();
    },
    copiaDoModelo: (modeloId): Promise<CopiaDoModelo> =>
      Promise.resolve({
        codigos: adm.codigos
          .filter((c) => c.empresaId === modeloId)
          .map((c) => ({
            codigo: c.codigo,
            descricao: c.descricao,
            responsavel: "sistema" as const,
          })),
        configuracoes: adm.configuracoes
          .filter((c) => c.empresaId === modeloId)
          .map(({ chave, valor, descricao, grupo }) => ({ chave, valor, descricao, grupo })),
        telasDosCargos: new Map(
          cargosDaEmpresa(modeloId).map((c) => [c.chave, telasValidas(c.telas)]),
        ),
      }),
    copiarParaEmpresa: (empresaId, copia) => {
      for (const c of copia.codigos) {
        adm.codigos.push({ empresaId, codigo: c.codigo, descricao: c.descricao });
      }
      for (const c of copia.configuracoes) {
        adm.configuracoes.push({ ...c, empresaId, atualizadoEm: agoraFixo(), atualizadoPor: null });
      }
      return Promise.resolve();
    },
    admins: () =>
      Promise.resolve(
        [...banco.plataformaAdmins].map((id) => {
          const u = banco.usuario(id);
          return {
            usuarioId: id,
            nome: u.nome,
            email: u.email,
            criadoEm: adm.adminsDesde.get(id) ?? agoraFixo(),
          };
        }),
      ),
    travarAdmins: () => Promise.resolve(banco.plataformaAdmins.size),
    adicionarAdmin: (usuarioId) => {
      banco.plataformaAdmins.add(usuarioId);
      return Promise.resolve();
    },
    removerAdmin: (usuarioId) => {
      banco.plataformaAdmins.delete(usuarioId);
      return Promise.resolve();
    },
  };

  function integracaoFalsa(empresaId: string, tipo: TipoIntegracao): IntegracaoFalsa {
    let atual = adm.integracoes.find((i) => i.empresaId === empresaId && i.tipo === tipo);
    if (!atual) {
      atual = {
        empresaId,
        tipo,
        ativo: false,
        parametros: {},
        segredoCifrado: null,
        segredoVersaoChave: null,
        segredoAnteriorCifrado: null,
        segredoAnteriorVersaoChave: null,
        segredoDefinidoEm: null,
        ultimoTesteEm: null,
        ultimoTesteOk: null,
        ultimoTesteMsg: null,
        atualizadoEm: agoraFixo(),
      };
      adm.integracoes.push(atual);
    }
    return atual;
  }

  function integracaoDaPlataformaFalsa(tipo: TipoIntegracaoPlataforma) {
    let atual = adm.integracoesDaPlataforma.find((i) => i.tipo === tipo);
    if (!atual) {
      atual = {
        tipo,
        parametros: {},
        segredo: null,
        segredoDefinidoEm: null,
        atualizadoEm: agoraFixo(),
      };
      adm.integracoesDaPlataforma.push(atual);
    }
    return atual;
  }

  return { usuarios, cadastros, configuracoes, prazos, logs, plataforma };
}
