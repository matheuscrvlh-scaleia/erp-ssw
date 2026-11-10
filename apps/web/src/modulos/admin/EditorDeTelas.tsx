import {
  CATEGORIAS_DE_TELA,
  chavesDoItem,
  itemMarcado,
  TELAS_EDITAVEIS,
} from "@erp/shared/acesso/editor-de-telas";
import { ROTULO_DA_TELA, type Tela } from "@erp/shared/acesso/telas";

import { Checkbox } from "@/componentes/ui/checkbox";

import { type MapaDeExcecoes } from "./telas";

const BOTAO_DA_CATEGORIA = "rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted";

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
    <div className="mt-1 space-y-1.5 rounded-md border border-border/60 p-2">
      {TELAS_EDITAVEIS.map((t) => (
        <label key={t} className="flex items-center justify-between text-[12px]">
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
  return (
    <div className="space-y-3 rounded-md border border-border/60 p-2">
      {CATEGORIAS_DE_TELA.map((c) => (
        <div key={c.chave} className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-foreground">
                {c.rotulo}
              </div>
              <div className="text-[10px] text-muted-foreground">{c.descricao}</div>
            </div>
            <div className="flex gap-0.5">
              <button
                type="button"
                className={BOTAO_DA_CATEGORIA}
                onClick={() => {
                  definir(c.telas, undefined);
                }}
              >
                Padrão
              </button>
              <button
                type="button"
                className={BOTAO_DA_CATEGORIA}
                onClick={() => {
                  definir(c.telas, true);
                }}
              >
                Liberar
              </button>
              <button
                type="button"
                className={BOTAO_DA_CATEGORIA}
                onClick={() => {
                  definir(c.telas, false);
                }}
              >
                Bloquear
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {c.telas.map((t) => {
              const v = excecoes[t];
              return (
                <label
                  key={t}
                  className="flex items-center justify-between rounded px-1 py-0.5 text-[12px] hover:bg-muted/40"
                >
                  <span>{ROTULO_DA_TELA[t]}</span>
                  <select
                    aria-label={ROTULO_DA_TELA[t]}
                    className="h-7 w-[120px] rounded-md border border-input bg-background px-2 text-[11px]"
                    value={v === undefined ? "padrao" : v ? "liberar" : "bloquear"}
                    onChange={(e) => {
                      const escolha = e.target.value;
                      definir([t], escolha === "padrao" ? undefined : escolha === "liberar");
                    }}
                  >
                    <option value="padrao">Padrão</option>
                    <option value="liberar">Liberar</option>
                    <option value="bloquear">Bloquear</option>
                  </select>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
