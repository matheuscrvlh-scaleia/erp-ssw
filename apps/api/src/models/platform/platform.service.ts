import { randomUUID } from "node:crypto";

import {
  type ChavesDeSegredo,
  cifrarSegredo,
  contextoDaPlataforma,
  contextoDoSegredo,
  type SegredoCifrado,
} from "@erp/db/secrets";
import { modulosVigentes, permissoesDoCargoDaPlataforma } from "@erp/domain/access";
import {
  caminhoDoLogo,
  CARGOS_PADRAO,
  escolherEmpresaModelo,
  exigirOutroSuperAdmin,
  type ImagemDaMarca,
  validarLogo,
  validarParametrosDeIntegracao,
  validarVigencia,
} from "@erp/domain/administration";
import { mudancaParaAuditoria, type Registro } from "@erp/domain/audit";
import { ErroDeNegocio } from "@erp/domain/errors";
import { copiaParaEmpresaNova } from "@erp/domain/settings";
import { MODULOS } from "@erp/shared/access/modules";
import { type Permissao } from "@erp/shared/access/permissions";
import { CARGO_SUPER_ADMIN_DA_PLATAFORMA } from "@erp/shared/access/roles";
import { type Cargo } from "@erp/shared/contracts/admin";
import {
  type DadosDaEmpresa,
  type IntegracaoDaEmpresa,
  type IntegracaoDaPlataforma,
  type ModuloDaEmpresa,
  PARAMETROS_DA_INTEGRACAO_PLATAFORMA,
  type ValorDeParametro,
  valorDeParametro,
} from "@erp/shared/contracts/platform";
import { hojeNoFuso } from "@erp/shared/dates";
import {
  INFO_DA_INTEGRACAO,
  INFO_DA_INTEGRACAO_PLATAFORMA,
  type StatusEmpresa,
  type TipoIntegracao,
  type TipoIntegracaoPlataforma,
  TIPOS_INTEGRACAO,
  TIPOS_INTEGRACAO_PLATAFORMA,
} from "@erp/shared/platform";
import { type FastifyBaseLogger } from "fastify";

import { type Correio } from "../../infra/mail";
import type { Armazenamento } from "../../infra/storage";
import { type Ator, type RepositorioAuditoria } from "../audit/audit.service";
import { conflito, naoEncontrado } from "../errors";
import { type Executor } from "../repositories";

/*
 * Plataforma: cadastro das empresas (marca, módulos, integrações e segredos) e a equipe da
 * Plataforma. As rotas exigem admin da Plataforma; cada caso de uso
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
  faviconCaminho: string | null;
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

export interface IntegracaoDaPlataformaGravada {
  tipo: TipoIntegracaoPlataforma;
  parametros: Record<string, unknown>;
  segredo: SegredoCifrado | null;
  segredoDefinidoEm: Date | null;
  atualizadoEm: Date;
}

/** A empresa com os números da lista: usuários ativos, módulos liberados e integrações ativas. */
export interface EmpresaListada extends EmpresaGravada {
  usuariosAtivos: number;
  modulosLiberados: number;
  integracoesAtivas: number;
}

/** Módulo do catálogo com a liberação da empresa. */
export type ModuloLiberado = Omit<ModuloDaEmpresa, "atualizadoEm"> & { atualizadoEm: Date | null };

/** Integração da empresa: o que está gravado, ou o padrão (desligada) se não há linha. */
export type EstadoDaIntegracao = Omit<
  IntegracaoDaEmpresa,
  "segredoDefinidoEm" | "ultimoTesteEm" | "atualizadoEm"
> & { segredoDefinidoEm: Date | null; ultimoTesteEm: Date | null; atualizadoEm: Date | null };

export type EstadoDaIntegracaoDaPlataforma = Omit<
  IntegracaoDaPlataforma,
  "segredoDefinidoEm" | "atualizadoEm"
> & { segredoDefinidoEm: Date | null; atualizadoEm: Date | null };

/** Linha de `codigos_ocorrencia` da empresa modelo, sem empresa e sem autoria. */
export interface CodigoDoModelo {
  codigo: number;
  descricao: string;
  tipoSsw: string | null;
  processoSsw: string | null;
  tipoSswManual: boolean;
  responsavel: string;
  letraResponsavel: string | null;
  penaliza: boolean;
  ativo: boolean;
  pendenteClassificacao: boolean;
  pendenciaAcompanhada: boolean;
  notas: string | null;
}

