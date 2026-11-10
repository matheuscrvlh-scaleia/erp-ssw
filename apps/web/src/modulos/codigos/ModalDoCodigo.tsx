import {
  type CodigoDoAdmin,
  type LetraDeResponsavel,
  LETRAS_DE_RESPONSAVEL,
} from "@erp/shared/contratos/codigos-ocorrencia";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Button } from "@/componentes/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/componentes/ui/dialog";
import { Switch } from "@/componentes/ui/switch";
import { classeDoSegmento } from "@/modulos/compartilhado/CampoDeTexto";
import { dataHora } from "@/modulos/compartilhado/formatos";

import { consultaHistoricoDoCodigo } from "./api";
import { ehLetra, rotulosDaLetra } from "./regras";

export interface CodigoParaSalvar {
  codigo: number;
  descricao: string;
  letra: LetraDeResponsavel;
  penaliza: boolean;
  ativo: boolean;
  notas: string | null;
}

const ROTULO_DA_ACAO = {
  criou: "Criou",
  excluiu: "Excluiu",
  editou: "Editou",
  classificou: "Classificou",
  desativou: "Desativou",
  reativou: "Reativou",
} as const;

function HistoricoDoCodigo({ codigo, fuso }: { codigo: number; fuso: string }) {
  const consulta = useQuery(consultaHistoricoDoCodigo(codigo));
  if (consulta.isLoading) return <p className="text-[12px] text-muted-foreground">Carregando…</p>;
  if (consulta.error) return <MensagemErro erro={consulta.error} />;
  const alteracoes = consulta.data?.alteracoes ?? [];
  if (alteracoes.length === 0) {
    return <p className="text-[12px] text-muted-foreground">Sem alterações registradas.</p>;
  }
  return (
    <ol className="max-h-[320px] space-y-1.5 overflow-auto text-[12px]">
      {alteracoes.map((a) => (
        <li key={a.id} className="border-l-2 border-border pl-2">
          <span className="text-muted-foreground">
            {dataHora(a.criadoEm, fuso)} · {a.autorNome ?? "sistema"} ·{" "}
          </span>
          <span className="text-foreground">{ROTULO_DA_ACAO[a.acao]}</span>
          {a.campo && (
            <span className="text-muted-foreground">
              {" "}
              {a.campo}: {a.valorAntigo ?? "—"} → {a.valorNovo ?? "—"}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Novo código ou edição (com a aba de histórico da empresa ativa, Q31). */
export function ModalDoCodigo({
  aberto,
  aoMudarAberto,
  editando,
  nomeCurto,
  fuso,
  aoSalvar,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  editando: CodigoDoAdmin | null;
  nomeCurto: string;
  fuso: string;
  aoSalvar: (c: CodigoParaSalvar) => Promise<boolean>;
}) {
  const rotulos = rotulosDaLetra(nomeCurto);
  const [aba, setAba] = useState<"dados" | "historico">("dados");
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [letra, setLetra] = useState<LetraDeResponsavel>("S");
  const [penaliza, setPenaliza] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [notas, setNotas] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setAba("dados");
    setErro(null);
    setCodigo(editando ? String(editando.codigo) : "");
    setDescricao(editando?.descricao ?? "");
    setLetra(editando && ehLetra(editando.letraResponsavel) ? editando.letraResponsavel : "S");
    setPenaliza(editando?.penaliza ?? false);
    setAtivo(editando?.ativo ?? true);
    setNotas(editando?.notas ?? "");
  }, [aberto, editando]);

  const salvar = async () => {
    const numero = Number(codigo);
    if (!Number.isInteger(numero) || numero < 0 || numero > 99 || codigo.trim() === "") {
      setErro("Código de 0 a 99.");
      return;
    }
    if (descricao.trim().length < 3) {
      setErro("Descrição (mín. 3 caracteres)");
      return;
    }
    setSalvando(true);
    const ok = await aoSalvar({
      codigo: numero,
      descricao: descricao.trim(),
      letra,
      penaliza,
      ativo,
      notas: notas.trim() || null,
    });
    setSalvando(false);
    if (ok) aoMudarAberto(false);
  };

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAberto}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle>
          {editando ? `Código ${String(editando.codigo)}` : "Novo código de ocorrência"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Classificação do código: responsável e se penaliza.
        </DialogDescription>
        {editando && (
          <div role="tablist" className="flex w-fit rounded-md border border-border/70 p-0.5">
            {(["dados", "historico"] as const).map((a) => (
              <button
                key={a}
                type="button"
                role="tab"
                aria-selected={aba === a}
                onClick={() => {
                  setAba(a);
                }}
                className={classeDoSegmento(aba === a)}
              >
                {a === "dados" ? "Dados" : "Histórico"}
              </button>
            ))}
          </div>
        )}
        {aba === "historico" && editando ? (
          <HistoricoDoCodigo codigo={editando.codigo} fuso={fuso} />
        ) : (
          <div className="space-y-3 text-[13px]">
            <div className="flex gap-3">
              <label className="w-24">
                <span className="text-muted-foreground">Código</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={codigo}
                  disabled={editando !== null}
                  onChange={(e) => {
                    setCodigo(e.target.value);
                  }}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1 tabular-nums"
                />
              </label>
              <label className="flex-1">
                <span className="text-muted-foreground">Responsável</span>
                <select
                  value={letra}
                  onChange={(e) => {
                    if (ehLetra(e.target.value)) setLetra(e.target.value);
                  }}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1"
                >
                  {LETRAS_DE_RESPONSAVEL.map((l) => (
                    <option key={l} value={l}>
                      {l} — {rotulos[l]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-muted-foreground">Descrição</span>
              <input
                value={descricao}
                maxLength={500}
                onChange={(e) => {
                  setDescricao(e.target.value);
                }}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2">
                <Switch checked={penaliza} onCheckedChange={setPenaliza} aria-label="Penaliza" />
                Penaliza
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={ativo} onCheckedChange={setAtivo} aria-label="Ativo" />
                Ativo
              </label>
            </div>
            <label className="block">
              <span className="text-muted-foreground">Notas</span>
              <textarea
                value={notas}
                maxLength={2000}
                rows={3}
                onChange={(e) => {
                  setNotas(e.target.value);
                }}
                placeholder="Ex.: aparece muito em entregas para SP capital"
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1"
              />
            </label>
            {editando && (
              <p className="rounded border border-amber-500/40 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                A classificação nova vale para todas as ocorrências deste código, inclusive as
                antigas.
              </p>
            )}
            {erro && <p className="text-[12px] text-destructive">{erro}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  aoMudarAberto(false);
                }}
              >
                Cancelar
              </Button>
              <Button size="sm" disabled={salvando} onClick={() => void salvar()}>
                Salvar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
