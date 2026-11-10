import { ROTULO_DO_SETOR } from "@erp/shared/acesso/papeis";
import { type Acesso } from "@erp/shared/contratos/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, LogOut } from "lucide-react";
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

export function BarraLateral({ acesso, aoSair }: { acesso: Acesso; aoSair: () => void }) {
  const caminhoAtual = useRouterState({ select: (s) => s.location.pathname });
  const { state, setOpenMobile, isMobile } = useSidebar();
  const recolhida = state === "collapsed" && !isMobile;
  const menu = montarMenu(acesso.telas);
  const { nome, email } = acesso.usuario;
  const iniciais = (nome ?? email).slice(0, 2).toUpperCase();

  const ativo = (caminho: string) =>
    caminho !== "/" && (caminhoAtual === caminho || caminhoAtual.startsWith(`${caminho}/`));

  const desenharItem = (item: ItemDoMenu) => {
    const Icone = item.icone;
    const estaAtivo = ativo(item.caminho);
    return (
      <SidebarMenuItem key={item.caminho}>
        <SidebarMenuButton
          asChild
          isActive={estaAtivo}
          tooltip={item.rotulo}
          className="text-[12.5px]"
        >
          <Link
            to={item.caminho}
            onClick={() => {
              if (isMobile) setOpenMobile(false);
            }}
            aria-current={estaAtivo ? "page" : undefined}
          >
            <Icone className="h-[15px] w-[15px] shrink-0" />
            <span className="truncate">{item.rotulo}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          {acesso.empresa?.logoUrl ? (
            <img
              src={acesso.empresa.logoUrl}
              alt={acesso.empresa.nome}
              className="h-10 w-10 shrink-0 rounded-md object-cover group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-[13px] font-semibold text-[var(--sidebar)] group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
            >
              {(acesso.empresa?.nomeCurto ?? "BI").slice(0, 3).toUpperCase()}
            </span>
          )}
          {!recolhida && (
            <span className="flex flex-col leading-tight">
              <span className="text-[14px] font-semibold">
                {acesso.empresa?.nome ?? "Painel BI"}
              </span>
              <span className="text-[10px] text-muted-foreground">Painel Logístico</span>
            </span>
          )}
        </div>
        {!recolhida && <SeletorDeEmpresa acesso={acesso} />}
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>{menu.principal.map(desenharItem)}</SidebarMenu>
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
      <SidebarFooter>
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-foreground">
            {iniciais}
          </div>
          {!recolhida && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11.5px] font-medium text-foreground">
                  {nome ?? "—"}
                </div>
                <div className="truncate text-[9.5px] text-muted-foreground">
                  {acesso.setor ? ROTULO_DO_SETOR[acesso.setor] : "Sem setor"}
                </div>
              </div>
              <button
                type="button"
                onClick={aoSair}
                className="text-muted-foreground transition-colors hover:text-destructive"
                title="Sair"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
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
    <div className="mt-3 border-t border-border/60 pt-2">
      {!recolhida && (
        <button
          type="button"
          onClick={() => {
            setAberta((v) => !v);
          }}
          aria-expanded={aberta}
          className="flex w-full items-center justify-between rounded-md px-3 py-1 text-[10px] tracking-wider text-muted-foreground uppercase transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-[var(--brand)] focus-visible:outline-none"
        >
          <span>
            {titulo} <span className="text-muted-foreground/70">· {itens.length}</span>
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${aberta ? "rotate-0" : "-rotate-90"}`}
          />
        </button>
      )}
      {(recolhida || aberta) && (
        <SidebarMenu className="pt-1">{itens.map(desenharItem)}</SidebarMenu>
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
      toast.error(e instanceof Error ? e.message : "Não foi possível trocar de empresa.");
      setTrocando(false);
    }
  };

  return (
    <div className="px-2 pb-1">
      <Select
        value={acesso.empresa?.id ?? ""}
        onValueChange={(id) => void aoTrocar(id)}
        disabled={trocando}
      >
        <SelectTrigger className="h-8 text-[12px]" aria-label="Empresa ativa">
          <SelectValue placeholder="Escolha a empresa" />
        </SelectTrigger>
        <SelectContent>
          {acesso.empresas.map((e) => (
            <SelectItem key={e.id} value={e.id} className="text-[12px]">
              {e.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
