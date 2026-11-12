import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/componentes/ui/select";
import { cn } from "@/lib/utils";

/**
 * Seletor de uma opção no desenho dos filtros ("Situação: Todas"); destaca quando sai do padrão
 * (a primeira opção). `resumo` troca o texto mostrado no botão (a lista mantém o texto completo).
 */
export function SeletorDaLista<V extends string>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
  resumo,
  padrao = opcoes[0]?.valor,
}: {
  rotulo: string;
  valor: V;
  opcoes: readonly { valor: V; rotulo: string }[];
  aoMudar: (v: V) => void;
  resumo?: string | undefined;
  padrao?: V | undefined;
}) {
  const ativo = valor !== padrao;
  return (
    <Select
      value={valor}
      onValueChange={(v) => {
        const escolhida = opcoes.find((o) => o.valor === v);
        if (escolhida) aoMudar(escolhida.valor);
      }}
    >
      <SelectTrigger
        className={cn(
          "h-9 w-auto max-w-full gap-2 border-border text-[13px] font-medium shadow-cartao",
          ativo && "border-brand/60 bg-brand-suave",
        )}
      >
        <span className="shrink-0 text-muted-foreground">{rotulo}:</span>
        <SelectValue>{resumo}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((o) => (
          <SelectItem key={o.valor} value={o.valor} className="text-[13px]">
            {o.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
