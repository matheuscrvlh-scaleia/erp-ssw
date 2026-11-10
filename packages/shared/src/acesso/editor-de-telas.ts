import { type Tela, TELAS, TELAS_POR_REGRA, TELAS_SO_PLATAFORMA } from "./telas";

/**
 * O que os editores de cargo, departamento e exceção de usuário mostram. Telas da Plataforma e as
 * concedidas por regra (Logs) nunca vêm de cadastro; `ranking_novo` anda junto com `ranking`.
 * origem: EDITABLE_SCREENS, SCREEN_CATEGORIES, chavesDoItem (src/lib/permissions.ts, sistema atual)
 */
export const TELAS_EDITAVEIS: readonly Tela[] = TELAS.filter(
  (t) => t !== "ranking_novo" && !TELAS_SO_PLATAFORMA.includes(t) && !TELAS_POR_REGRA.includes(t),
);

/** Telas que um cadastro pode gravar: as editáveis e a chave gêmea do Ranking. */
export const TELAS_GRAVAVEIS: readonly Tela[] = [...TELAS_EDITAVEIS, "ranking_novo"];

export function ehTelaGravavel(tela: string): tela is Tela {
  return (TELAS_GRAVAVEIS as readonly string[]).includes(tela);
}

/** O item "Ranking" marca e desmarca as duas chaves. */
export function chavesDoItem(tela: Tela): Tela[] {
  return tela === "ranking" ? ["ranking", "ranking_novo"] : [tela];
}

export function itemMarcado(tela: Tela, marcadas: ReadonlySet<string>): boolean {
  return chavesDoItem(tela).some((t) => marcadas.has(t));
}

export function contarItens(telas: Iterable<string>): number {
  const marcadas = new Set(telas);
  return TELAS_EDITAVEIS.filter((t) => itemMarcado(t, marcadas)).length;
}

export interface CategoriaDeTela {
  chave: string;
  rotulo: string;
  descricao: string;
  telas: readonly Tela[];
}

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
    descricao: "Só vale se o nível for admin/super admin",
    telas: [
      "admin_usuarios",
      "admin_roles",
      "admin_departamentos",
      "admin_codigos",
      "admin_equipes",
      "admin_bonificacao",
    ],
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
