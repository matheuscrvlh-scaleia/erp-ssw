import { type Tela, TELAS, TELAS_POR_REGRA, TELAS_SO_PLATAFORMA } from "./telas";

/*
 * Permissões por ação: para cada tela, Ver / Criar-Editar / Excluir (`tela.acao`). O cargo é o
 * grupo de usuários com as suas permissões; a exceção por usuário concede ou nega uma permissão.
 * Tela só de leitura tem só "Ver". Referência: construgarden (permissionMatrix.ts).
 */

export const ACOES = ["ver", "editar", "excluir"] as const;
export type Acao = (typeof ACOES)[number];

export const ROTULO_DA_ACAO: Record<Acao, string> = {
  ver: "Ver",
  editar: "Criar/Editar",
  excluir: "Excluir",
};

const SO_VER: readonly Acao[] = ["ver"];
const VER_EDITAR: readonly Acao[] = ["ver", "editar"];

/** O que dá para fazer em cada tela (a API confere a ação de cada endpoint de escrita). */
export const ACOES_DA_TELA: Record<Tela, readonly Acao[]> = {
  performance: SO_VER,
  romaneio: SO_VER,
  ocorrencias: SO_VER,
  comprovantes: SO_VER,
  coletas: VER_EDITAR,
  prazo_parceiro: SO_VER,
  historico: ACOES,
  calendario: ACOES,
  ranking: SO_VER,
  ranking_novo: SO_VER,
  admin_usuarios: VER_EDITAR,
  admin_codigos: VER_EDITAR,
  admin_roles: ACOES,
  admin_ingestao: VER_EDITAR,
  admin_importacao_ssw: ACOES,
  admin_historico: ACOES,
  admin_equipes: ACOES,
  admin_bonificacao: ACOES,
  admin_configuracoes: ACOES,
  admin_xml_cte: VER_EDITAR,
  admin_ahgora: VER_EDITAR,
  admin_bonificacao_entrega: ACOES,
  romaneio_placa: SO_VER,
  admin_logs: SO_VER,
  admin_ssw_diagnostico: VER_EDITAR,
  plataforma_painel: SO_VER,
  plataforma_empresas: ACOES,
  plataforma_logs: SO_VER,
  plataforma_admins: ACOES,
  plataforma_integracoes: VER_EDITAR,
};

export type Permissao = `${Tela}.${Acao}`;

/** Exceção por usuário: "Sim" concede mesmo sem o cargo, "Não" nega mesmo com ele. */
export const EFEITOS = ["concede", "nega"] as const;
export type Efeito = (typeof EFEITOS)[number];

export function permissao(tela: Tela, acao: Acao): Permissao {
  return `${tela}.${acao}`;
}

function permissoesDas(telas: readonly Tela[]): Permissao[] {
  return telas.flatMap((t) => ACOES_DA_TELA[t].map((a) => permissao(t, a)));
}

/** Catálogo inteiro, na ordem das telas e das ações. */
export const PERMISSOES: readonly Permissao[] = permissoesDas(TELAS);

export function ehPermissao(valor: string): valor is Permissao {
  return (PERMISSOES as readonly string[]).includes(valor);
}

/** Tela e ação de uma permissão (`admin_roles.excluir` → `admin_roles`, `excluir`). */
export function partesDaPermissao(p: Permissao): { tela: Tela; acao: Acao } {
  for (const tela of TELAS) {
    const acao = ACOES.find((a) => p === permissao(tela, a));
    if (acao) return { tela, acao };
  }
  throw new Error(`permissão fora do catálogo: ${p}`);
}

/** Telas com "Ver" nas permissões, na ordem do catálogo. */
export function telasComVer(permissoes: Iterable<string>): Tela[] {
  const conjunto = new Set(permissoes);
  return TELAS.filter((t) => conjunto.has(permissao(t, "ver")));
}

/** Telas que cargo e exceção podem dar: as da Plataforma e as dadas por regra (Logs) não. */
export const TELAS_GRAVAVEIS: readonly Tela[] = TELAS.filter(
  (t) => !TELAS_SO_PLATAFORMA.includes(t) && !TELAS_POR_REGRA.includes(t),
);

/** Tudo o que um cargo pode ter: é também o que o cargo Admin tem (o catálogo da empresa). */
export const PERMISSOES_GRAVAVEIS: readonly Permissao[] = permissoesDas(TELAS_GRAVAVEIS);

export function ehPermissaoGravavel(valor: string): valor is Permissao {
  return (PERMISSOES_GRAVAVEIS as readonly string[]).includes(valor);
}

/** Itens dos editores (cargo, matriz, exceção): `ranking_novo` anda junto com `ranking`. */
export const TELAS_EDITAVEIS: readonly Tela[] = TELAS_GRAVAVEIS.filter((t) => t !== "ranking_novo");

/** O item "Ranking" marca e desmarca as duas chaves. */
export function chavesDoItem(tela: Tela): Tela[] {
  return tela === "ranking" ? ["ranking", "ranking_novo"] : [tela];
}

export interface CategoriaDeTela {
  chave: string;
  rotulo: string;
  descricao: string;
  telas: readonly Tela[];
}

/** origem: SCREEN_CATEGORIES (src/lib/permissions.ts, sistema atual) */
export const CATEGORIAS_DE_TELA: readonly CategoriaDeTela[] = [
  {
    chave: "operacional",
    rotulo: "Operacional",
    descricao: "Telas de acompanhamento do dia a dia",
    telas: [
      "performance",
      "romaneio",
      "ocorrencias",
      "comprovantes",
      "coletas",
      "prazo_parceiro",
      "ranking",
    ],
  },
  {
    chave: "consulta",
    rotulo: "Consulta",
    descricao: "Histórico e calendário",
    telas: ["historico", "calendario"],
  },
  {
    chave: "admin_cadastros",
    rotulo: "Administração · Cadastros",
    descricao: "Por exceção individual, só valem para admin (gestor: só Bonificação de entrega)",
    telas: ["admin_usuarios", "admin_roles", "admin_codigos", "admin_equipes", "admin_bonificacao"],
  },
  {
    chave: "admin_sistema",
    rotulo: "Administração · Sistema",
    descricao: "Feriados, configurações e bonificação de entrega",
    telas: ["admin_historico", "admin_configuracoes", "admin_bonificacao_entrega"],
  },
  {
    chave: "recursos",
    rotulo: "Recursos dentro das telas",
    descricao: "Liberam uma informação dentro de uma tela já acessível",
    telas: ["romaneio_placa"],
  },
];
