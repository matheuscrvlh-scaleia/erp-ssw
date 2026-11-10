import {
  type Anotacao,
  type DadosDaAnotacao,
  ROTULO_DO_TIPO_DE_ANOTACAO,
  type TipoAnotacao,
  TIPOS_ANOTACAO,
} from "@erp/shared/contratos/historico";
import { Calendar, Cloud, type LucideIcon, MoreHorizontal, Settings2, Trash2 } from "lucide-react";
import { type KeyboardEvent, useEffect, useState } from "react";

import { Button } from "@/componentes/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/componentes/ui/dialog";

const ICONE_DO_TIPO: Record<TipoAnotacao, LucideIcon> = {
  clima: Cloud,
  operacional: Settings2,
  feriado: Calendar,
  outro: MoreHorizontal,
};

export interface AberturaDoModal {
  data?: string | undefined;
  editando?: Anotacao | null | undefined;
}

/**
 * Nova anotação ou edição. "Salvar e nova" (Ctrl+Enter) grava e limpa o texto para registrar a
 * próxima sem fechar. `aoGravar` devolve false em erro (o modal fica aberto).
 */
export function ModalDeAnotacao({
  aberto,
  aoMudarAberto,
  abertura,
  hoje,
  unidades,
  podeExcluir,
  aoGravar,
  aoExcluir,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  abertura: AberturaDoModal;
  hoje: string;
  unidades: readonly { id: string; nome: string }[];
  podeExcluir: boolean;
  aoGravar: (dados: DadosDaAnotacao, id: string | null) => Promise<boolean>;
  aoExcluir: (id: string) => Promise<boolean>;
}) {
  const editando = abertura.editando ?? null;
  const [data, setData] = useState(hoje);
  const [tipo, setTipo] = useState<TipoAnotacao>("operacional");
  const [texto, setTexto] = useState("");
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    setData(editando?.data ?? abertura.data ?? hoje);
    setTipo(editando?.tipo ?? "operacional");
    setTexto(editando?.texto ?? "");
    setUnidadeId(editando?.unidadeId ?? null);
  }, [aberto, editando, abertura.data, hoje]);

  const salvar = async (continuar: boolean) => {
    if (!texto.trim()) {
      setErro("Escreva o que aconteceu");
      return;
    }
    setSalvando(true);
    const ok = await aoGravar({ data, tipo, texto: texto.trim(), unidadeId }, editando?.id ?? null);
    setSalvando(false);
    if (!ok) return;
    if (editando || !continuar) aoMudarAberto(false);
    else setTexto("");
  };

  const excluir = async () => {
    if (!editando || !window.confirm("Tem certeza? Esta ação não pode ser desfeita.")) return;
    setSalvando(true);
    const ok = await aoExcluir(editando.id);
    setSalvando(false);
    if (ok) aoMudarAberto(false);
  };

  const atalho = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void salvar(true);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAberto}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle>{editando ? "Editar anotação" : "Nova anotação"}</DialogTitle>
        <DialogDescription className="sr-only">
          Registre um evento de contexto (clima, operacional, externo).
        </DialogDescription>
        <div className="space-y-4 pt-2">
          <div className="flex flex-wrap gap-3 text-[13px]">
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Data</span>
              <input
                type="date"
                value={data}
                onChange={(e) => {
                  setData(e.target.value);
                }}
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Unidade</span>
              <select
                value={unidadeId ?? ""}
                onChange={(e) => {
                  setUnidadeId(e.target.value || null);
                }}
                className="rounded border border-border bg-background px-2 py-1"
              >
                <option value="">Todas</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div role="group" aria-label="Tipo" className="flex flex-wrap gap-2">
            {TIPOS_ANOTACAO.map((t) => {
              const Icone = ICONE_DO_TIPO[t];
              const ativo = tipo === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => {
                    setTipo(t);
                  }}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition " +
                    (ativo
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30")
                  }
                >
                  <Icone className="h-3.5 w-3.5" /> {ROTULO_DO_TIPO_DE_ANOTACAO[t]}
                </button>
              );
            })}
          </div>
          <label className="block text-[13px]">
            <span className="text-muted-foreground">O que aconteceu</span>
            <textarea
              value={texto}
              autoFocus
              maxLength={2000}
              onChange={(e) => {
                setTexto(e.target.value);
              }}
              onKeyDown={atalho}
              rows={4}
              placeholder="Ex.: chuva forte na região de Campinas atrasou as entregas da tarde"
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5"
            />
          </label>
          {erro && <p className="text-[12px] text-destructive">{erro}</p>}
          <div className="flex items-center justify-between gap-2">
            {editando && podeExcluir ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={salvando}
                onClick={() => void excluir()}
                className="text-destructive"
              >
                <Trash2 className="mr-1 h-4 w-4" /> Excluir
              </Button>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                Ctrl+Enter salva e abre outra
              </span>
            )}
            <div className="flex gap-2">
              {!editando && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={salvando}
                  onClick={() => void salvar(true)}
                >
                  Salvar e nova
                </Button>
              )}
              <Button size="sm" disabled={salvando} onClick={() => void salvar(false)}>
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
