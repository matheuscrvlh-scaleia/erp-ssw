import { ROTULO_DO_SETOR } from "@erp/shared/acesso/papeis";
import { type Acesso } from "@erp/shared/contratos/auth";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Bell, BellOff, LogOut, Moon, Sun } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { Switch } from "@/componentes/ui/switch";
import { definirTema, useTema } from "@/lib/tema";
import { cn } from "@/lib/utils";

import { type Aviso, useAvisos } from "./avisos";

/**
 * Rodapé fixo da barra lateral (mockups/bottom fixed navbar.png): tema claro/escuro, sino de
 * avisos, usuário com sair e a assinatura. Recolhida, vira uma coluna de ícones.
 */
export function RodapeDaBarra({
  acesso,
  recolhida,
  aoSair,
}: {
  acesso: Acesso;
  recolhida: boolean;
  aoSair: () => void;
}) {
  const tema = useTema();
  const avisos = useAvisos(acesso);
  const { nome, email } = acesso.usuario;
  const iniciais = iniciaisDe(nome ?? email);
  const setor = acesso.setor ? ROTULO_DO_SETOR[acesso.setor] : "Sem setor";
  const escuro = tema === "escuro";
  const IconeTema = escuro ? Moon : Sun;
  const trocarTema = () => {
    definirTema(escuro ? "claro" : "escuro");
  };

  if (recolhida) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={trocarTema}
          title={escuro ? "Usar tema claro" : "Usar tema escuro"}
          aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
        >
          <IconeTema className="h-4 w-4" aria-hidden />
        </button>
        <SinoDeAvisos avisos={avisos} />
        <span
          title={`${nome ?? email} · ${setor}`}
          className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary/20 text-[11px] font-bold text-sidebar-primary"
        >
          {iniciais}
        </span>
        <button
          type="button"
          onClick={aoSair}
          title="Sair"
          aria-label="Sair"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="flex h-11 flex-1 cursor-pointer items-center gap-2.5 rounded-xl border border-sidebar-border bg-campo px-3 text-[13px] font-medium text-white">
          <IconeTema
            className={cn("h-[18px] w-[18px]", escuro ? "text-sidebar-primary" : "text-amber-400")}
            aria-hidden
          />
          <span className="flex-1">{escuro ? "Escuro" : "Claro"}</span>
          <Switch
            checked={escuro}
            onCheckedChange={trocarTema}
            aria-label="Tema escuro"
            className="data-[state=checked]:bg-sidebar-primary data-[state=unchecked]:bg-white/20"
          />
        </label>
        <SinoDeAvisos avisos={avisos} grande />
      </div>
      <div className="flex items-center gap-3 px-0.5">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-[13px] font-bold text-sidebar-primary"
        >
          {iniciais}
        </span>
        <div className="min-w-0 flex-1" title={setor}>
          <div className="truncate text-[13.5px] font-bold text-white">{nome ?? "—"}</div>
          <div className="truncate text-[12px] text-muted-foreground">{email}</div>
        </div>
        <button
          type="button"
          onClick={aoSair}
          title="Sair"
          aria-label="Sair"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>
      <p className="text-center text-[11.5px] text-muted-foreground">
        Desenvolvido por{" "}
        <a
          href="https://scaleia.ai"
          target="_blank"
          rel="noreferrer"
          className="font-bold text-sidebar-primary hover:underline"
        >
          Scale
        </a>
      </p>
    </div>
  );
}

function iniciaisDe(texto: string): string {
  const partes = texto.split(/[\s@._-]+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "";
  const ultima =
    partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : (partes[0]?.[1] ?? "");
  return `${primeira}${ultima}`.toUpperCase();
}

function SinoDeAvisos({ avisos, grande }: { avisos: Aviso[]; grande?: boolean }) {
  const total = avisos.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={total > 0 ? `Avisos: ${String(total)} novo(s)` : "Avisos: nenhum"}
          className={cn(
            "relative flex shrink-0 items-center justify-center text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white",
            grande
              ? "h-11 w-11 rounded-xl border border-sidebar-border bg-campo"
              : "h-8 w-8 rounded-lg",
          )}
        >
          <Bell className={grande ? "h-[18px] w-[18px]" : "h-4 w-4"} aria-hidden />
          {total > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-status-bad px-1 text-[10.5px] font-bold text-white ring-2 ring-sidebar">
              {total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" sideOffset={12} className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <div className="text-[14px] font-semibold">Avisos</div>
          <div className="text-[12px] text-muted-foreground">
            Integração e atualização dos dados
          </div>
        </div>
        {total === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-[13px] text-muted-foreground">
            <BellOff className="h-5 w-5 opacity-60" aria-hidden />
            Tudo certo por aqui.
          </div>
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-auto">
            {avisos.map((a) => (
              <li key={a.id} className="flex gap-3 px-4 py-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    a.gravidade === "critico"
                      ? "bg-status-bad-bg text-status-bad-fg"
                      : "bg-status-warn-bg text-status-warn-fg",
                  )}
                >
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 text-[12.5px]">
                  <p className="font-semibold text-foreground">{a.titulo}</p>
                  <p className="mt-0.5 text-muted-foreground">{a.detalhe}</p>
                  {a.link && (
                    <Link
                      to={a.link.para}
                      className="mt-1.5 inline-block font-semibold text-brand hover:underline"
                    >
                      {a.link.rotulo} →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
