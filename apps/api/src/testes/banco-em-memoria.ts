import { randomUUID } from "node:crypto";

import { type ContextoBanco } from "@erp/db";
import { chaveDoFeriado } from "@erp/dominio/calendario";
import { type Setor } from "@erp/shared/acesso/papeis";
import { type UnidadeDoCalendario } from "@erp/shared/contratos/calendario";

import { type AlgoritmoSenha } from "../infra/senhas";
import { type EmpresaGravada } from "../modulos/acesso/casos-de-uso";
import { type Ator, type EventoDeAuditoria } from "../modulos/auditoria/auditoria";
import { type NovaSessao, type TipoTokenSenha } from "../modulos/auth/casos-de-uso";
import { type FeriadoGravado } from "../modulos/calendario/casos-de-uso";
import { type ExecutorComContexto, type Repositorios } from "../repositorios";

/*
 * Banco falso para os testes: implementa as interfaces dos repositórios sobre arrays. Não
 * simula SQL nem RLS; registra o contexto de cada transação para os testes conferirem.
 */

export interface UsuarioFalso {
  id: string;
  email: string;
  nome: string | null;
  ativo: boolean;
  senhaHash: string | null;
  senhaAlgoritmo: AlgoritmoSenha | null;
  tentativasFalhas: number;
  bloqueadoAte: Date | null;
  empresaPreferidaId: string | null;
}

interface VinculoFalso {
  empresaId: string;
  usuarioId: string;
  papel: string | null;
  departamento: string | null;
  setor: Setor | null;
  ativo: boolean;
  criadoEm: Date;
}

interface SessaoFalsa extends NovaSessao {
  id: string;
  substituidaEm: Date | null;
  revogadaEm: Date | null;
  motivo: string | null;
}

interface TokenSenhaFalso {
  id: string;
  usuarioId: string;
  tipo: TipoTokenSenha;
  tokenHash: string;
  expiraEm: Date;
  usadoEm: Date | null;
}

export class BancoEmMemoria {
  usuarios: UsuarioFalso[] = [];
  plataformaAdmins = new Set<string>();
  empresas: EmpresaGravada[] = [];
  vinculos: VinculoFalso[] = [];
  private cargos = new Map<string, { rotulo: string; telas: string[] }>();
  departamentoTelas: { empresaId: string; departamento: string; tela: string }[] = [];
  excecoes: { empresaId: string; usuarioId: string; tela: string; permitido: boolean }[] = [];
  liberacoes: {
    empresaId: string;
    modulo: string;
    ativo: boolean;
    inicio: string | null;
    fim: string | null;
  }[] = [];
  sessoes: SessaoFalsa[] = [];
  tokensSenha: TokenSenhaFalso[] = [];
  identidades: { usuarioId: string; provedor: string; sujeito: string; email: string }[] = [];
  auditoria: (EventoDeAuditoria & { ator: Ator })[] = [];
  feriados: FeriadoGravado[] = [];
  unidades: (UnidadeDoCalendario & { empresaId: string; ativo: boolean })[] = [];
  contextos: ContextoBanco[] = [];
  /** Faz a próxima transação falhar com este erro (para testar o tratador de erros). */
  falharCom: Error | null = null;

  readonly executar: ExecutorComContexto = async (contexto, fn) => {
    this.contextos.push(contexto);
    if (this.falharCom !== null) throw this.falharCom;
    return fn(this.repositorios());
  };

  definirCargo(empresaId: string, chave: string, cargo: { rotulo: string; telas: string[] }) {
    this.cargos.set(`${empresaId}:${chave}`, cargo);
  }

  criarEmpresa(dados: Partial<EmpresaGravada> = {}): EmpresaGravada {
    const empresa: EmpresaGravada = {
      id: randomUUID(),
      nome: "FR Transportes",
      nomeCurto: "FR",
      logoCaminho: null,
      corPrimaria: "#212a63",
      corDestaque: "#c0392b",
      slogan: null,
      fuso: "America/Sao_Paulo",
      status: "ativa",
      ...dados,
    };
    this.empresas.push(empresa);
    return empresa;
  }

  criarUsuario(dados: Partial<UsuarioFalso> & { email: string }): UsuarioFalso {
    const usuario: UsuarioFalso = {
      id: randomUUID(),
      nome: null,
      ativo: true,
      senhaHash: null,
      senhaAlgoritmo: null,
      tentativasFalhas: 0,
      bloqueadoAte: null,
      empresaPreferidaId: null,
      ...dados,
    };
    this.usuarios.push(usuario);
    return usuario;
  }

