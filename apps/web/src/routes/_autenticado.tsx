import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { type CSSProperties } from "react";

import { decidirAcesso } from "@/acesso/guarda";
import { useMarcaDaEmpresa } from "@/acesso/marca";
import { consultaAcesso, sair } from "@/acesso/sessao";
import { BarraLateral } from "@/componentes/layout/BarraLateral";
import { ModuloDesligado } from "@/componentes/layout/ModuloDesligado";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/componentes/ui/sidebar";
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

function Carregando() {
  return (
    <div className="flex min-h-screen items-center justify-center text-[13px] text-muted-foreground">
      Carregando…
    </div>
  );
}

const LARGURAS: CSSProperties & Record<`--${string}`, string> = {
  "--sidebar-width": "13rem",
  "--sidebar-width-icon": "3rem",
};

function LayoutAutenticado() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  useMarcaDaEmpresa(acesso.empresa);

  const aoSair = async () => {
    await sair().catch(() => undefined);
    queryClient.clear();
    await navigate({ to: "/login", search: { reason: "signed_out" } });
  };

  if (caminho === "/sem-acesso") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-6">
          <Outlet />
        </main>
      </div>
    );
  }

  const decisao = decidirAcesso(acesso, caminho);
  return (
    <SidebarProvider style={LARGURAS}>
      <BarraLateral acesso={acesso} aoSair={() => void aoSair()} />
      <SidebarInset className="min-w-0 bg-background text-foreground">
        <header className="flex h-12 items-center gap-2 border-b border-border/70 bg-[var(--marca-primaria,#212a63)] px-3 text-white">
          <SidebarTrigger className="text-white hover:bg-white/10" />
          <span className="text-sm font-medium md:hidden">Painel BI</span>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6">
          {acesso.empresa && <FaixaSaudeSsw empresaId={acesso.empresa.id} />}
          {decisao.tipo === "modulo_desligado" ? (
            <ModuloDesligado moduloNome={decisao.moduloNome} />
          ) : (
            <Outlet />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
