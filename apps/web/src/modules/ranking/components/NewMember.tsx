import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Linha de inclusão de membro no fim do cartão da equipe (até 3 ajudantes, cada um na sua vaga). */
export function NovoMembro({
  aoIncluir,
  ocupadas,
}: {
  aoIncluir: (v: { nome: string; papel: "motorista" | "ajudante"; posicao: number | null }) => void;
  ocupadas: number[];
}) {
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<"motorista" | "ajudante">("motorista");
  const [posicao, setPosicao] = useState<number | null>(null);
  const ocupadasSet = useMemo(() => new Set(ocupadas), [ocupadas]);
  const primeiraLivre = [1, 2, 3].find((p) => !ocupadasSet.has(p)) ?? null;
  const posicaoEfetiva = posicao !== null && !ocupadasSet.has(posicao) ? posicao : primeiraLivre;
  const semVaga = primeiraLivre === null;
  const bloqueado = !nome.trim() || (papel === "ajudante" && semVaga);
  return (
    <div className="flex flex-wrap gap-2 border-t border-border bg-superficie/60 px-5 py-3">
      <Input
        className="h-8 min-w-[160px] flex-1 text-[13px]"
        aria-label="Nome do membro"
        placeholder="Nome do membro"
        value={nome}
        onChange={(e) => {
          setNome(e.target.value);
        }}
      />
      <Select
        value={papel}
        onValueChange={(v) => {
          setPapel(v === "ajudante" ? "ajudante" : "motorista");
        }}
      >
        <SelectTrigger className="h-8 w-32 text-[13px]" aria-label="Papel">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="motorista">motorista</SelectItem>
          <SelectItem value="ajudante">ajudante</SelectItem>
        </SelectContent>
      </Select>
      {papel === "ajudante" ? (
        <Select
          value={posicaoEfetiva === null ? "" : String(posicaoEfetiva)}
          onValueChange={(v) => {
            setPosicao(v ? Number(v) : null);
          }}
          disabled={semVaga}
        >
          <SelectTrigger className="h-8 w-44 text-[13px]" aria-label="Posição do ajudante">
            <SelectValue placeholder="sem vaga" />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3].map((p) => (
              <SelectItem key={p} value={String(p)} disabled={ocupadasSet.has(p)}>
                Ajudante {p}
                {ocupadasSet.has(p) ? " (ocupado)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Button
        size="icon"
        className="h-8 w-8"
        aria-label="Incluir membro"
        disabled={bloqueado}
        title={
          papel === "ajudante" && semVaga
            ? "Esta equipe já tem 3 ajudantes ativos"
            : "Incluir membro"
        }
        onClick={() => {
          aoIncluir({ nome, papel, posicao: papel === "ajudante" ? posicaoEfetiva : null });
          setNome("");
          setPosicao(null);
        }}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}