  vincular(usuarioId: string, empresaId: string, dados: Partial<VinculoFalso> = {}) {
    this.vinculos.push({
      usuarioId,
      empresaId,
      papel: null,
      departamento: null,
      setor: null,
      ativo: true,
      criadoEm: new Date("2026-01-01"),
      ...dados,
    });
  }

  liberarModulo(empresaId: string, modulo: string) {
    this.liberacoes.push({ empresaId, modulo, ativo: true, inicio: null, fim: null });
  }

  private usuario(id: string): UsuarioFalso {
    const usuario = this.usuarios.find((u) => u.id === id);
    if (!usuario) throw new Error(`usuário ${id} não existe no banco falso`);
    return usuario;
  }

  private repositorios(): Repositorios {
    return {
      acesso: {
        usuario: (id) => Promise.resolve(this.usuarios.find((u) => u.id === id) ?? null),
        ehAdminPlataforma: (id) => Promise.resolve(this.plataformaAdmins.has(id)),
        vinculos: (usuarioId) =>
          Promise.resolve(
            this.vinculos
              .filter((v) => v.usuarioId === usuarioId)
              .flatMap((v) => {
                const empresa = this.empresas.find((e) => e.id === v.empresaId);
                return empresa
                  ? [{ ...v, empresaNome: empresa.nome, empresaStatus: empresa.status }]
                  : [];
              }),
          ),
        familiaAtiva: (familiaId, agora) =>
          Promise.resolve(
            this.sessoes.some(
              (s) => s.familiaId === familiaId && !s.revogadaEm && s.expiraEm > agora,
            ),
          ),
        empresa: (id) => Promise.resolve(this.empresas.find((e) => e.id === id) ?? null),
        todasAsEmpresas: () =>
          Promise.resolve(this.empresas.map((e) => ({ id: e.id, nome: e.nome }))),
        cargo: (empresaId, papel) =>
          Promise.resolve(this.cargos.get(`${empresaId}:${papel}`) ?? null),
        telasDoDepartamento: (empresaId, departamento) =>
          Promise.resolve(
            this.departamentoTelas
              .filter((d) => d.empresaId === empresaId && d.departamento === departamento)
              .map((d) => d.tela),
          ),
        excecoes: (empresaId, usuarioId) =>
          Promise.resolve(
            this.excecoes
              .filter((e) => e.empresaId === empresaId && e.usuarioId === usuarioId)
              .map(({ tela, permitido }) => ({ tela, permitido })),
          ),
        liberacoes: (empresaId) =>
          Promise.resolve(this.liberacoes.filter((l) => l.empresaId === empresaId)),
      },

      auditoria: {
        registrar: (ator, evento) => {
          this.auditoria.push({ ...evento, ator });
          return Promise.resolve();
        },
      },

      auth: {
        usuarioPorEmail: (email) =>
          Promise.resolve(this.usuarios.find((u) => u.email === email) ?? null),
        contarFalha: (id) => Promise.resolve(++this.usuario(id).tentativasFalhas),
        bloquear: (id, ate) => {
          this.usuario(id).bloqueadoAte = ate;
          return Promise.resolve();
        },
        registrarEntrada: (id, _agora, novoHash) => {
          const usuario = this.usuario(id);
          usuario.tentativasFalhas = 0;
          usuario.bloqueadoAte = null;
          if (novoHash) Object.assign(usuario, { senhaHash: novoHash, senhaAlgoritmo: "argon2id" });
          return Promise.resolve();
        },
        criarSessao: (sessao) => {
          this.sessoes.push({
            ...sessao,
            id: randomUUID(),
            substituidaEm: null,
            revogadaEm: null,
            motivo: null,
          });
          return Promise.resolve();
        },
        sessaoPorHash: (hash) =>
          Promise.resolve(this.sessoes.find((s) => s.tokenHash === hash) ?? null),
        substituirSessao: (id, agora) => {
          for (const s of this.sessoes) if (s.id === id) s.substituidaEm ??= agora;
          return Promise.resolve();
        },
        revogarFamilia: (familiaId, motivo, agora) => {
          for (const s of this.sessoes) {
            if (s.familiaId === familiaId && !s.revogadaEm)
              Object.assign(s, { revogadaEm: agora, motivo });
          }
          return Promise.resolve();
        },
        revogarSessoesDoUsuario: (usuarioId, motivo, agora) => {
          for (const s of this.sessoes) {
            if (s.usuarioId === usuarioId && !s.revogadaEm)
              Object.assign(s, { revogadaEm: agora, motivo });
          }
          return Promise.resolve();
        },
        trocarEmpresaDaFamilia: (familiaId, empresaId) => {
          for (const s of this.sessoes) if (s.familiaId === familiaId) s.empresaAtivaId = empresaId;
          return Promise.resolve();
        },
        definirEmpresaPreferida: (id, empresaId) => {
          this.usuario(id).empresaPreferidaId = empresaId;
          return Promise.resolve();
        },
        emitirTokenSenha: (novo, agora) => {
          for (const t of this.tokensSenha) {
            if (t.usuarioId === novo.usuarioId && t.tipo === novo.tipo) t.usadoEm ??= agora;
          }
          this.tokensSenha.push({ ...novo, id: randomUUID(), usadoEm: null });
          return Promise.resolve();
        },
        tokenSenhaPorHash: (hash, tipo) => {
          const token = this.tokensSenha.find((t) => t.tokenHash === hash && t.tipo === tipo);
          return Promise.resolve(
            token ? { ...token, usuarioEmail: this.usuario(token.usuarioId).email } : null,
          );
        },
        consumirTokenSenha: (id, agora) => {
          const token = this.tokensSenha.find((t) => t.id === id && !t.usadoEm);
          if (token) token.usadoEm = agora;
          return Promise.resolve(token !== undefined);
        },
        definirSenha: (id, hash, nome) => {
          Object.assign(this.usuario(id), {
            senhaHash: hash,
            senhaAlgoritmo: "argon2id",
            tentativasFalhas: 0,
            bloqueadoAte: null,
            ...(nome ? { nome } : {}),
          });
          return Promise.resolve();
        },
        usuarioPorIdentidade: (provedor, sujeito) =>
          Promise.resolve(
            this.identidades.find((i) => i.provedor === provedor && i.sujeito === sujeito)
              ?.usuarioId ?? null,
          ),
        vincularIdentidade: (usuarioId, provedor, sujeito, email) => {
          this.identidades.push({ usuarioId, provedor, sujeito, email });
          return Promise.resolve();
        },
        adminsDaEmpresa: (empresaId) =>
          Promise.resolve(
            this.vinculos
              .filter(
                (v) =>
                  v.empresaId === empresaId &&
                  v.ativo &&
                  ["admin", "super_admin"].includes(v.papel ?? ""),
              )
              .map((v) => {
                const u = this.usuario(v.usuarioId);
                return { nome: u.nome, email: u.email };
              }),
          ),
      },

      calendario: {
        feriados: (empresaId, de, ate) =>
          Promise.resolve(
            this.feriadosVisiveis(empresaId)
              .filter((f) => f.data >= de && f.data <= ate)
              .sort((a, b) => a.data.localeCompare(b.data)),
          ),
        proximo: (empresaId, aPartirDe) =>
          Promise.resolve(
            this.feriadosVisiveis(empresaId)
              .filter((f) => f.data >= aPartirDe)
              .sort((a, b) => a.data.localeCompare(b.data))[0] ?? null,
          ),
        unidadesAtivas: (empresaId) =>
          Promise.resolve(
            this.unidades
              .filter((u) => u.empresaId === empresaId && u.ativo)
              .map(({ id, nome, cidade, uf }) => ({ id, nome, cidade, uf })),
          ),
        feriado: (empresaId, id) =>
          Promise.resolve(this.feriadosVisiveis(empresaId).find((f) => f.id === id) ?? null),
        chavesExistentes: (empresaId, datas, tipo) =>
          Promise.resolve(
            new Set(
              this.feriadosVisiveis(empresaId)
                .filter((f) => datas.includes(f.data) && f.tipo === tipo)
                .map(chaveDoFeriado),
            ),
          ),
        inserir: (novos) => {
          let inseridos = 0;
          for (const novo of novos) {
            const chave = `${chaveDoFeriado(novo)}|${novo.empresaId ?? ""}`;
            const existe = this.feriados.some(
              (f) => `${chaveDoFeriado(f)}|${f.empresaId ?? ""}` === chave,
            );
            if (existe) continue;
            this.feriados.push({ ...novo, id: randomUUID() });
            inseridos += 1;
          }
          return Promise.resolve(inseridos);
        },
        alterar: (id, dados) => {
          const feriado = this.feriados.find((f) => f.id === id);
          if (feriado) Object.assign(feriado, dados);
          return Promise.resolve();
        },
        excluir: (id) => {
          this.feriados = this.feriados.filter((f) => f.id !== id);
          return Promise.resolve();
        },
      },
    };
  }

  private feriadosVisiveis(empresaId: string): FeriadoGravado[] {
    return this.feriados.filter((f) => f.empresaId === null || f.empresaId === empresaId);
  }
}
