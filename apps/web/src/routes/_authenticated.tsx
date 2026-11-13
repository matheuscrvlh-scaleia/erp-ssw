import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { type CSSProperties, useCallback, useState } from "react";

import { useMarcaDaEmpresa } from "@/access/brand";
import { decidirAcesso } from "@/access/guard";
import { useEncerrarPorInatividade } from "@/access/inactivity";
import { consultaAcesso, sair } from "@/access/session";
import { ModuloDesligado } from "@/components/layout/ModuleDisabled";
import { BuscaRapida, useAtalhoDaBusca } from "@/components/layout/QuickSearch";
import { EsqueletoDaTela } from "@/components/layout/ScreenSkeleton";
import { BarraLateral } from "@/components/layout/Sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ehSessaoVencida } from "@/lib/api";
import { FaixaSaudeSsw } from "@/modules/ssw-ingestion/components/SswHealthStrip";

/**
 * Layout das telas logadas. A guarda roda antes de montar a tela (a cada navegação): sem sessão
 * vai ao login; sem permissão, à primeira tela do usuário. Módulo desligado mostra o aviso no
 * lugar da tela. A API confere tudo de novo em cada chamada.
 */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context, location }) => {
    const acesso = await context.queryClient.query(consultaAcesso).catch((e: unknown) => {
      if (ehSessaoVencida(e)) {
        throw redirect({ to: "/login", search: { redirect: location.href } });
      }
      throw e;
    });
    const decisao = decidirAcesso(acesso, location.pathname);
    if (decisao.tipo === "redirecionar") throw redirect({ href: decisao.para });
  },
  // Logo depois do login o acesso ainda está carregando: o esqueleto entra na hora, no lugar do
  // botão "Aguarde..." parado no login.
  pendingComponent: EsqueletoDaTela,
  pendingMs: 0,
  pendingMinMs: 200,
  component: LayoutAutenticado,
});

const LARGURAS: CSSProperties & Record<`--${string}`, string> = {
  "--sidebar-width": "17rem",
  "--sidebar-width-icon": "3.5rem",
};

function LayoutAutenticado() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  useMarcaDaEmpresa(acesso.empresa);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const abrirBusca = useCallback(() => {
    setBuscaAberta(true);
  }, []);
  useAtalhoDaBusca(abrirBusca);
  const encerrarPorInatividade = useCallback(() => {
    void (async () => {
      const { pathname, search } = window.location;
      await sair().catch(() => undefined);
      queryClient.clear();
      await navigate({ to: "/login", search: { redirect: `${pathname}${search}` } });
    })();
  }, [queryClient, navigate]);
  useEncerrarPorInatividade(encerrarPorInatividade);

  const aoSair = async () => {
    await sair().catch(() => undefined);
    queryClient.clear();
    await navigate({ to: "/login" });
  };

  if (caminho === "/sem-acesso") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-[1600px] px-4 py-8 md:px-8">
          <Outlet />
        </div>
      </div>
    );
  }

  const decisao = decidirAcesso(acesso, caminho);
  return (
    <SidebarProvider style={LARGURAS} className="bg-background">
      <BarraLateral acesso={acesso} aoSair={() => void aoSair()} aoBuscar={abrirBusca} />
      <SidebarInset className="min-w-0 bg-background text-foreground">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-3 md:hidden">
          <SidebarTrigger />
          <span className="truncate text-[15px] font-bold">
            {acesso.empresa?.nome ?? "Painel BI"}
          </span>
        </header>
        {acesso.empresa && <FaixaSaudeSsw empresaId={acesso.empresa.id} />}
        {decisao.tipo === "modulo_desligado" ? (
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8">
            <ModuloDesligado moduloNome={decisao.moduloNome} />
          </div>
        ) : (
          <Outlet />
        )}
      </SidebarInset>
      <BuscaRapida acesso={acesso} aberta={buscaAberta} aoMudar={setBuscaAberta} />
    </SidebarProvider>
  );
}