/** O que a empresa nova copia da empresa modelo. */
export interface CopiaDoModelo {
  codigos: CodigoDoModelo[];
  configuracoes: { chave: string; valor: string; descricao: string; grupo: string }[];
  /** Permissões gravadas de cada cargo do modelo (`tela.acao`). */
  permissoesDosCargos: Map<string, Permissao[]>;
}

/** Pessoa da equipe da Plataforma, com o cargo dela na Plataforma. */
export interface AdminGravado {
  usuarioId: string;
  nome: string | null;
  email: string;
  ativo: boolean;
  cargo: string;
  cargoRotulo: string;
  ultimoLoginEm: Date | null;
  criadoEm: Date;
}

/** Cargo da Plataforma com as permissões gravadas e quantas pessoas da equipe estão nele. */
export interface CargoDaPlataformaGravado {
  chave: string;
  rotulo: string;
  protegido: boolean;
  permissoes: string[];
  usuarios: number;
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
  definirImagem(
    id: string,
    imagem: ImagemDaMarca,
    caminho: string | null,
    atualizadoPor: string,
  ): Promise<void>;
  usuariosAtivosPorEmpresa(): Promise<Map<string, number>>;
  /** Último login de algum usuário com vínculo ativo, por empresa. */
  ultimoLoginPorEmpresa(): Promise<Map<string, Date>>;
  integracoesAtivasPorEmpresa(): Promise<Map<string, number>>;
  /** Dos vínculos ativos, quantos entraram desde `desde`, por empresa. */
  usuariosComAcessoDesde(desde: Date): Promise<Map<string, number>>;
  /** Integrações ligadas de todas as empresas. */
  integracoesLigadas(): Promise<{ empresaId: string; tipo: TipoIntegracao }[]>;
  /** CT-e emitidos por mês ("AAAA-MM") desde o dia `desde`, na empresa do contexto (RLS). */
  ctesPorMes(desde: string): Promise<{ mes: string; total: number }[]>;
  /** Liberações de módulo de uma empresa, ou de todas (nulo). */
  liberacoes(empresaId: string | null): Promise<LiberacaoGravada[]>;
  gravarModulo(
    empresaId: string,
    modulo: string,
    dados: { ativo: boolean; inicio: string | null; fim: string | null; observacao: string | null },
    atualizadoPor: string,
  ): Promise<void>;
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
  copiarParaEmpresa(
    empresaId: string,
    copia: Omit<CopiaDoModelo, "permissoesDosCargos">,
  ): Promise<void>;
  integracoesDaPlataforma(): Promise<IntegracaoDaPlataformaGravada[]>;
  gravarIntegracaoDaPlataforma(
    tipo: TipoIntegracaoPlataforma,
    parametros: Record<string, ValorDeParametro>,
    atualizadoPor: string,
  ): Promise<void>;
  /** Cria a linha se não existir e grava ou apaga o segredo. */
  gravarSegredoDaPlataforma(
    tipo: TipoIntegracaoPlataforma,
    segredo: { cifrado: string; versaoChave: number; definidoEm: Date } | null,
    atualizadoPor: string,
  ): Promise<void>;
  admins(): Promise<AdminGravado[]>;
  /** Trava a equipe (duas mudanças ao mesmo tempo não zeram o Super Admin) e devolve os cargos. */
  travarAdmins(): Promise<{ usuarioId: string; cargo: string }[]>;
  adicionarAdmin(usuarioId: string, cargo: string, criadoPor: string): Promise<void>;
  trocarCargoDoAdmin(usuarioId: string, cargo: string): Promise<void>;
  removerAdmin(usuarioId: string): Promise<void>;
  cargosDaPlataforma(): Promise<CargoDaPlataformaGravado[]>;
  cargoDaPlataforma(chave: string): Promise<CargoDaPlataformaGravado | null>;
  criarCargoDaPlataforma(
    cargo: { chave: string; rotulo: string },
    permissoes: readonly Permissao[],
  ): Promise<void>;
  alterarCargoDaPlataforma(chave: string, rotulo: string): Promise<void>;
  trocarPermissoesDoCargoDaPlataforma(
    chave: string,
    permissoes: readonly Permissao[],
  ): Promise<void>;
  excluirCargoDaPlataforma(chave: string): Promise<void>;
}

