import { SETORES } from "../acesso/papeis";
import { TELAS } from "../acesso/telas";
import { contrato } from "../contrato";
import { z } from "../zod";
import { SENHA_MINIMO } from "./auth";

/*
 * Admin da empresa ativa: usuários (convite, edição, senha), cargos, departamentos,
 * configurações e prazos configurados. Tudo exige admin (ou Plataforma) na empresa ativa.
 * origem: src/features/admin/** (sistema atual)
 */

const ok = z.object({ ok: z.literal(true) });

/** Senha definida por admin: 8–72 (o bcrypt de hoje lê no máximo 72 bytes). */
export const SENHA_MAXIMO_ADMIN = 72;
export const senhaDefinidaPorAdmin = z
  .string()
  .min(SENHA_MINIMO, `A senha precisa ter pelo menos ${SENHA_MINIMO} caracteres.`)
  .max(SENHA_MAXIMO_ADMIN, `A senha pode ter no máximo ${SENHA_MAXIMO_ADMIN} caracteres.`);

export const emailDeUsuario = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Informe um e-mail válido.").max(320));

const chaveDeCadastro = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9_]+$/, "Use apenas minúsculas, números e _");

const papel = z.string().trim().min(1).max(64);
const departamento = z.string().trim().min(1).max(40).nullable();
const nomeDePessoa = z.string().trim().min(1).max(120);

export const excecaoDeTela = z.object({ tela: z.enum(TELAS), permitido: z.boolean() });
export type ExcecaoDeTela = z.infer<typeof excecaoDeTela>;
const excecoes = z.array(excecaoDeTela).max(TELAS.length);

export const MODOS_DE_CRIACAO = ["convite", "senha"] as const;

/** Convite (e-mail com link para criar a senha) ou conta criada já com senha. */
export const novoUsuario = z.discriminatedUnion("modo", [
  z.object({
    modo: z.literal("convite"),
    email: emailDeUsuario,
    nome: nomeDePessoa,
    papel,
    departamento: departamento.default(null),
    excecoes: excecoes.default([]),
  }),
  z.object({
    modo: z.literal("senha"),
    email: emailDeUsuario,
    nome: nomeDePessoa,
    papel,
    departamento: departamento.default(null),
    excecoes: excecoes.default([]),
    senha: senhaDefinidaPorAdmin,
  }),
]);
export type NovoUsuario = z.infer<typeof novoUsuario>;

export const usuarioDaEmpresa = z.object({
  id: z.uuid(),
  nome: z.string().nullable(),
  email: z.string(),
  setor: z.enum(SETORES).nullable(),
  departamento: z.string().nullable(),
  papel: z.string().nullable(),
  ativo: z.boolean(),
  /** Já criou a senha (convite aceito ou conta com senha). */
  temSenha: z.boolean(),
  excecoes: z.array(excecaoDeTela),
});
export type UsuarioDaEmpresa = z.infer<typeof usuarioDaEmpresa>;

const parametroUsuario = z.object({ id: z.uuid() });

export const cargo = z.object({
  chave: z.string(),
  rotulo: z.string(),
  protegido: z.boolean(),
  telas: z.array(z.enum(TELAS)),
  usuarios: z.number().int(),
});
export type Cargo = z.infer<typeof cargo>;

export const departamentoDaEmpresa = z.object({
  chave: z.string(),
  rotulo: z.string(),
  descricao: z.string().nullable(),
  ativo: z.boolean(),
  protegido: z.boolean(),
  telas: z.array(z.enum(TELAS)),
  usuarios: z.number().int(),
});
export type DepartamentoDaEmpresa = z.infer<typeof departamentoDaEmpresa>;

const telasDoCadastro = z.array(z.enum(TELAS)).max(TELAS.length);
const parametroChave = z.object({ chave: z.string().min(1).max(64) });

