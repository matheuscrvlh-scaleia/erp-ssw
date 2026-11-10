import { randomUUID } from "node:crypto";

import { type codigosOcorrencia } from "@erp/db/schema";
import { type ChavesDeSegredo, cifrarSegredo } from "@erp/db/segredos";
import { modulosVigentes } from "@erp/dominio/acesso";
import {
  caminhoDoLogo,
  CARGOS_PADRAO,
  escolherEmpresaModelo,
  exigirPodeRemoverAdminPlataforma,
  setorLegado,
  validarLogo,
  validarParametrosDeIntegracao,
  validarVigencia,
} from "@erp/dominio/administracao";
import { mudancaParaAuditoria, type Registro } from "@erp/dominio/auditoria";
import { copiaParaEmpresaNova } from "@erp/dominio/configuracoes";
import { ErroDeNegocio } from "@erp/dominio/erros";
import { MODULOS } from "@erp/shared/acesso/modulos";
import { type Tela } from "@erp/shared/acesso/telas";
import {
  type AdminDaPlataforma,
  type DadosDaEmpresa,
  type EmpresaCompleta,
  type EmpresaResumo,
  type IntegracaoDaEmpresa,
  type ModuloDaEmpresa,
  type ValorDeParametro,
  valorDeParametro,
  type VinculoNaEmpresa,
} from "@erp/shared/contratos/plataforma";
import { hojeNoFuso } from "@erp/shared/datas";
import {
  INFO_DA_INTEGRACAO,
  type StatusEmpresa,
  TIPOS_INTEGRACAO,
  type TipoIntegracao,
} from "@erp/shared/plataforma";
import { type FastifyBaseLogger } from "fastify";

import { conflito, naoEncontrado } from "../../http/erros";
import { type Armazenamento } from "../../infra/armazenamento";
import { type Executor } from "../../repositorios";
import { type Ator, type RepositorioAuditoria } from "../auditoria/auditoria";
import { registrarVinculo } from "../usuarios/casos-de-uso";

/*
 * Plataforma: cadastro das empresas (marca, módulos, integrações e segredos), vínculos de usuário
 * por empresa e a equipe da Plataforma. As rotas exigem admin da Plataforma; cada caso de uso
 * recebe o executor já no contexto da empresa alvo (RLS) com a Plataforma ligada.
 * origem: src/features/plataforma/plataforma.functions.ts (sistema atual)
 */

