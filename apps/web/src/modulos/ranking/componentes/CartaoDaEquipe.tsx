import { type Equipe, type Membro } from "@erp/shared/contratos/ranking";
import { Trash2, UsersRound } from "lucide-react";

import { Painel } from "@/componentes/comum/Painel";
import { Button } from "@/componentes/ui/button";

import { BotoesDoLink } from "./BotoesDoLink";
import { NovoMembro } from "./NovoMembro";

/** Cartão de uma equipe: link público, membros e a inclusão de membro. */
export function CartaoDaEquipe({
  equipe: e,
  membros,
  unidade,
  podeGravar,
  podeRemover,
  link,
  aoGerarLink,
  aoCopiarLink,
  aoRevogarLink,
  aoRemoverMembro,
  aoIncluirMembro,
}: {
  equipe: Equipe;
  membros: Membro[];
  unidade: string;
  podeGravar: boolean;
  podeRemover: boolean;
  link: string | undefined;
  aoGerarLink: () => void;
  aoCopiarLink: (link: string) => void;
  aoRevogarLink: () => void;
  aoRemoverMembro: (id: string) => void;
  aoIncluirMembro: (v: {
    nome: string;
    papel: "motorista" | "ajudante";
    posicao: number | null;
  }) => void;
}) {
  return (
    <Painel
      titulo={
        <span className="flex items-center gap-2">
          <UsersRound className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          {e.nome}
        </span>
      }
      descricao={unidade}
      acoes={
        podeGravar && (
          <BotoesDoLink
            equipe={e}
            link={link}
            aoGerar={aoGerarLink}
            aoCopiar={aoCopiarLink}
            aoRevogar={aoRevogarLink}
          />
        )
      }
    >
      <ul className="divide-y divide-border">
        {membros.map((m) => (
          <li key={m.id} className="flex min-h-11 items-center gap-2 px-5 py-1.5">
            <span className="inline-flex h-6 shrink-0 items-center rounded-full border border-border bg-muted px-2 text-xs font-medium text-muted-foreground">
              {m.papel === "motorista" ? "Motorista" : `Ajudante ${m.posicao ?? "-"}`}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px]">{m.nome}</span>
            {podeRemover && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-status-bad-fg"
                aria-label={`Remover ${m.nome}`}
                title={`Remover ${m.nome}`}
                onClick={() => {
                  aoRemoverMembro(m.id);
                }}
              >
                <Trash2 aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {podeGravar && (
        <NovoMembro
          ocupadas={membros.flatMap((m) =>
            m.papel === "ajudante" && m.posicao !== null ? [m.posicao] : [],
          )}
          aoIncluir={aoIncluirMembro}
        />
      )}
    </Painel>
  );
}