export const GRUPOS_DE_CONFIGURACAO = [
  "performance",
  "operacional",
  "ranking",
  "notificacoes",
] as const;
export type GrupoDeConfiguracao = (typeof GRUPOS_DE_CONFIGURACAO)[number];

export const configuracao = z.object({
  chave: z.string(),
  valor: z.string(),
  descricao: z.string(),
  grupo: z.string(),
  atualizadoEm: z.iso.datetime(),
});
export type Configuracao = z.infer<typeof configuracao>;

export const TIPOS_DE_PRAZO = ["unidade", "parceiro", "transbordo"] as const;
export type TipoDePrazo = (typeof TIPOS_DE_PRAZO)[number];

export const prazoConfigurado = z.object({
  id: z.uuid(),
  tipo: z.enum(TIPOS_DE_PRAZO),
  unidadeCodigo: z.string().nullable(),
  unidadeDestinoCodigo: z.string().nullable(),
  parceiroCnpj: z.string().nullable(),
  parceiroNome: z.string().nullable(),
  prazoHoras: z.number().int().nullable(),
  prazoDias: z.number().int().nullable(),
  ativo: z.boolean(),
  atualizadoEm: z.iso.datetime(),
});
export type PrazoConfigurado = z.infer<typeof prazoConfigurado>;

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const dadosDoPrazo = z.object({
  tipo: z.enum(TIPOS_DE_PRAZO),
  unidadeCodigo: textoOpcional(10),
  unidadeDestinoCodigo: textoOpcional(10),
  parceiroCnpj: textoOpcional(20),
  parceiroNome: textoOpcional(200),
  prazoHoras: z.number().int().min(1).max(720).nullish().default(null),
  prazoDias: z.number().int().min(1).max(90).nullish().default(null),
  ativo: z.boolean().default(true),
});
export type DadosDoPrazo = z.output<typeof dadosDoPrazo>;

/** Gravar uma regra enfileira o recálculo da previsão dos CT-e da empresa (worker). */
const resultadoDoPrazo = z.object({ id: z.uuid(), recalculoAgendado: z.boolean() });

