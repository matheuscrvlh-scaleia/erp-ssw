import { contratosAuth } from "@erp/shared/contratos/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mail, ShieldOff } from "lucide-react";

import { sair } from "@/acesso/sessao";
import { Button } from "@/componentes/ui/button";
import { chamar } from "@/lib/api";

export const Route = createFileRoute("/_autenticado/sem-acesso")({
  component: PaginaSemAcesso,
});

function PaginaSemAcesso() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["ajuda-acesso"],
    queryFn: () => chamar(contratosAuth.ajudaAcesso),
  });

  const aoSair = async () => {
    await sair().catch(() => undefined);
    queryClient.clear();
    await navigate({ to: "/login", search: { reason: "signed_out" } });
  };

  const inativa = data ? !data.ativo : false;

  return (
    <div className="mx-auto max-w-lg py-16">
      <div className="rounded-[12px] border border-border/70 bg-card p-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <ShieldOff className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-[18px] font-medium tracking-tight">
              {inativa ? "Conta desativada" : "Sem acesso a nenhuma tela"}
            </h1>
            <p className="text-[12px] text-muted-foreground">
              {inativa
                ? "Sua conta foi desativada por um administrador."
                : "Seu nível de acesso ainda não libera nenhum módulo."}
            </p>
          </div>
        </div>

        {data && (
          <div className="mt-5 space-y-3 border-t border-border/60 pt-4 text-[12px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Usuário</span>
              <span>{data.nome ?? data.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nível atual</span>
              <span>{data.papelRotulo ?? "Sem nível"}</span>
            </div>
          </div>
        )}

        {data && data.admins.length > 0 && (
          <div className="mt-5 border-t border-border/60 pt-4">
            <p className="text-[11px] tracking-wider text-muted-foreground uppercase">
              Quem pode liberar
            </p>
            <ul className="mt-2 space-y-1.5">
              {data.admins.map((a) => (
                <li key={a.email} className="flex items-center justify-between text-[12px]">
                  <span>{a.nome ?? a.email}</span>
                  <a
                    href={`mailto:${a.email}?subject=${encodeURIComponent("Liberação de acesso")}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Mail className="h-3 w-3" />
                    {a.email}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => void aoSair()}>
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