/** Executor no contexto de uma empresa (ou de nenhuma), com a Plataforma ligada. */
type NaEmpresa = (
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

/** Módulos vigentes hoje na empresa, sem contar os essenciais. */
export function modulosLiberados(
  empresa: Pick<EmpresaGravada, "id" | "fuso">,
  liberacoes: readonly LiberacaoGravada[],
  agora: Date,
): number {
  const vigentes = modulosVigentes(
    MODULOS,
    liberacoes.filter((l) => l.empresaId === empresa.id),
    hojeNoFuso(empresa.fuso, agora),
  );
  return vigentes.filter((m) => !MODULOS.find((c) => c.chave === m)?.essencial).length;
}

/** Empresas com usuários ativos, módulos liberados hoje (sem os essenciais) e integrações ativas. */
export async function listarEmpresas(
  db: Executor<"plataforma">,
  agora: Date,
): Promise<EmpresaListada[]> {
  return db(async ({ plataforma }) => {
    const empresas = await plataforma.empresas();
    const usuarios = await plataforma.usuariosAtivosPorEmpresa();
    const integracoes = await plataforma.integracoesAtivasPorEmpresa();
    const liberacoes = await plataforma.liberacoes(null);
    return empresas.map((e) => ({
      ...e,
      usuariosAtivos: usuarios.get(e.id) ?? 0,
      modulosLiberados: modulosLiberados(e, liberacoes, agora),
      integracoesAtivas: integracoes.get(e.id) ?? 0,
    }));
  });
}

/**
 * Empresa nova em implantação, já com os cargos padrão e a cópia da empresa modelo (a mais
 * antiga): códigos de ocorrência, configurações de negócio e as permissões dos cargos padrão. Tudo na
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
      await cadastros.criarCargo(id, cargo, copia?.permissoesDosCargos.get(cargo.chave) ?? []);
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
  id: string,
): Promise<EmpresaGravada> {
  return db(({ plataforma }) => empresaExistente(plataforma, id));
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

interface DependenciasDoLogo {
  armazenamento: Armazenamento | null;
  agora: () => Date;
  log: FastifyBaseLogger;
}

const semArmazenamento = () =>
  new ErroDeNegocio(
    "INDISPONIVEL",
    "O envio de imagens não está configurado neste ambiente. Fale com o suporte.",
  );

/** Onde cada imagem fica gravada e o nome dela na auditoria (`logo_path`, como no sistema atual). */
const CAMINHO_DA_IMAGEM = {
  logo: { campo: "logoCaminho", naAuditoria: "logo_path" },
  favicon: { campo: "faviconCaminho", naAuditoria: "favicon_path" },
} as const satisfies Record<ImagemDaMarca, { campo: keyof EmpresaGravada; naAuditoria: string }>;

/** Apagar o arquivo antigo é limpeza: se falhar, só fica no log. */
async function apagarImagemAntiga(deps: DependenciasDoLogo, caminho: string | null): Promise<void> {
  if (!caminho || !deps.armazenamento) return;
  await deps.armazenamento.apagar(caminho).catch((erro: unknown) => {
    deps.log.warn({ err: erro, caminho }, "não foi possível apagar a imagem anterior");
  });
}

/**
 * Logo ou favicon novo (PNG ou JPEG até 512 KB, conferido pelos bytes): sobe com nome novo, grava
 * o caminho (devolvido) e apaga o anterior.
 * origem: enviarLogoEmpresa (sistema atual)
 */
export async function enviarLogo(
  deps: DependenciasDoLogo,
  db: Executor<"plataforma" | "auditoria">,
  ator: Ator,
  id: string,
  conteudoBase64: string,
  imagem: ImagemDaMarca = "logo",
): Promise<string> {
  const arquivo = validarLogo(conteudoBase64, imagem);
  const { armazenamento } = deps;
  if (!armazenamento) throw semArmazenamento();
  const { campo, naAuditoria } = CAMINHO_DA_IMAGEM[imagem];
  const anterior = await db(({ plataforma }) => empresaExistente(plataforma, id));
  const caminho = caminhoDoLogo(id, deps.agora(), arquivo.extensao, imagem);
  await armazenamento.enviar(caminho, arquivo.bytes, arquivo.tipo).catch((erro: unknown) => {
    deps.log.error({ err: erro, imagem }, "falha ao enviar imagem da marca");
    throw new ErroDeNegocio("INDISPONIVEL", "Não foi possível enviar a imagem. Tente de novo.");
  });
  await db(async ({ plataforma, auditoria }) => {
    await plataforma.definirImagem(id, imagem, caminho, ator.usuarioId);
    await registrarCadastro(auditoria, ator, {
      empresaId: id,
      acao: "alterar",
      entidade: "empresa",
      entidadeId: id,
      antes: { [naAuditoria]: anterior[campo] },
      depois: { [naAuditoria]: caminho },
    });
  });
  await apagarImagemAntiga(deps, anterior[campo]);
  return caminho;
}

export async function removerLogo(
  deps: DependenciasDoLogo,
  db: Executor<"plataforma" | "auditoria">,
  ator: Ator,
  id: string,
  imagem: ImagemDaMarca = "logo",
): Promise<void> {
  const { campo, naAuditoria } = CAMINHO_DA_IMAGEM[imagem];
  const anterior = await db(async ({ plataforma, auditoria }) => {
    const empresa = await empresaExistente(plataforma, id);
    await plataforma.definirImagem(id, imagem, null, ator.usuarioId);
    await registrarCadastro(auditoria, ator, {
      empresaId: id,
      acao: "alterar",
      entidade: "empresa",
      entidadeId: id,
      antes: { [naAuditoria]: empresa[campo] },
      depois: { [naAuditoria]: null },
    });
    return empresa[campo];
  });
  await apagarImagemAntiga(deps, anterior);
}

/** Catálogo inteiro com o estado da empresa; sem liberação = desligado. */
export async function listarModulos(
  db: Executor<"plataforma">,
  id: string,
): Promise<ModuloLiberado[]> {
  return db(async ({ plataforma }) => {
    await empresaExistente(plataforma, id);
    const liberacoes = new Map((await plataforma.liberacoes(id)).map((l) => [l.modulo, l]));
    return MODULOS.map((m) => {
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
        atualizadoEm: l?.atualizadoEm ?? null,
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
): EstadoDaIntegracao {
  return {
    tipo,
    configurada: l !== undefined,
    ativo: l?.ativo ?? false,
    parametros: parametrosValidos(l?.parametros ?? {}),
    segredoDefinidoEm: l?.segredoDefinidoEm ?? null,
    ultimoTesteEm: l?.ultimoTesteEm ?? null,
    ultimoTesteOk: l?.ultimoTesteOk ?? null,
    ultimoTesteMsg: l?.ultimoTesteMsg ?? null,
    atualizadoEm: l?.atualizadoEm ?? null,
  };
}

/** Uma linha por tipo, mesmo sem configuração. O segredo nunca sai: só quando foi definido. */
export async function listarIntegracoes(
  db: Executor<"plataforma">,
  id: string,
): Promise<EstadoDaIntegracao[]> {
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

/**
 * Grava (cifrado com AES-256-GCM) ou, com valor vazio, apaga a senha/token da integração. O valor
 * nunca vai para resposta, log ou auditoria: o registro diz só que foi definido ou removido.
 * Devolve quando foi definido (nulo = removido).
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
): Promise<Date | null> {
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
  return segredo?.definidoEm ?? null;
}

// --- Integrações da própria Plataforma (domínio, e-mail, worker-ssw) ------------------------------

/** Uma linha por tipo, mesmo sem configuração. O segredo nunca sai: só quando foi definido. */
export async function listarIntegracoesDaPlataforma(
  db: Executor<"plataforma">,
): Promise<EstadoDaIntegracaoDaPlataforma[]> {
  const gravadas = new Map(
    (await db(({ plataforma }) => plataforma.integracoesDaPlataforma())).map((l) => [l.tipo, l]),
  );
  return TIPOS_INTEGRACAO_PLATAFORMA.map((tipo) => {
    const l = gravadas.get(tipo);
    return {
      tipo,
      parametros: parametrosValidos(l?.parametros ?? {}),
      segredoDefinidoEm: l?.segredoDefinidoEm ?? null,
      atualizadoEm: l?.atualizadoEm ?? null,
    };
  });
}

/** Grava os parâmetros do tipo (só os campos conhecidos, validados). `aoGravar` limpa o cache. */
export async function salvarIntegracaoDaPlataforma(
  db: Executor<"plataforma" | "auditoria">,
  ator: Ator,
  tipo: TipoIntegracaoPlataforma,
  parametros: Record<string, ValorDeParametro>,
  aoGravar: () => void,
): Promise<void> {
  const lido = PARAMETROS_DA_INTEGRACAO_PLATAFORMA[tipo].safeParse(parametros);
  if (!lido.success) {
    throw new ErroDeNegocio(
      "ENTRADA_INVALIDA",
      lido.error.issues[0]?.message ?? "Parâmetros inválidos.",
    );
  }
  const depois: Record<string, ValorDeParametro> = lido.data;
  await db(async ({ plataforma, auditoria }) => {
    const antes = (await plataforma.integracoesDaPlataforma()).find((l) => l.tipo === tipo);
    await plataforma.gravarIntegracaoDaPlataforma(tipo, depois, ator.usuarioId);
    await registrarCadastro(auditoria, ator, {
      empresaId: null,
      acao: antes ? "alterar" : "criar",
      entidade: "integracao_plataforma",
      entidadeId: tipo,
      antes: antes ? { parametros: antes.parametros } : null,
      depois: { tipo, parametros: depois },
    });
  });
  aoGravar();
}

/**
 * Grava (cifrado com o contexto `plataforma:<tipo>`) ou, com valor vazio, apaga a chave/token. O
 * valor nunca vai para resposta, log ou auditoria. Devolve quando foi definido (nulo = removido).
 */
export async function definirSegredoDaPlataforma(
  chaves: ChavesDeSegredo | null,
  db: Executor<"plataforma" | "auditoria">,
  ator: Ator,
  tipo: TipoIntegracaoPlataforma,
  valor: string,
  agora: Date,
  aoGravar: () => void,
): Promise<Date | null> {
  const rotulo = INFO_DA_INTEGRACAO_PLATAFORMA[tipo].segredo;
  if (!rotulo) {
    throw new ErroDeNegocio("ENTRADA_INVALIDA", "Esta integração não tem senha nem token.");
  }
  const remover = valor === "";
  if (!remover && !chaves) throw cofreDesligado();
  const segredo =
    remover || !chaves
      ? null
      : { ...cifrarSegredo(chaves, valor, contextoDaPlataforma(tipo)), definidoEm: agora };
  await db(async ({ plataforma, auditoria }) => {
    await plataforma.gravarSegredoDaPlataforma(tipo, segredo, ator.usuarioId);
    await auditoria.registrar(ator, {
      empresaId: null,
      acao: remover ? "remover_segredo" : "definir_segredo",
      entidade: "integracao_plataforma",
      entidadeId: tipo,
      resumo: `${rotulo} ${remover ? "removido" : "definido"}`,
      antes: null,
      depois: null,
    });
  });
  aoGravar();
  return segredo?.definidoEm ?? null;
}

/** E-mail de teste com a configuração gravada (erro do Resend chega ao operador). */
export async function testarEmailDaPlataforma(correio: Correio, para: string): Promise<void> {
  try {
    await correio.enviar({
      para,
      assunto: "Teste de e-mail do ERP",
      texto: "Se você recebeu esta mensagem, o envio de e-mail do ERP está funcionando.",
      html: "<p>Se você recebeu esta mensagem, o envio de e-mail do ERP está funcionando.</p>",
    });
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) throw erro;
    const detalhe = erro instanceof Error ? erro.message : "erro desconhecido";
    throw new ErroDeNegocio("INDISPONIVEL", `O Resend recusou o envio: ${detalhe}`);
  }
}

export async function listarAdmins(db: Executor<"plataforma">): Promise<AdminGravado[]> {
  return db(({ plataforma }) => plataforma.admins());
}

async function cargoDaPlataformaExistente(
  plataforma: RepositorioPlataforma,
  chave: string,
): Promise<CargoDaPlataformaGravado> {
  const cargo = await plataforma.cargoDaPlataforma(chave);
  if (!cargo) throw naoEncontrado("Cargo da Plataforma não encontrado.");
  return cargo;
}

const ehSuperAdmin = (cargo: string) => cargo === CARGO_SUPER_ADMIN_DA_PLATAFORMA;

/**
 * Põe na equipe da Plataforma quem já tem conta (a pessoa é convidada antes), num cargo da
 * Plataforma. Quem já é da equipe não muda aqui (troca de cargo é outra ação).
 * origem: adicionarAdminPlataforma + plataforma_admin_definir (sistema atual)
 */
export async function adicionarAdmin(
  db: Executor<"plataforma" | "usuarios" | "acesso" | "auditoria">,
  ator: Ator,
  entrada: { email: string; cargo: string },
): Promise<void> {
  await db(async ({ plataforma, usuarios, acesso, auditoria }) => {
    const conta = await usuarios.contaPorEmail(entrada.email);
    if (!conta) {
      throw naoEncontrado(
        "Nenhum usuário com esse e-mail. Convide a pessoa antes de colocá-la na Plataforma.",
      );
    }
    await cargoDaPlataformaExistente(plataforma, entrada.cargo);
    if (await acesso.ehAdminPlataforma(conta.id)) {
      throw conflito("Essa pessoa já é da equipe da Plataforma. Para mudar o cargo, edite-a.");
    }
    await plataforma.adicionarAdmin(conta.id, entrada.cargo, ator.usuarioId);
    await registrarCadastro(auditoria, ator, {
      empresaId: null,
      acao: "criar",
      entidade: "admin_plataforma",
      entidadeId: conta.id,
      antes: null,
      depois: { usuario_id: conta.id, email: conta.email, cargo: entrada.cargo },
    });
  });
}

/** Super Admins da equipe travada (duas mudanças ao mesmo tempo não zeram o cargo). */
async function superAdminsTravados(plataforma: RepositorioPlataforma): Promise<number> {
  const equipe = await plataforma.travarAdmins();
  return equipe.filter((a) => ehSuperAdmin(a.cargo)).length;
}

/** Troca o cargo da pessoa na Plataforma; o último Super Admin não sai do cargo. */
export async function trocarCargoDoAdmin(
  db: Executor<"plataforma" | "auditoria">,
  ator: Ator,
  usuarioId: string,
  cargo: string,
): Promise<void> {
  await db(async ({ plataforma, auditoria }) => {
    const superAdmins = await superAdminsTravados(plataforma);
    const atual = (await plataforma.admins()).find((a) => a.usuarioId === usuarioId);
    if (!atual) throw naoEncontrado("Essa pessoa não é da equipe da Plataforma.");
    if (atual.cargo === cargo) return;
    await cargoDaPlataformaExistente(plataforma, cargo);
    if (ehSuperAdmin(atual.cargo)) exigirOutroSuperAdmin(superAdmins);
    await plataforma.trocarCargoDoAdmin(usuarioId, cargo);
    await registrarCadastro(auditoria, ator, {
      empresaId: null,
      acao: "alterar",
      entidade: "admin_plataforma",
      entidadeId: usuarioId,
      antes: { cargo: atual.cargo },
      depois: { cargo },
    });
  });
}

/** Tira da equipe da Plataforma (a conta e os vínculos com as empresas ficam). */
export async function removerAdmin(
  db: Executor<"plataforma" | "usuarios" | "auditoria">,
  ator: Ator,
  usuarioId: string,
): Promise<void> {
  await db(async ({ plataforma, usuarios, auditoria }) => {
    const superAdmins = await superAdminsTravados(plataforma);
    const atual = (await plataforma.admins()).find((a) => a.usuarioId === usuarioId);
    if (!atual) return;
    if (ehSuperAdmin(atual.cargo)) exigirOutroSuperAdmin(superAdmins);
    await plataforma.removerAdmin(usuarioId);
    const conta = await usuarios.conta(usuarioId);
    await registrarCadastro(auditoria, ator, {
      empresaId: null,
      acao: "excluir",
      entidade: "admin_plataforma",
      entidadeId: usuarioId,
      antes: { usuario_id: usuarioId, email: conta?.email ?? null, cargo: atual.cargo },
      depois: null,
    });
  });
}

const comoTexto = (permissoes: readonly string[]) => [...permissoes].sort().join(", ");

/** Cargos da Plataforma com as permissões que valem (o Super Admin tem todas). */
export async function listarCargosDaPlataforma(db: Executor<"plataforma">): Promise<Cargo[]> {
  const cargos = await db(({ plataforma }) => plataforma.cargosDaPlataforma());
  return cargos.map((c) => ({
    chave: c.chave,
    rotulo: c.rotulo,
    protegido: c.protegido,
    temTudo: ehSuperAdmin(c.chave),
    permissoes: permissoesDoCargoDaPlataforma(c.chave, c.permissoes),
    usuarios: c.usuarios,
  }));
}

/** Só as permissões da Plataforma entram num cargo da Plataforma (o resto é ignorado). */
export async function criarCargoDaPlataforma(
  db: Executor<"plataforma" | "auditoria">,
  ator: Ator,
  entrada: { chave: string; rotulo: string; permissoes: string[] },
): Promise<void> {
  const permissoes = permissoesDoCargoDaPlataforma(entrada.chave, entrada.permissoes);
  await db(async ({ plataforma, auditoria }) => {
    if (ehSuperAdmin(entrada.chave) || (await plataforma.cargoDaPlataforma(entrada.chave))) {
      throw conflito("Já existe um cargo com essa chave.");
    }
    await plataforma.criarCargoDaPlataforma(
      { chave: entrada.chave, rotulo: entrada.rotulo },
      permissoes,
    );
    await registrarCadastro(auditoria, ator, {
      empresaId: null,
      acao: "criar",
      entidade: "cargo_plataforma",
      entidadeId: entrada.chave,
      antes: null,
      depois: { chave: entrada.chave, rotulo: entrada.rotulo, permissoes: comoTexto(permissoes) },
    });
  });
}

/** Super Admin: só o nome muda (as permissões são todas as da Plataforma). */
export async function alterarCargoDaPlataforma(
  db: Executor<"plataforma" | "auditoria">,
  ator: Ator,
  chave: string,
  entrada: { rotulo: string; permissoes: string[] },
): Promise<void> {
  const permissoes = permissoesDoCargoDaPlataforma(chave, entrada.permissoes);
  await db(async ({ plataforma, auditoria }) => {
    const antes = await cargoDaPlataformaExistente(plataforma, chave);
    const fixas = ehSuperAdmin(chave);
    await plataforma.alterarCargoDaPlataforma(chave, entrada.rotulo);
    if (!fixas) await plataforma.trocarPermissoesDoCargoDaPlataforma(chave, permissoes);
    await registrarCadastro(auditoria, ator, {
      empresaId: null,
      acao: "alterar",
      entidade: "cargo_plataforma",
      entidadeId: chave,
      antes: { rotulo: antes.rotulo, permissoes: comoTexto(antes.permissoes) },
      depois: {
        rotulo: entrada.rotulo,
        permissoes: comoTexto(fixas ? antes.permissoes : permissoes),
      },
    });
  });
}

export async function excluirCargoDaPlataforma(
  db: Executor<"plataforma" | "auditoria">,
  ator: Ator,
  chave: string,
): Promise<void> {
  await db(async ({ plataforma, auditoria }) => {
    const antes = await cargoDaPlataformaExistente(plataforma, chave);
    if (antes.protegido || ehSuperAdmin(chave)) throw conflito("Este cargo é protegido");
    if (antes.usuarios > 0) {
      throw conflito(`Cargo em uso por ${String(antes.usuarios)} pessoa(s) da Plataforma`);
    }
    await plataforma.excluirCargoDaPlataforma(chave);
    await registrarCadastro(auditoria, ator, {
      empresaId: null,
      acao: "excluir",
      entidade: "cargo_plataforma",
      entidadeId: chave,
      antes: { chave, rotulo: antes.rotulo, permissoes: comoTexto(antes.permissoes) },
      depois: null,
    });
  });
}
