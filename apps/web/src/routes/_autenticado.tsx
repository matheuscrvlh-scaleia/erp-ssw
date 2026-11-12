import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { type CSSProperties, useCallback, useState } from "react";

import { decidirAcesso } from "@/acesso/guarda";
import { useEncerrarPorInatividade } from "@/acesso/inatividade";
import { useMarcaDaEmpresa } from "@/acesso/marca";
import { consultaAcesso, sair } from "@/acesso/sessao";
import { BarraLateral } from "@/componentes/layout/BarraLateral";
import { BuscaRapida, useAtalhoDaBusca } from "@/componentes/layout/BuscaRapida";
import { ModuloDesligado } from "@/componentes/layout/ModuloDesligado";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/componentes/ui/sidebar";
import { Skeleton } from "@/componentes/ui/skeleton";
import { ehSessaoVencida } from "@/lib/api";
import { FaixaSaudeSsw } from "@/modulos/ingestao-ssw/FaixaSaudeSsw";

/**
 * Layout das telas logadas. A guarda roda antes de montar a tela (a cada navegação): sem sessão
 * vai ao login; sem permissão, à primeira tela do usuário. Módulo desligado mostra o aviso no
 * lugar da tela. A API confere tudo de novo em cada chamada.
 */
export const Route = createFileRoute("/_autenticado")({
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
  pendingComponent: Carregando,
  component: LayoutAutenticado,
});

/** Esqueleto da tela enquanto o acesso carrega (como no Copiloto RH). */
function Carregando() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="mx-auto min-h-screen w-full max-w-[1600px] space-y-5 px-4 py-8 md:px-8"
    >
      <div className="flex items-center gap-4">
        <Skeleton className="size-12 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-80 max-w-[60vw]" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}

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