export const contratosAdmin = {
  listarUsuarios: contrato({
    metodo: "GET",
    caminho: "/api/v1/admin/usuarios",
    saida: z.object({ usuarios: z.array(usuarioDaEmpresa) }),
  }),
  criarUsuario: contrato({
    metodo: "POST",
    caminho: "/api/v1/admin/usuarios",
    entrada: novoUsuario,
    saida: z.object({ id: z.uuid() }),
  }),
  alterarUsuario: contrato({
    metodo: "PUT",
    caminho: "/api/v1/admin/usuarios/:id",
    parametros: parametroUsuario,
    entrada: z.object({
      nome: nomeDePessoa,
      email: emailDeUsuario,
      papel,
      departamento,
      ativo: z.boolean(),
      excecoes,
    }),
    saida: ok,
  }),
  reenviarConvite: contrato({
    metodo: "POST",
    caminho: "/api/v1/admin/usuarios/:id/convite",
    parametros: parametroUsuario,
    saida: ok,
  }),
  definirSenha: contrato({
    metodo: "PUT",
    caminho: "/api/v1/admin/usuarios/:id/senha",
    parametros: parametroUsuario,
    entrada: z.object({ senha: senhaDefinidaPorAdmin }),
    saida: ok,
  }),

  listarCargos: contrato({
    metodo: "GET",
    caminho: "/api/v1/admin/cargos",
    saida: z.object({ cargos: z.array(cargo) }),
  }),
  criarCargo: contrato({
    metodo: "POST",
    caminho: "/api/v1/admin/cargos",
    entrada: z.object({
      chave: chaveDeCadastro,
      rotulo: z.string().trim().min(1).max(60),
      telas: telasDoCadastro,
    }),
    saida: ok,
  }),
  alterarCargo: contrato({
    metodo: "PUT",
    caminho: "/api/v1/admin/cargos/:chave",
    parametros: parametroChave,
    entrada: z.object({ rotulo: z.string().trim().min(1).max(60), telas: telasDoCadastro }),
    saida: ok,
  }),
  excluirCargo: contrato({
    metodo: "DELETE",
    caminho: "/api/v1/admin/cargos/:chave",
    parametros: parametroChave,
    saida: ok,
  }),

  listarDepartamentos: contrato({
    metodo: "GET",
    caminho: "/api/v1/admin/departamentos",
    saida: z.object({ departamentos: z.array(departamentoDaEmpresa) }),
  }),
  criarDepartamento: contrato({
    metodo: "POST",
    caminho: "/api/v1/admin/departamentos",
    entrada: z.object({
      chave: chaveDeCadastro,
      rotulo: z.string().trim().min(1).max(60),
      descricao: textoOpcional(300),
      telas: telasDoCadastro,
    }),
    saida: ok,
  }),
  alterarDepartamento: contrato({
    metodo: "PUT",
    caminho: "/api/v1/admin/departamentos/:chave",
    parametros: parametroChave,
    entrada: z.object({
      rotulo: z.string().trim().min(1).max(60),
      descricao: textoOpcional(300),
      ativo: z.boolean(),
      telas: telasDoCadastro,
    }),
    saida: ok,
  }),
  excluirDepartamento: contrato({
    metodo: "DELETE",
    caminho: "/api/v1/admin/departamentos/:chave",
    parametros: parametroChave,
    saida: ok,
  }),

  listarConfiguracoes: contrato({
    metodo: "GET",
    caminho: "/api/v1/admin/configuracoes",
    saida: z.object({ configuracoes: z.array(configuracao) }),
  }),
  salvarConfiguracoes: contrato({
    metodo: "PUT",
    caminho: "/api/v1/admin/configuracoes/:grupo",
    parametros: z.object({ grupo: z.enum(GRUPOS_DE_CONFIGURACAO) }),
    entrada: z.object({
      itens: z
        .array(z.object({ chave: z.string().min(1).max(80), valor: z.string().max(200) }))
        .min(1)
        .max(50),
    }),
    saida: z.object({ atualizados: z.number().int() }),
  }),

  listarPrazos: contrato({
    metodo: "GET",
    caminho: "/api/v1/admin/prazos-configurados",
    saida: z.object({
      regras: z.array(prazoConfigurado),
      unidades: z.array(z.object({ codigo: z.string(), cidade: z.string() })),
      parceiros: z.array(z.object({ cnpj: z.string(), nome: z.string() })),
    }),
  }),
  criarPrazo: contrato({
    metodo: "POST",
    caminho: "/api/v1/admin/prazos-configurados",
    entrada: dadosDoPrazo,
    saida: resultadoDoPrazo,
  }),
  alterarPrazo: contrato({
    metodo: "PUT",
    caminho: "/api/v1/admin/prazos-configurados/:id",
    parametros: z.object({ id: z.uuid() }),
    entrada: dadosDoPrazo,
    saida: resultadoDoPrazo,
  }),
  ligarPrazo: contrato({
    metodo: "PATCH",
    caminho: "/api/v1/admin/prazos-configurados/:id",
    parametros: z.object({ id: z.uuid() }),
    entrada: z.object({ ativo: z.boolean() }),
    saida: resultadoDoPrazo,
  }),
  excluirPrazo: contrato({
    metodo: "DELETE",
    caminho: "/api/v1/admin/prazos-configurados/:id",
    parametros: z.object({ id: z.uuid() }),
    saida: resultadoDoPrazo,
  }),
} as const;

/** Configurações que qualquer usuário da empresa lê (limiares das telas). Sem empresa: `{}`. */
export const contratosConfiguracoes = {
  publicas: contrato({
    metodo: "GET",
    caminho: "/api/v1/configuracoes/publicas",
    saida: z.object({ valores: z.record(z.string(), z.string()) }),
  }),
} as const;
