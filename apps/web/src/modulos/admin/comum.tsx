import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { cloneElement, type ReactElement, type ReactNode, useId, useState } from "react";
import { toast } from "sonner";

import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

/** Peças das telas de Admin e Plataforma que o kit (componentes/comum) não tem. */

/**
 * Escrita com aviso: toast de sucesso ou do erro da API (já em português) e invalidação das
 * consultas afetadas. `gravar` devolve `false` em caso de erro, para o modal ficar aberto.
 */
export function useGravacao<E, S>(opcoes: {
  executar: (entrada: E) => Promise<S>;
  sucesso: string | ((entrada: E, saida: S) => string);
  invalidar: readonly QueryKey[];
}) {
  const queryClient = useQueryClient();
  const mutacao = useMutation({ mutationFn: opcoes.executar });
  const gravar = async (entrada: E): Promise<boolean> => {
    try {
      const saida = await mutacao.mutateAsync(entrada);
      toast.success(
        typeof opcoes.sucesso === "string" ? opcoes.sucesso : opcoes.sucesso(entrada, saida),
      );
      await Promise.all(
        opcoes.invalidar.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      return true;
    } catch (e) {
      toast.error(mensagemAmigavel(e));
      return false;
    }
  };
  return { gravar, gravando: mutacao.isPending };
}

export function CabecalhoDaPagina({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[24px] font-medium tracking-tight">{titulo}</h1>
        <p className="text-[12px] text-muted-foreground">{descricao}</p>
      </div>
      {children}
    </div>
  );
}

export function Abas<T extends string>({
  abas,
  valor,
  aoMudar,
  className,
}: {
  abas: readonly { valor: T; rotulo: ReactNode }[];
  valor: T;
  aoMudar: (valor: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex gap-1 rounded-md border border-border/60 bg-muted/40 p-1",
        className,
      )}
    >
      {abas.map((a) => (
        <button
          key={a.valor}
          type="button"
          role="tab"
          aria-selected={a.valor === valor}
          onClick={() => {
            aoMudar(a.valor);
          }}
          className={cn(
            "flex-1 rounded px-3 py-1 text-[12px] font-medium transition-colors",
            a.valor === valor
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {a.rotulo}
        </button>
      ))}
    </div>
  );
}

const TOM_DO_SELO = {
  bom: "bg-status-good-bg text-status-good-fg",
  ruim: "bg-status-bad-bg text-status-bad-fg",
  alerta: "bg-status-warn-bg text-status-warn-fg",
  neutro: "border border-border text-muted-foreground",
} as const;

/** Selo de situação (Ativo/Inativo, Protegido, Convite pendente), nas cores de status. */
export function Selo({
  tom = "neutro",
  children,
  title,
}: {
  tom?: keyof typeof TOM_DO_SELO;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        TOM_DO_SELO[tom],
      )}
    >
      {children}
    </span>
  );
}

export const CAMPO =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60";

/** Rótulo, controle (recebe o `id`), ajuda e erro. */
export function Campo({
  rotulo,
  ajuda,
  erro,
  children,
}: {
  rotulo: string;
  ajuda?: ReactNode;
  erro?: string | null;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[13px] font-medium">
        {rotulo}
      </label>
      {cloneElement(children, { id })}
      {ajuda && <p className="text-[11px] text-muted-foreground">{ajuda}</p>}
      {erro && <p className="text-[11px] text-status-bad-fg">{erro}</p>}
    </div>
  );
}

/** Senha com botão de mostrar/ocultar; `extra` entra ao lado do olho (ex.: copiar). */
export function CampoDeSenha({
  rotulo,
  valor,
  aoMudar,
  extra,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  extra?: ReactNode;
}) {
  const id = useId();
  const [ver, setVer] = useState(false);
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[13px] font-medium">
        {rotulo}
      </label>
      <div className="relative">
        <input
          id={id}
          type={ver ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          className={`${CAMPO} pr-16`}
          value={valor}
          onChange={(e) => {
            aoMudar(e.target.value);
          }}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {extra}
          <button
            type="button"
            onClick={() => {
              setVer((v) => !v);
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label={ver ? "Ocultar senha" : "Mostrar senha"}
          >
            {ver ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
