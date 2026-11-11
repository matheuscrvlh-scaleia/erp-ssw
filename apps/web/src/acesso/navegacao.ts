import { CAMINHO_DA_TELA, ROTULO_DA_TELA, type Tela, TELAS_ADMIN } from "@erp/shared/acesso/telas";
import {
  AlertTriangle,
  BarChart3,
  Bookmark,
  Building,
  Building2,
  Calendar,
  CalendarDays,
  Clock,
  Coins,
  Database,
  Eye,
  FileArchive,
  FileCheck2,
  FileSpreadsheet,
  FileUp,
  HandCoins,
  History,
  type LucideIcon,
  Medal,
  PackageOpen,
  Plug,
  Scale,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  Trophy,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";

const ICONE_DA_TELA: Record<Tela, LucideIcon> = {
  performance: BarChart3,
  romaneio: FileSpreadsheet,
  ocorrencias: AlertTriangle,
  comprovantes: FileCheck2,
  coletas: PackageOpen,
  prazo_parceiro: Scale,
  historico: Bookmark,
  calendario: Calendar,
  ranking: Trophy,
  ranking_novo: Medal,
  admin_usuarios: Users,
  admin_roles: ShieldCheck,
  admin_departamentos: Building2,
  admin_codigos: Settings,
  admin_ingestao: Database,
  admin_importacao_ssw: FileUp,
  admin_historico: CalendarDays,
  admin_equipes: UsersRound,
  admin_bonificacao: Coins,
  admin_configuracoes: SlidersHorizontal,
  admin_xml_cte: FileArchive,
  admin_ahgora: Clock,
  admin_bonificacao_entrega: HandCoins,
  romaneio_placa: Eye,
  admin_logs: History,
  admin_ssw_diagnostico: Stethoscope,
  plataforma_empresas: Building,
  plataforma_logs: ScrollText,
  plataforma_admins: UserCog,
  plataforma_integracoes: Plug,
};

/** Ordem do menu principal. `ranking` e `ranking_novo` levam a /ranking: viram um item só. */
const ORDEM_PRINCIPAL: readonly Tela[] = [
  "performance",
  "ranking",
  "ranking_novo",
  "romaneio",
  "ocorrencias",
  "comprovantes",
  "coletas",
  "prazo_parceiro",
  "historico",
  "calendario",
];

const ORDEM_ADMIN: readonly Tela[] = [
  "admin_usuarios",
  "admin_roles",
  "admin_departamentos",
  "admin_codigos",
  "admin_configuracoes",
  "admin_historico",
  "admin_equipes",
  "admin_bonificacao_entrega",
  "admin_logs",
];

const ORDEM_PLATAFORMA: readonly Tela[] = [
  "plataforma_empresas",
  "plataforma_logs",
  "plataforma_admins",
  "plataforma_integracoes",
  "admin_ingestao",
  "admin_importacao_ssw",
  "admin_xml_cte",
  "admin_ssw_diagnostico",
  "admin_ahgora",
];

export interface ItemDoMenu {
  caminho: string;
  rotulo: string;
  icone: LucideIcon;
}

function itens(ordem: readonly Tela[], telas: readonly Tela[]): ItemDoMenu[] {
  const vistos = new Set<string>();
  return ordem
    .filter((t) => telas.includes(t))
    .flatMap((t) => {
      const caminho = CAMINHO_DA_TELA[t];
      if (vistos.has(caminho)) return [];
      vistos.add(caminho);
      const rotulo = TELAS_ADMIN.includes(t)
        ? ROTULO_DA_TELA[t].replace(/^(Admin|Plataforma) · /, "")
        : ROTULO_DA_TELA[t];
      return [{ caminho, rotulo, icone: ICONE_DA_TELA[t] }];
    });
}

/** Menu lateral em três seções, só com as telas liberadas e sem caminho repetido. */
export function montarMenu(telas: readonly Tela[]) {
  return {
    principal: itens(ORDEM_PRINCIPAL, telas),
    admin: itens(ORDEM_ADMIN, telas),
    plataforma: itens(ORDEM_PLATAFORMA, telas),
  };
}
