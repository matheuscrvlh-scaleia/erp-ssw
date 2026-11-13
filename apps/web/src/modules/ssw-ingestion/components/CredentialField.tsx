import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CampoDaCredencial({
  id,
  rotulo,
  valor,
  aoMudar,
  dica,
  numerico = false,
  invalido = false,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  dica: string;
  numerico?: boolean;
  invalido?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13px]">
        {rotulo}
      </Label>
      <Input
        id={id}
        value={valor}
        onChange={(e) => {
          aoMudar(e.target.value);
        }}
        placeholder={dica}
        autoComplete="off"
        maxLength={numerico ? 18 : 64}
        aria-invalid={invalido || undefined}
        {...(invalido ? { "aria-describedby": `${id}-erro` } : {})}
        {...(numerico ? { inputMode: "numeric" as const } : {})}
      />
    </div>
  );
}
