import { type Acesso } from "@erp/shared/contratos/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

import { type ItemDoMenu, montarMenu } from "@/acesso/navegacao";
import { trocarEmpresa } from "@/acesso/sessao";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/componentes/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/componentes/ui/sidebar";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

import { RodapeDaBarra } from "./RodapeDaBarra";

/** Atalho da busca rápida exibido no campo (a busca em si mora no layout). */
const ATALHO =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.userAgent)
    ? "⌘K"
    : "Ctrl K";

export function BarraLateral({
  acesso,
  aoSair,
  aoBuscar,
}: {
  acesso: Acesso;
  aoSair: () => void;
  aoBuscar: () => void;
}) {
  const caminhoAtual = useRouterState({ select: (s) => s.location.pathname });
  const { state, setOpenMobile, isMobile, toggleSidebar } = useSidebar();
  const recolhida = state === "collapsed" && !isMobile;
  const menu = montarMenu(acesso.telas);

  const ativo = (caminho: string) =>
    caminho !== "/" && (caminhoAtual === caminho || caminhoAtual.startsWith(`${caminho}/`));

  const desenharItem = (item: ItemDoMenu) => {
    const Icone = item.icone;
    const estaAtivo = ativo(item.caminho);
    return (
      <SidebarMenuItem key={item.caminho} className="relative">
        <SidebarMenuButton
          asChild
          isActive={estaAtivo}
          tooltip={item.rotulo}
          className={cn(
            "h-9 gap-3 rounded-lg border border-transparent px-3 text-[13px] font-medium",
            "data-[active=true]:border-sidebar-border data-[active=true]:bg-sidebar-accent",
            "data-[active=true]:font-semibold [&[data-active=true]>svg]:text-sidebar-primary",
          )}
        >
          <Link
            to={item.caminho}
            onClick={() => {
              if (isMobile) setOpenMobile(false);
            }}
            aria-current={estaAtivo ? "page" : undefined}
          >
            <Icone className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="truncate">{item.rotulo}</span>
          </Link>
        </SidebarMenuButton>
        {estaAtivo && !recolhida && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1.5 -right-2 bottom-1.5 w-[3px] rounded-full bg-sidebar-primary"
          />
        )}
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader className="gap-3 px-3 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <Logo acesso={acesso} />
          {!recolhida && (
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[15px] font-bold text-white">
                {acesso.empresa?.nome ?? "Painel BI"}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">Painel Logístico</span>
            </span>
          )}
          {!isMobile && !recolhida && (
            <button
              type="button"
              onClick={toggleSidebar}
              title="Recolher menu (Ctrl B)"
              aria-label="Recolher menu"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white"
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
        {recolhida ? (
          <div className="flex flex-col items-center gap-1">
            <BotaoIcone rotulo="Expandir menu (Ctrl B)" aoClicar={toggleSidebar}>
              <PanelLeftOpen className="h-4 w-4" aria-hidden />
            </BotaoIcone>
            <BotaoIcone rotulo={`Buscar (${ATALHO})`} aoClicar={aoBuscar}>
              <Search className="h-4 w-4" aria-hidden />
            </BotaoIcone>
          </div>
        ) : (
          <>
            <div className="border-t border-dashed border-sidebar-border" />
            <button
              type="button"
              onClick={aoBuscar}
              className="flex h-10 w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-campo px-3 text-[13px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1 text-left">Buscar</span>
              <kbd className="rounded-md border border-sidebar-border bg-sidebar-accent px-1.5 py-0.5 font-sans text-[11px] text-sidebar-foreground">
                {ATALHO}
              </kbd>
            </button>
            <SeletorDeEmpresa acesso={acesso} />
          </>
        )}
      </SidebarHeader>
      <SidebarContent className="gap-1 px-3 pb-2">
        <Secao titulo="Menu principal" recolhida={recolhida}>
          <SidebarMenu className="gap-1">{menu.principal.map(desenharItem)}</SidebarMenu>
        </Secao>
        <SecaoRecolhivel
          titulo="Admin"
          chave="admin"
          itens={menu.admin}
          recolhida={recolhida}
          algumAtivo={menu.admin.some((i) => ativo(i.caminho))}
          desenharItem={desenharItem}
        />
        <SecaoRecolhivel
          titulo="Plataforma"
          chave="plataforma"
          itens={menu.plataforma}
          recolhida={recolhida}
          algumAtivo={menu.plataforma.some((i) => ativo(i.caminho))}
          desenharItem={desenharItem}
        />
      </SidebarContent>
      <SidebarFooter className="px-3 pt-2 pb-3">
        <RodapeDaBarra acesso={acesso} recolhida={recolhida} aoSair={aoSair} />
      </SidebarFooter>
    </Sidebar>
  );
}

function Logo({ acesso }: { acesso: Acesso }) {
  const classe =
    "h-9 w-9 shrink-0 rounded-lg group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8";
  if (acesso.empresa?.logoUrl) {
    return (
      <img
        src={acesso.empresa.logoUrl}
        alt={acesso.empresa.nome}
        className={cn(classe, "bg-white object-cover")}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        classe,
        "flex items-center justify-center bg-sidebar-primary text-[12px] font-bold text-sidebar-primary-foreground",
      )}
    >
      {(acesso.empresa?.nomeCurto ?? "BI").slice(0, 3).toUpperCase()}
    </span>
  );
}

function BotaoIcone({
  rotulo,
  aoClicar,
  children,
}: {
  rotulo: string;
  aoClicar: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      title={rotulo}
      aria-label={rotulo}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white"
    >
      {children}
    </button>
  );
}

function Secao({
  titulo,
  recolhida,
  children,
}: {
  titulo: string;
  recolhida: boolean;
  children: ReactNode;
}) {
  return (
    <div className="pt-2">
      {!recolhida && (
        <div className="px-1 pb-2 text-[12px] font-semibold text-white/90">{titulo}</div>
      )}
      {children}
    </div>
  );
}

function lerAberta(chave: string): boolean {
  try {
    return window.localStorage.getItem(chave) !== "0";
  } catch {
    return true;
  }
}

/** Seção recolhível do menu (Admin, Plataforma). Lembra aberta/fechada por navegador. */
function SecaoRecolhivel({
  titulo,
  chave,
  itens,
  recolhida,
  algumAtivo,
  desenharItem,
}: {
  titulo: string;
  chave: string;
  itens: ItemDoMenu[];
  recolhida: boolean;
  algumAtivo: boolean;
  desenharItem: (item: ItemDoMenu) => ReactNode;
}) {
  const chaveGuardada = `sidebar:${chave}-open`;
  const [aberta, setAberta] = useState(() => lerAberta(chaveGuardada));

  useEffect(() => {
    if (algumAtivo) setAberta(true);
  }, [algumAtivo]);

  useEffect(() => {
    try {
      window.localStorage.setItem(chaveGuardada, aberta ? "1" : "0");
    } catch {
      // navegador sem storage: segue sem lembrar
    }
  }, [aberta, chaveGuardada]);

  if (itens.length === 0) return null;
  return (
    <div className="mt-2 border-t border-dashed border-sidebar-border pt-3">
      {!recolhida && (
        <button
          type="button"
          onClick={() => {
            setAberta((v) => !v);
          }}
          aria-expanded={aberta}
          className="flex w-full items-center justify-between rounded-md px-1 pb-2 text-[12px] font-semibold text-white/90 transition-colors hover:text-white"
        >
          <span>
            {titulo} <span className="font-normal text-muted-foreground">· {itens.length}</span>
          </span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", aberta ? "rotate-0" : "-rotate-90")}
            aria-hidden
          />
        </button>
      )}
      {(recolhida || aberta) && (
        <SidebarMenu className="gap-1">{itens.map(desenharItem)}</SidebarMenu>
      )}
    </div>
  );
}

/**
 * Seletor de empresa: só para a Plataforma ou para quem tem mais de uma empresa. Depois da troca o
 * cache inteiro é jogado fora (senão a tela mostraria dados da empresa anterior por até 15 min) e
 * a página recarrega, sem sobrar estado de tela da empresa anterior (docs/regras/05 §1.4).
 */
function SeletorDeEmpresa({ acesso }: { acesso: Acesso }) {
  const queryClient = useQueryClient();
  const [trocando, setTrocando] = useState(false);

  if (!acesso.adminPlataforma && acesso.empresas.length <= 1) return null;

  const aoTrocar = async (empresaId: string) => {
    if (empresaId === acesso.empresa?.id) return;
    setTrocando(true);
    try {
      await trocarEmpresa(empresaId);
      queryClient.clear();
      window.location.reload();
    } catch (e) {
      toast.error(mensagemAmigavel(e, "Não foi possível trocar de empresa."));
      setTrocando(false);
    }
  };

  return (
    <Select
      value={acesso.empresa?.id ?? ""}
      onValueChange={(id) => void aoTrocar(id)}
      disabled={trocando}
    >
      <SelectTrigger
        className="h-9 border-sidebar-border bg-campo text-[13px] text-white"
        aria-label="Empresa ativa"
      >
        <SelectValue placeholder="Escolha a empresa" />
      </SelectTrigger>
      <SelectContent>
        {acesso.empresas.map((e) => (
          <SelectItem key={e.id} value={e.id} className="text-[13px]">
            {e.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
