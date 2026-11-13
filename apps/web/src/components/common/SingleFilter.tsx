import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** O Select do Radix não aceita valor vazio: "todos" viaja com esta marca. */
const TODOS = "__todos__";

interface OpcaoUnica {
  valor: string;
  rotulo: string;
}

/**
 * Filtro de uma escolha só na barra de filtros (o `FiltroMultiplo` é para várias), no mesmo
 * desenho do gatilho dos outros filtros: "Rótulo  valor". `valor` vazio = a opção `todos`.
 */
export function FiltroUnico({
  rotulo,
  valor,
  aoMudar,
  todos,
  opcoes,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  /** Texto da opção sem filtro (ex.: "Todos autores"). */
  todos: string;
  opcoes: readonly OpcaoUnica[];
}) {
  const ativo = valor !== "";
  const atual = ativo ? (opcoes.find((o) => o.valor === valor)?.rotulo ?? valor) : todos;
  return (
    <Select
      value={ativo ? valor : TODOS}
      onValueChange={(v) => {
        aoMudar(v === TODOS ? "" : v);
      }}
    >
      <SelectTrigger
        aria-label={rotulo}
        className={cn(
          "w-auto max-w-[280px] justify-start gap-2 border-border text-[13px] font-medium shadow-cartao hover:bg-muted",
          ativo && "border-brand/60 bg-brand-suave",
        )}
      >
        <span>{rotulo}</span>
        <span
          className={cn("min-w-0", ativo ? "font-semibold text-brand" : "text-muted-foreground")}
        >
          {atual}
        </span>
      </SelectTrigger>
      <SelectContent className="max-h-80">
        <SelectItem value={TODOS} className="text-[13px]">
          {todos}
        </SelectItem>
        {opcoes.map((o) => (
          <SelectItem key={o.valor} value={o.valor} className="text-[13px]">
            {o.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
