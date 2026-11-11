import { type Acesso } from "@erp/shared/contratos/auth";
import { useNavigate } from "@tanstack/react-router";
import { CornerDownLeft, FileSearch, Moon, Search, Sun } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { montarMenu } from "@/acesso/navegacao";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/componentes/ui/dialog";
import { useAbrirCte } from "@/hooks/use-abrir-cte";
import { definirTema, useTema } from "@/lib/tema";
import { cn } from "@/lib/utils";

interface Opcao {
  id: string;
  grupo: string;
  rotulo: string;
  icone: ReactNode;
  executar: () => void;
}

/** Sem acento e minúsculo, para "ocorrencia" achar "Ocorrências". */
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Ctrl K / ⌘K abre de qualquer tela (o Ctrl F continua sendo a busca do navegador). */
export function useAtalhoDaBusca(abrir: () => void): void {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        abrir();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [abrir]);
}

/**
 * Busca rápida (paleta de comandos): ir a qualquer tela liberada, abrir um CT-e pelo número e
 * trocar o tema. Setas escolhem, Enter executa, Esc fecha.
 */
export function BuscaRapida({
  acesso,
  aberta,
  aoMudar,
}: {
  acesso: Acesso;
  aberta: boolean;
  aoMudar: (aberta: boolean) => void;
}) {
  const navigate = useNavigate();
  const abrirCte = useAbrirCte();
  const tema = useTema();
  const [texto, setTexto] = useState("");
  const [indice, setIndice] = useState(0);

  const fechar = () => {
    aoMudar(false);
    setTexto("");
    setIndice(0);
  };

  const todas = useMemo<Opcao[]>(() => {
    const menu = montarMenu(acesso.telas);
    const telas = (grupo: string, itens: typeof menu.principal) =>
      itens.map((i) => {
        const Icone = i.icone;
        return {
          id: i.caminho,
          grupo,
          rotulo: i.rotulo,
          icone: <Icone className="h-4 w-4" aria-hidden />,
          executar: () => void navigate({ to: i.caminho }),
        };
      });
    return [
      ...telas("Telas", menu.principal),
      ...telas("Admin", menu.admin),
      ...telas("Plataforma", menu.plataforma),
      {
        id: "tema",
        grupo: "Preferências",
        rotulo: tema === "escuro" ? "Usar tema claro" : "Usar tema escuro",
        icone:
          tema === "escuro" ? (
            <Sun className="h-4 w-4" aria-hidden />
          ) : (
            <Moon className="h-4 w-4" aria-hidden />
          ),
        executar: () => {
          definirTema(tema === "escuro" ? "claro" : "escuro");
        },
      },
    ];
  }, [acesso.telas, navigate, tema]);

  const termo = texto.trim();
  const opcoes = useMemo(() => {
    const filtradas = todas.filter((o) => normalizar(o.rotulo).includes(normalizar(termo)));
    if (/^\d{1,12}$/.test(termo)) {
      filtradas.unshift({
        id: "cte",
        grupo: "CT-e",
        rotulo: `Abrir o CT-e ${termo}`,
        icone: <FileSearch className="h-4 w-4" aria-hidden />,
        executar: () => {
          abrirCte(termo);
        },
      });
    }
    return filtradas;
  }, [todas, termo, abrirCte]);

  const escolhida = Math.min(indice, Math.max(0, opcoes.length - 1));
  const executar = (o: Opcao | undefined) => {
    if (!o) return;
    fechar();
    o.executar();
  };

  return (
    <Dialog
      open={aberta}
      onOpenChange={(v) => {
        if (v) aoMudar(true);
        else fechar();
      }}
    >
      <DialogContent className="top-[18%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Busca rápida</DialogTitle>
        <DialogDescription className="sr-only">
          Digite o nome de uma tela ou o número de um CT-e.
        </DialogDescription>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setIndice(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndice((i) => Math.min(i + 1, opcoes.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndice((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                executar(opcoes[escolhida]);
              }
            }}
            placeholder="Buscar tela ou número do CT-e…"
            aria-label="Buscar"
            aria-controls="busca-rapida-opcoes"
            aria-activedescendant={opcoes[escolhida] ? `busca-${opcoes[escolhida].id}` : undefined}
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground focus-visible:outline-none"
          />
          <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            Esc
          </kbd>
        </div>
        <ul
          id="busca-rapida-opcoes"
          role="listbox"
          aria-label="Resultados"
          className="rolagem-fina max-h-[360px] overflow-auto p-2"
        >
          {opcoes.length === 0 && (
            <li className="px-3 py-8 text-center text-[13px] text-muted-foreground">
              Nada encontrado para “{termo}”.
            </li>
          )}
          {opcoes.map((o, i) => (
            <li key={o.id}>
              {(i === 0 || opcoes[i - 1]?.grupo !== o.grupo) && (
                <div className="label-xs px-3 pt-3 pb-1.5">{o.grupo}</div>
              )}
              <button
                type="button"
                id={`busca-${o.id}`}
                role="option"
                aria-selected={i === escolhida}
                onMouseMove={() => {
                  setIndice(i);
                }}
                onClick={() => {
                  executar(o);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px]",
                  i === escolhida ? "bg-accent text-accent-foreground" : "text-foreground",
                )}
              >
                <span className="text-muted-foreground">{o.icone}</span>
                <span className="flex-1 truncate">{o.rotulo}</span>
                {i === escolhida && (
                  <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                )}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