export interface EmpresaGravada {
  id: string;
  slug: string;
  nome: string;
  nomeCurto: string;
  razaoSocial: string | null;
  cnpj: string | null;
  dominioSsw: string | null;
  logoCaminho: string | null;
  corPrimaria: string;
  corDestaque: string;
  slogan: string | null;
  fuso: string;
  status: StatusEmpresa;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface LiberacaoGravada {
  empresaId: string;
  modulo: string;
  ativo: boolean;
  inicio: string | null;
  fim: string | null;
  observacao: string | null;
  atualizadoEm: Date;
}

export interface IntegracaoGravada {
  tipo: TipoIntegracao;
  ativo: boolean;
  parametros: Record<string, unknown>;
  segredoDefinidoEm: Date | null;
  ultimoTesteEm: Date | null;
  ultimoTesteOk: boolean | null;
  ultimoTesteMsg: string | null;
  atualizadoEm: Date;
}

export type VinculoGravadoNaEmpresa = Omit<VinculoNaEmpresa, "criadoEm"> & { criadoEm: Date };

/** O que a empresa nova copia da empresa modelo. */
export interface CopiaDoModelo {
  /** Linhas de `codigos_ocorrencia` sem empresa e sem autoria. */
  codigos: Omit<typeof codigosOcorrencia.$inferInsert, "empresaId">[];
  configuracoes: { chave: string; valor: string; descricao: string; grupo: string }[];
  telasDosCargos: Map<string, Tela[]>;
}

export interface RepositorioPlataforma {
  empresas(): Promise<EmpresaGravada[]>;
  empresa(id: string): Promise<EmpresaGravada | null>;
  slugEmUso(slug: string): Promise<boolean>;
  criarEmpresa(empresa: {
    id: string;
    slug: string;
    nome: string;
    nomeCurto: string;
    cnpj: string | null;
    criadoPor: string;
  }): Promise<void>;
  alterarEmpresa(id: string, dados: DadosDaEmpresa, atualizadoPor: string): Promise<void>;
  definirLogo(id: string, caminho: string | null, atualizadoPor: string): Promise<void>;
  usuariosAtivosPorEmpresa(): Promise<Map<string, number>>;
  integracoesAtivasPorEmpresa(): Promise<Map<string, number>>;
  /** Liberações de módulo de uma empresa, ou de todas (nulo). */
  liberacoes(empresaId: string | null): Promise<LiberacaoGravada[]>;
  gravarModulo(
    empresaId: string,
    modulo: string,
    dados: { ativo: boolean; inicio: string | null; fim: string | null; observacao: string | null },
    atualizadoPor: string,
  ): Promise<void>;
  /** Vínculos da empresa, com quantas empresas cada pessoa tem e se é da Plataforma. */
  vinculos(empresaId: string): Promise<VinculoGravadoNaEmpresa[]>;
  integracoes(empresaId: string): Promise<IntegracaoGravada[]>;
  gravarIntegracao(
    empresaId: string,
    tipo: TipoIntegracao,
    dados: { ativo: boolean; parametros: Record<string, ValorDeParametro> },
    atualizadoPor: string,
  ): Promise<void>;
  /** Cria a linha da integração (desligada) se não existir e grava ou apaga o segredo. */
  gravarSegredo(
    empresaId: string,
    tipo: TipoIntegracao,
    segredo: { cifrado: string; versaoChave: number; definidoEm: Date } | null,
    atualizadoPor: string,
  ): Promise<void>;
  copiaDoModelo(modeloId: string): Promise<CopiaDoModelo>;
  copiarParaEmpresa(empresaId: string, copia: Omit<CopiaDoModelo, "telasDosCargos">): Promise<void>;
  admins(): Promise<{ usuarioId: string; nome: string | null; email: string; criadoEm: Date }[]>;
  /** Trava a lista (duas remoções ao mesmo tempo não zeram a equipe) e devolve quantos são. */
  travarAdmins(): Promise<number>;
  adicionarAdmin(usuarioId: string, criadoPor: string): Promise<void>;
  removerAdmin(usuarioId: string): Promise<void>;
}

/** Executor no contexto de uma empresa (ou de nenhuma), com a Plataforma ligada. */
export type NaEmpresa = (
  empresaId: string | null,
) => Executor<"plataforma" | "cadastros" | "usuarios" | "acesso" | "auditoria">;

const empresaNaoEncontrada = () => naoEncontrado("Empresa não encontrada.");

async function empresaExistente(
  plataforma: RepositorioPlataforma,
  id: string,
): Promise<EmpresaGravada> {
  const empresa = await plataforma.empresa(id);
  if (!empresa) throw empresaNaoEncontrada();
  return empresa;
}

async function registrarCadastro(
  auditoria: RepositorioAuditoria,
  ator: Ator,
  evento: {
    empresaId: string | null;
    acao: "criar" | "alterar" | "excluir";
    entidade: string;
    entidadeId: string;
    antes: Registro | null;
    depois: Registro | null;
  },
): Promise<void> {
  const mudanca = mudancaParaAuditoria(evento);
  if (!mudanca) return;
  await auditoria.registrar(ator, { ...evento, resumo: null, ...mudanca });
}

function registroDaEmpresa(e: DadosDaEmpresa): Registro {
  return {
    nome: e.nome,
    nome_curto: e.nomeCurto,
    razao_social: e.razaoSocial,
    cnpj: e.cnpj,
    dominio_ssw: e.dominioSsw,
    fuso: e.fuso,
    status: e.status,
    cor_primaria: e.corPrimaria,
    cor_destaque: e.corDestaque,
    slogan: e.slogan,
  };
}

/**
 * Empresas por nome, com usuários ativos, módulos liberados hoje (sem os essenciais) e
 * integrações ativas.
 */
export async function listarEmpresas(
  db: Executor<"plataforma">,
  agora: Date,
): Promise<EmpresaResumo[]> {
  return db(async ({ plataforma }) => {
    const empresas = await plataforma.empresas();
    const usuarios = await plataforma.usuariosAtivosPorEmpresa();
    const integracoes = await plataforma.integracoesAtivasPorEmpresa();
    const liberacoes = await plataforma.liberacoes(null);
    return empresas
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map((e) => {
        const vigentes = modulosVigentes(
          MODULOS,
          liberacoes.filter((l) => l.empresaId === e.id),
          hojeNoFuso(e.fuso, agora),
        );
        const naoEssenciais = vigentes.filter(
          (m) => !MODULOS.find((c) => c.chave === m)?.essencial,
        );
        return {
          id: e.id,
          slug: e.slug,
          nome: e.nome,
          nomeCurto: e.nomeCurto,
          cnpj: e.cnpj,
          status: e.status,
          criadoEm: e.criadoEm.toISOString(),
          usuariosAtivos: usuarios.get(e.id) ?? 0,
          modulosLiberados: naoEssenciais.length,
          integracoesAtivas: integracoes.get(e.id) ?? 0,
        };
      });
  });
}

/**
 * Empresa nova em implantação, já com os cargos padrão e a cópia da empresa modelo (a mais
 * antiga): códigos de ocorrência, configurações de negócio e as telas dos cargos padrão. Tudo na
 * mesma transação.
 * origem: criarEmpresa + empresa_semear (sistema atual); cargos por empresa: ADR 0005
 */
export async function criarEmpresa(
  naEmpresa: NaEmpresa,
  ator: Ator,
  entrada: { nome: string; nomeCurto: string; slug: string; cnpj: string | null },
): Promise<{ id: string }> {
  const id = randomUUID();
  const modelo = await naEmpresa(null)(async ({ plataforma }) => {
    if (await plataforma.slugEmUso(entrada.slug)) {
      throw conflito("Empresa com esse identificador (slug) já existe.");
    }
    return escolherEmpresaModelo(await plataforma.empresas(), id);
  });
  const copia = modelo
    ? await naEmpresa(modelo.id)(({ plataforma }) => plataforma.copiaDoModelo(modelo.id))
    : null;

  await naEmpresa(id)(async ({ plataforma, cadastros, auditoria }) => {
    await plataforma.criarEmpresa({ id, ...entrada, criadoPor: ator.usuarioId });
    for (const cargo of CARGOS_PADRAO) {
      await cadastros.criarCargo(id, cargo, copia?.telasDosCargos.get(cargo.chave) ?? []);
    }
    if (copia) {
      await plataforma.copiarParaEmpresa(id, {
        codigos: copia.codigos,
        configuracoes: copia.configuracoes.filter(copiaParaEmpresaNova),
      });
    }
    await registrarCadastro(auditoria, ator, {
      empresaId: id,
      acao: "criar",
      entidade: "empresa",
      entidadeId: id,
      antes: null,
      depois: {
        slug: entrada.slug,
        nome: entrada.nome,
        nome_curto: entrada.nomeCurto,
        cnpj: entrada.cnpj,
        status: "implantacao",
      },
    });
  });
  return { id };
}

export async function obterEmpresa(
  db: Executor<"plataforma">,
  urlDoLogo: (caminho: string | null) => string | null,
  id: string,
): Promise<EmpresaCompleta> {
  const e = await db(({ plataforma }) => empresaExistente(plataforma, id));
  const { logoCaminho, criadoEm, atualizadoEm, ...resto } = e;
  return {
    ...resto,
    logoUrl: urlDoLogo(logoCaminho),
    criadoEm: criadoEm.toISOString(),
    atualizadoEm: atualizadoEm.toISOString(),
  };
}

export async function salvarEmpresa(
  db: Executor<"plataforma" | "auditoria">,
  ator: Ator,
  id: string,
  dados: DadosDaEmpresa,
): Promise<void> {
  await db(async ({ plataforma, auditoria }) => {
    const antes = await empresaExistente(plataforma, id);
    await plataforma.alterarEmpresa(id, dados, ator.usuarioId);
    await registrarCadastro(auditoria, ator, {
      empresaId: id,
      acao: "alterar",
      entidade: "empresa",
      entidadeId: id,
      antes: registroDaEmpresa(antes),
      depois: registroDaEmpresa(dados),
    });
  });
}

export interface DependenciasDoLogo {
  armazenamento: Armazenamento | null;
  urlDoLogo: (caminho: string | null) => string | null;
  agora: () => Date;
  log: FastifyBaseLogger;
}

const semArmazenamento = () =>
  new ErroDeNegocio(
    "INDISPONIVEL",
    "O envio de logo não está configurado neste ambiente. Fale com o suporte.",
  );

/** Apagar o arquivo antigo é limpeza: se falhar, só fica no log. */
async function apagarLogoAntigo(deps: DependenciasDoLogo, caminho: string | null): Promise<void> {
  if (!caminho || !deps.armazenamento) return;
  await deps.armazenamento.apagar(caminho).catch((erro: unknown) => {
    deps.log.warn({ err: erro, caminho }, "não foi possível apagar o logo anterior");
  });
}

/**
 * Logo novo (PNG ou JPEG até 512 KB, conferido pelos bytes): sobe com nome novo, grava o caminho
 * e apaga o anterior.
 * origem: enviarLogoEmpresa (sistema atual)
 */
export async function enviarLogo(
  deps: DependenciasDoLogo,
  db: Executor<"plataforma" | "auditoria">,
  ator: Ator,
  id: string,
  conteudoBase64: string,
): Promise<{ logoUrl: string | null }> {
  const logo = validarLogo(conteudoBase64);
  const { armazenamento } = deps;
  if (!armazenamento) throw semArmazenamento();
  const anterior = await db(({ plataforma }) => empresaExistente(plataforma, id));
  const caminho = caminhoDoLogo(id, deps.agora(), logo.extensao);
  await armazenamento.enviar(caminho, logo.bytes, logo.tipo).catch((erro: unknown) => {
    deps.log.error({ err: erro }, "falha ao enviar logo");
    throw new ErroDeNegocio("INDISPONIVEL", "Não foi possível enviar o logo. Tente de novo.");
  });
  await db(async ({ plataforma, auditoria }) => {
    await plataforma.definirLogo(id, caminho, ator.usuarioId);
    await registrarCadastro(auditoria, ator, {
      empresaId: id,
      acao: "alterar",
      entidade: "empresa",
      entidadeId: id,
      antes: { logo_path: anterior.logoCaminho },
      depois: { logo_path: caminho },
    });
  });
  await apagarLogoAntigo(deps, anterior.logoCaminho);
  return { logoUrl: deps.urlDoLogo(caminho) };
}

export async function removerLogo(
  deps: DependenciasDoLogo,
  db: Executor<"plataforma" | "auditoria">,
  ator: Ator,
  id: string,
): Promise<void> {
  const anterior = await db(async ({ plataforma, auditoria }) => {
    const empresa = await empresaExistente(plataforma, id);
    await plataforma.definirLogo(id, null, ator.usuarioId);
    await registrarCadastro(auditoria, ator, {
      empresaId: id,
      acao: "alterar",
      entidade: "empresa",
      entidadeId: id,
      antes: { logo_path: empresa.logoCaminho },
      depois: { logo_path: null },
    });
    return empresa.logoCaminho;
  });
  await apagarLogoAntigo(deps, anterior);
}

/** Catálogo inteiro (por ordem) com o estado da empresa; sem liberação = desligado. */
export async function listarModulos(
  db: Executor<"plataforma">,
  id: string,
): Promise<ModuloDaEmpresa[]> {
  return db(async ({ plataforma }) => {
    await empresaExistente(plataforma, id);
    const liberacoes = new Map((await plataforma.liberacoes(id)).map((l) => [l.modulo, l]));
    return [...MODULOS]
      .sort((a, b) => a.ordem - b.ordem)
      .map((m) => {
        const l = liberacoes.get(m.chave);
        return {
          chave: m.chave,
          nome: m.nome,
          descricao: m.descricao,
          essencial: m.essencial,
          ordem: m.ordem,
          configurado: l !== undefined,
          ativo: l?.ativo ?? false,
          inicio: l?.inicio ?? null,
          fim: l?.fim ?? null,
          observacao: l?.observacao ?? null,
          atualizadoEm: l ? l.atualizadoEm.toISOString() : null,
        };
      });
  });
}

export async function salvarModulo(
  db: Executor<"plataforma" | "auditoria">,
  ator: Ator,
  id: string,
  modulo: string,
  dados: { ativo: boolean; inicio: string | null; fim: string | null; observacao: string | null },
): Promise<void> {
  if (!MODULOS.some((m) => m.chave === modulo)) throw naoEncontrado("Módulo não encontrado.");
  validarVigencia(dados.inicio, dados.fim);
  await db(async ({ plataforma, auditoria }) => {
    await empresaExistente(plataforma, id);
    const antes = (await plataforma.liberacoes(id)).find((l) => l.modulo === modulo) ?? null;
    await plataforma.gravarModulo(id, modulo, dados, ator.usuarioId);
    await registrarCadastro(auditoria, ator, {
      empresaId: id,
      acao: antes ? "alterar" : "criar",
      entidade: "modulo",
      entidadeId: modulo,
      antes: antes && {
        ativo: antes.ativo,
        inicio: antes.inicio,
        fim: antes.fim,
        observacao: antes.observacao,
      },
      depois: { modulo_key: modulo, ...dados },
    });
  });
}

export async function listarVinculos(
  db: Executor<"plataforma">,
  id: string,
): Promise<VinculoNaEmpresa[]> {
  return db(async ({ plataforma }) => {
    await empresaExistente(plataforma, id);
    return (await plataforma.vinculos(id))
      .sort((a, b) => (a.nome ?? a.email).localeCompare(b.nome ?? b.email, "pt-BR"))
      .map((v) => ({ ...v, criadoEm: v.criadoEm.toISOString() }));
  });
}

/**
 * Vínculo da pessoa com a empresa (papel, departamento, ativo). Papel e departamento têm de ser
 * da empresa editada (Q29).
 * origem: salvarVinculoUsuario + plataforma_vincular_usuario (sistema atual)
 */
export async function salvarVinculo(
  db: Executor<"plataforma" | "usuarios" | "auditoria">,
  ator: Ator,
  id: string,
  usuarioId: string,
  dados: { papel: string | null; departamento: string | null; ativo: boolean },
): Promise<void> {
  await db(async ({ plataforma, usuarios, auditoria }) => {
    await empresaExistente(plataforma, id);
    if (!(await usuarios.conta(usuarioId))) throw naoEncontrado("Usuário não encontrado.");
    if (dados.papel && !(await usuarios.existeCargo(id, dados.papel))) {
      throw new ErroDeNegocio("ENTRADA_INVALIDA", `Papel inexistente: ${dados.papel}`);
    }
    if (dados.departamento && !(await usuarios.existeDepartamento(id, dados.departamento))) {
      throw new ErroDeNegocio("ENTRADA_INVALIDA", "Departamento inexistente");
    }
    const antes = await usuarios.vinculo(id, usuarioId);
    const depois = { ...dados, setor: setorLegado(dados.departamento) };
    await usuarios.gravarVinculo(id, usuarioId, depois, ator.usuarioId);
    await registrarVinculo(auditoria, ator, id, usuarioId, antes, depois);
  });
}

/** O que está gravado e não é um valor de parâmetro aceito não vai para a tela. */
function parametrosValidos(parametros: Record<string, unknown>): Record<string, ValorDeParametro> {
  const validos: Record<string, ValorDeParametro> = {};
  for (const [chave, valor] of Object.entries(parametros)) {
    const lido = valorDeParametro.safeParse(valor);
    if (lido.success) validos[chave] = lido.data;
  }
  return validos;
}

function paraIntegracao(
  tipo: TipoIntegracao,
  l: IntegracaoGravada | undefined,
): IntegracaoDaEmpresa {
  return {
    tipo,
    configurada: l !== undefined,
    ativo: l?.ativo ?? false,
    parametros: parametrosValidos(l?.parametros ?? {}),
    segredoDefinidoEm: l?.segredoDefinidoEm?.toISOString() ?? null,
    ultimoTesteEm: l?.ultimoTesteEm?.toISOString() ?? null,
    ultimoTesteOk: l?.ultimoTesteOk ?? null,
    ultimoTesteMsg: l?.ultimoTesteMsg ?? null,
    atualizadoEm: l?.atualizadoEm.toISOString() ?? null,
  };
}

/** Uma linha por tipo, mesmo sem configuração. O segredo nunca sai: só quando foi definido. */
export async function listarIntegracoes(
  db: Executor<"plataforma">,
  id: string,
): Promise<IntegracaoDaEmpresa[]> {
  return db(async ({ plataforma }) => {
    await empresaExistente(plataforma, id);
    const gravadas = new Map((await plataforma.integracoes(id)).map((l) => [l.tipo, l]));
    return TIPOS_INTEGRACAO.map((tipo) => paraIntegracao(tipo, gravadas.get(tipo)));
  });
}

export async function salvarIntegracao(
  db: Executor<"plataforma" | "auditoria">,
  ator: Ator,
  id: string,
  tipo: TipoIntegracao,
  dados: { ativo: boolean; parametros: Record<string, ValorDeParametro> },
): Promise<void> {
  validarParametrosDeIntegracao(dados.parametros);
  await db(async ({ plataforma, auditoria }) => {
    await empresaExistente(plataforma, id);
    const antes = (await plataforma.integracoes(id)).find((l) => l.tipo === tipo);
    await plataforma.gravarIntegracao(id, tipo, dados, ator.usuarioId);
    await registrarCadastro(auditoria, ator, {
      empresaId: id,
      acao: antes ? "alterar" : "criar",
      entidade: "integracao",
      entidadeId: tipo,
      antes: antes ? { ativo: antes.ativo, parametros: antes.parametros } : null,
      depois: { tipo, ...dados },
    });
  });
}

const cofreDesligado = () =>
  new ErroDeNegocio(
    "INDISPONIVEL",
    "O cofre de senhas não está configurado neste ambiente. Fale com o suporte.",
  );

/** Dado autenticado da cifra: o segredo de uma integração não decifra na linha de outra. */
export const contextoDoSegredo = (empresaId: string, tipo: TipoIntegracao) =>
  `${empresaId}:${tipo}`;

/**
 * Grava (cifrado com AES-256-GCM) ou, com valor vazio, apaga a senha/token da integração. O valor
 * nunca vai para resposta, log ou auditoria: o registro diz só que foi definido ou removido.
 * origem: definirSegredoIntegracao + integracao_segredo_definir (sistema atual)
 */
export async function definirSegredo(
  chaves: ChavesDeSegredo | null,
  db: Executor<"plataforma" | "auditoria">,
  ator: Ator,
  id: string,
  tipo: TipoIntegracao,
  valor: string,
  agora: Date,
): Promise<{ segredoDefinidoEm: string | null }> {
  if (!INFO_DA_INTEGRACAO[tipo].segredo) {
    throw new ErroDeNegocio("ENTRADA_INVALIDA", "Esta integração não tem senha nem token.");
  }
  const remover = valor === "";
  if (!remover && !chaves) throw cofreDesligado();
  const segredo =
    remover || !chaves
      ? null
      : { ...cifrarSegredo(chaves, valor, contextoDoSegredo(id, tipo)), definidoEm: agora };
  await db(async ({ plataforma, auditoria }) => {
    await empresaExistente(plataforma, id);
    await plataforma.gravarSegredo(id, tipo, segredo, ator.usuarioId);
    await auditoria.registrar(ator, {
      empresaId: id,
      acao: remover ? "remover_segredo" : "definir_segredo",
      entidade: "empresa_integracao",
      entidadeId: tipo,
      resumo: remover ? `Senha/token removido (${tipo})` : `Senha/token definido (${tipo})`,
      antes: null,
      depois: null,
    });
  });
  return { segredoDefinidoEm: segredo?.definidoEm.toISOString() ?? null };
}

export async function listarAdmins(db: Executor<"plataforma">): Promise<AdminDaPlataforma[]> {
  const admins = await db(({ plataforma }) => plataforma.admins());
  return admins
    .sort((a, b) => a.email.localeCompare(b.email))
    .map((a) => ({ ...a, criadoEm: a.criadoEm.toISOString() }));
}

/**
 * Dá acesso de Plataforma a quem já tem conta (a pessoa é convidada antes).
 * origem: adicionarAdminPlataforma + plataforma_admin_definir (sistema atual)
 */
export async function adicionarAdmin(
  db: Executor<"plataforma" | "usuarios" | "acesso" | "auditoria">,
  ator: Ator,
  email: string,
): Promise<void> {
  await db(async ({ plataforma, usuarios, acesso, auditoria }) => {
    const conta = await usuarios.contaPorEmail(email);
    if (!conta) {
      throw naoEncontrado(
        "Nenhum usuário com esse e-mail. Convide a pessoa antes de torná-la admin.",
      );
    }
    if (await acesso.ehAdminPlataforma(conta.id)) return;
    await plataforma.adicionarAdmin(conta.id, ator.usuarioId);
    await registrarCadastro(auditoria, ator, {
      empresaId: null,
      acao: "criar",
      entidade: "admin_plataforma",
      entidadeId: conta.id,
      antes: null,
      depois: { usuario_id: conta.id, email: conta.email },
    });
  });
}

/** A Plataforma nunca fica sem admin: a lista é travada antes de contar. */
export async function removerAdmin(
  db: Executor<"plataforma" | "usuarios" | "acesso" | "auditoria">,
  ator: Ator,
  usuarioId: string,
): Promise<void> {
  await db(async ({ plataforma, usuarios, acesso, auditoria }) => {
    const total = await plataforma.travarAdmins();
    if (!(await acesso.ehAdminPlataforma(usuarioId))) return;
    exigirPodeRemoverAdminPlataforma(total);
    await plataforma.removerAdmin(usuarioId);
    const conta = await usuarios.conta(usuarioId);
    await registrarCadastro(auditoria, ator, {
      empresaId: null,
      acao: "excluir",
      entidade: "admin_plataforma",
      entidadeId: usuarioId,
      antes: { usuario_id: usuarioId, email: conta?.email ?? null },
      depois: null,
    });
  });
}
