import { CAMINHO_DA_TELA, ROTULO_DA_TELA, type Tela } from "@erp/shared/access/screens";
import { type Acesso } from "@erp/shared/contracts/auth";
import {
  AlertTriangle,
  BarChart3,
  Bookmark,
  Boxes,
  Building,
  Calendar,
  CalendarDays,
  Clock,
  Database,
  FileArchive,
  FileCheck2,
  FileSpreadsheet,
  FileUp,
  HandCoins,
  History,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  PackageOpen,
  Plug,
  Scale,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";

/** Quem vê: quem tem a tela (as da Plataforma vêm do cargo da pessoa na Plataforma). */
export type Requisito = Tela;

export type AcessoDoMenu = Pick<Acesso, "telas" | "adminPlataforma">;

export function atende(acesso: AcessoDoMenu, requisito: Requisito): boolean {
  return acesso.telas.includes(requisito);
}

/**
 * Aba de uma tela com abas (hub). `valor` vai na URL (`?aba=`); abas com o mesmo `grupo` ficam
 * sob uma aba só (ex.: Importações), escolhidas por um alternador.
 */
export interface AbaDoHub {
  valor: string;
  rotulo: string;
  requisito: Requisito;
  /** Outras telas que também mostram a aba (ex.: Importações junta quatro telas). */
  tambem?: readonly Requisito[];
  icone: LucideIcon;
  grupo?: string;
}

/** Telas que mostram a aba: a dela e as de `tambem`. */
export const requisitosDaAba = (a: AbaDoHub): Requisito[] => [a.requisito, ...(a.tambem ?? [])];

/** Tela com abas: o item do menu aparece se o usuário vê pelo menos uma aba. */
export interface Hub {
  caminho: string;
  abas: readonly AbaDoHub[];
}

/** Administração › Configurações (da empresa ativa). */
export const HUB_CONFIGURACOES: Hub = {
  caminho: "/admin/configuracoes",
  abas: [
    {
      valor: "geral",
      rotulo: "Geral",
      requisito: "admin_configuracoes",
      icone: SlidersHorizontal,
    },
    {
      valor: "codigos",
      rotulo: "Códigos de ocorrências",
      requisito: "admin_codigos",
      icone: ListChecks,
    },
    {
      valor: "ingestao",
      rotulo: "Ingestão SSW",
      grupo: "Importações",
      requisito: "admin_ingestao",
      icone: Database,
    },
    {
      valor: "importacao-ssw",
      rotulo: "Importação SSW",
      grupo: "Importações",
      requisito: "admin_importacao_ssw",
      icone: FileUp,
    },
    {
      valor: "xml-cte",
      rotulo: "Importar XML CT-e",
      grupo: "Importações",
      requisito: "admin_xml_cte",
      icone: FileArchive,
    },
    { valor: "feriados", rotulo: "Feriados", requisito: "admin_historico", icone: CalendarDays },
    { valor: "equipes", rotulo: "Equipes", requisito: "admin_equipes", icone: UsersRound },
  ],
};

/** Plataforma › Configurações (vale para todas as empresas). */
export const HUB_CONFIGURACOES_DA_PLATAFORMA: Hub = {
  caminho: "/plataforma/configuracoes",
  abas: [
    {
      valor: "integracoes",
      rotulo: "Integrações",
      requisito: "plataforma_integracoes",
      icone: Plug,
    },
    {
      valor: "feriados-gerais",
      rotulo: "Feriados gerais",
      requisito: "plataforma_integracoes",
      icone: Calendar,
    },
  ],
};

/**
 * Plataforma › Empresas › {empresa}. As abas de `ABAS_NA_EMPRESA_ATIVA` reaproveitam as telas que
 * operam na empresa ativa da sessão (a página pede a troca antes de mostrá-las).
 */
export const ABAS_DA_EMPRESA: readonly AbaDoHub[] = [
  { valor: "dados", rotulo: "Dados", requisito: "plataforma_empresas", icone: Building },
  { valor: "modulos", rotulo: "Módulos", requisito: "plataforma_empresas", icone: Boxes },
  // Integrações: os sistemas integrados à empresa e tudo o que opera neles.
  {
    valor: "integracoes",
    rotulo: "Sistemas integrados",
    grupo: "Integrações",
    requisito: "plataforma_empresas",
    icone: Plug,
  },
  // Importações: ingestão, importação de relatórios, XML de CT-e e diagnóstico numa tela só; cada
  // seção aparece para quem tem a tela dela.
  {
    valor: "importacoes",
    rotulo: "Importações",
    grupo: "Integrações",
    requisito: "admin_ingestao",
    tambem: ["admin_importacao_ssw", "admin_xml_cte", "admin_ssw_diagnostico"],
    icone: FileUp,
  },
  {
    valor: "logs",
    rotulo: "Logs",
    grupo: "Integrações",
    requisito: "plataforma_logs",
    icone: ScrollText,
  },
];

export const ABAS_NA_EMPRESA_ATIVA: readonly string[] = ["importacoes"];

/** Abas da empresa que viraram seções de Importações: o link antigo abre Importações. */
export const ABAS_ANTIGAS_DE_IMPORTACAO: readonly string[] = [
  "ingestao",
  "importacao-ssw",
  "xml-cte",
  "diagnostico",
];

const HUBS: readonly Hub[] = [HUB_CONFIGURACOES, HUB_CONFIGURACOES_DA_PLATAFORMA];

export function hubDoCaminho(caminho: string): Hub | undefined {
  return HUBS.find((h) => caminho === h.caminho || caminho.startsWith(`${h.caminho}/`));
}

export function abasVisiveis(hub: Pick<Hub, "abas">, acesso: AcessoDoMenu): AbaDoHub[] {
  return hub.abas.filter((a) => requisitosDaAba(a).some((r) => atende(acesso, r)));
}

export interface ItemDoMenu {
  caminho: string;
  rotulo: string;
  icone: LucideIcon;
}

interface ItemDoCatalogo extends ItemDoMenu {
  requisitos: readonly Requisito[];
}

const tela = (t: Tela, rotulo: string, icone: LucideIcon): ItemDoCatalogo => ({
  caminho: CAMINHO_DA_TELA[t],
  rotulo,
  icone,
  requisitos: [t],
});

const hub = (h: Hub, rotulo: string, icone: LucideIcon): ItemDoCatalogo => ({
  caminho: h.caminho,
  rotulo,
  icone,
  requisitos: h.abas.flatMap(requisitosDaAba),
});

const PRINCIPAL: readonly ItemDoCatalogo[] = [
  tela("performance", "Performance", BarChart3),
  // `ranking` e `ranking_novo` levam a /ranking: um item só.
  { ...tela("ranking", "Ranking", Trophy), requisitos: ["ranking", "ranking_novo"] },
  tela("romaneio", "Romaneio", FileSpreadsheet),
  tela("ocorrencias", "Ocorrências", AlertTriangle),
  tela("comprovantes", "Comprovantes", FileCheck2),
  tela("coletas", "Coletas", PackageOpen),
  tela("prazo_parceiro", "Prazo do parceiro", Scale),
  tela("historico", "Histórico", Bookmark),
  tela("calendario", "Calendário", Calendar),
  tela("admin_bonificacao_entrega", "Bonificação de entrega", HandCoins),
  // Só a equipe da Plataforma tem a permissão; a tela opera na empresa ativa.
  tela("admin_ahgora", "Ahgora", Clock),
];

const ADMINISTRACAO: readonly ItemDoCatalogo[] = [
  tela("admin_usuarios", "Usuários e cargos", Users),
  hub(HUB_CONFIGURACOES, "Configurações", Settings),
  tela("admin_logs", "Logs", History),
];

const PLATAFORMA: readonly ItemDoCatalogo[] = [
  tela("plataforma_painel", "Dashboard", LayoutDashboard),
  tela("plataforma_empresas", "Empresas", Building),
  tela("plataforma_admins", "Usuários e cargos", UserCog),
  hub(HUB_CONFIGURACOES_DA_PLATAFORMA, "Configurações", Settings),
  tela("plataforma_logs", "Logs", ScrollText),
];

function itens(catalogo: readonly ItemDoCatalogo[], acesso: AcessoDoMenu): ItemDoMenu[] {
  return catalogo
    .filter((i) => i.requisitos.some((r) => atende(acesso, r)))
    .map(({ caminho, rotulo, icone }) => ({ caminho, rotulo, icone }));
}

/** Menu lateral em três seções, só com o que o usuário pode abrir. */
export function montarMenu(acesso: AcessoDoMenu) {
  return {
    principal: itens(PRINCIPAL, acesso),
    administracao: itens(ADMINISTRACAO, acesso),
    plataforma: itens(PLATAFORMA, acesso),
  };
}

/** Destino da busca rápida: caminho e, numa tela com abas, a aba. */
export interface DestinoDaBusca extends ItemDoMenu {
  grupo: string;
  aba?: string;
}

/** Abas da empresa que só existem lá (ingestão e importação também estão em Administração). */
const ABAS_DA_EMPRESA_NA_BUSCA = ABAS_DA_EMPRESA.filter((a) => a.valor === "importacoes");

/** Telas fora do menu que continuam com página própria (Usuários e cargos as reúne). */
const FORA_DO_MENU: readonly ItemDoCatalogo[] = [
  tela("admin_roles", ROTULO_DA_TELA.admin_roles.replace(/^Admin · /, ""), ShieldCheck),
];

/**
 * Tudo o que a busca rápida acha: os itens do menu, cada aba das telas com abas (com o caminho
 * novo) e as telas que saíram do menu.
 */
export function montarBusca(
  acesso: AcessoDoMenu & { empresa: { id: string; nome: string } | null },
): DestinoDaBusca[] {
  const menu = montarMenu(acesso);
  const comGrupo = (grupo: string, lista: ItemDoMenu[]) => lista.map((i) => ({ ...i, grupo }));
  const abas = (grupo: string, h: Hub) =>
    abasVisiveis(h, acesso).map((a) => ({
      caminho: h.caminho,
      aba: a.valor,
      rotulo: a.rotulo,
      icone: a.icone,
      grupo,
    }));
  const empresa = acesso.empresa;
  const daEmpresa = empresa
    ? abasVisiveis({ abas: ABAS_DA_EMPRESA_NA_BUSCA }, acesso).map((a) => ({
        caminho: `/plataforma/empresas/${empresa.id}`,
        aba: a.valor,
        rotulo: a.rotulo,
        icone: a.icone,
        grupo: `Plataforma › ${empresa.nome}`,
      }))
    : [];
  return [
    ...comGrupo("Telas", menu.principal),
    ...comGrupo("Administração", menu.administracao),
    ...abas("Administração › Configurações", HUB_CONFIGURACOES),
    ...comGrupo("Administração", itens(FORA_DO_MENU, acesso)),
    ...comGrupo("Plataforma", menu.plataforma),
    ...abas("Plataforma › Configurações", HUB_CONFIGURACOES_DA_PLATAFORMA),
    ...daEmpresa,
  ];
}
