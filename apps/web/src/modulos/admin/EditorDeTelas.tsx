import {
  CATEGORIAS_DE_TELA,
  chavesDoItem,
  itemMarcado,
  TELAS_EDITAVEIS,
} from "@erp/shared/acesso/editor-de-telas";
import { ROTULO_DA_TELA, type Tela } from "@erp/shared/acesso/telas";

import { Alternador } from "@/componentes/comum/Alternador";
import { Button } from "@/componentes/ui/button";
import { Checkbox } from "@/componentes/ui/checkbox";

import { type MapaDeExcecoes } from "./telas";

type EscolhaDaTela = "padrao" | "liberar" | "bloquear";

const OPCOES: readonly { valor: EscolhaDaTela; rotulo: string }[] = [
  { valor: "padrao", rotulo: "Padrão" },
  { valor: "liberar", rotulo: "Liberar" },
  { valor: "bloquear", rotulo: "Bloquear" },
];

/** Telas que um cargo ou departamento libera (marcar o Ranking marca as duas chaves). */
export function EditorDeMarcacao({
  marcadas,
  aoMudar,
}: {
  marcadas: ReadonlySet<Tela>;
  aoMudar: (marcadas: Set<Tela>) => void;
}) {
  const alternar = (tela: Tela, ligar: boolean) => {
    const proximas = new Set(marcadas);
    for (const t of chavesDoItem(tela)) {
      if (ligar) proximas.add(t);
      else proximas.delete(t);
    }
    aoMudar(proximas);
  };
  return (
    <div className="grid gap-x-4 rounded-xl border border-border bg-superficie p-2 sm:grid-cols-2">
      {TELAS_EDITAVEIS.map((t) => (
        <label
          key={t}
          className="flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-lg px-2 text-[13px] hover:bg-muted"
        >
          <span>{ROTULO_DA_TELA[t]}</span>
          <Checkbox
            aria-label={ROTULO_DA_TELA[t]}
            checked={itemMarcado(t, marcadas)}
            onCheckedChange={(v) => {
              alternar(t, v === true);
            }}
          />
        </label>
      ))}
    </div>
  );
}

/** Exceções de um usuário por categoria: Padrão, Liberar ou Bloquear. */
export function EditorDeExcecoes({
  excecoes,
  aoMudar,
}: {
  excecoes: MapaDeExcecoes;
  aoMudar: (excecoes: MapaDeExcecoes) => void;
}) {
  const definir = (telas: readonly Tela[], valor: boolean | undefined) => {
    const fora = new Set<string>(telas);
    const proximas: MapaDeExcecoes = Object.fromEntries(
      Object.entries(excecoes).filter(([t]) => !fora.has(t)),
    );
    if (valor !== undefined) for (const t of telas) proximas[t] = valor;
    aoMudar(proximas);
  };
  const valorDa = (escolha: EscolhaDaTela) =>
    escolha === "padrao" ? undefined : escolha === "liberar";
  return (
    <div className="space-y-3">
      {CATEGORIAS_DE_TELA.map((c) => (
        <div key={c.chave} className="rounded-xl border border-border bg-superficie p-1">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-foreground">{c.rotulo}</div>
              <div className="text-xs text-muted-foreground">{c.descricao}</div>
            </div>
            <div className="flex gap-0.5" role="group" aria-label={`Todas as telas: ${c.rotulo}`}>
              {OPCOES.map((o) => (
                <Button
                  key={o.valor}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs font-medium text-muted-foreground"
                  onClick={() => {
                    definir(c.telas, valorDa(o.valor));
                  }}
                >
                  {o.rotulo}
                </Button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {c.telas.map((t) => {
              const v = excecoes[t];
              return (
                <div
                  key={t}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-[13px]"
                >
                  <span>{ROTULO_DA_TELA[t]}</span>
                  <Alternador
                    tamanho="pequeno"
                    rotulo={ROTULO_DA_TELA[t]}
                    opcoes={OPCOES}
                    valor={v === undefined ? "padrao" : v ? "liberar" : "bloquear"}
                    aoMudar={(escolha) => {
                      definir([t], valorDa(escolha));
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
