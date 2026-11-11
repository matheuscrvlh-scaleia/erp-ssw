import {
  type CodigoDoAdmin,
  type LetraDeResponsavel,
  LETRAS_DE_RESPONSAVEL,
} from "@erp/shared/contratos/codigos-ocorrencia";
import { formatarDataHora } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Abas } from "@/componentes/comum/Abas";
import { Aviso } from "@/componentes/comum/Aviso";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Button } from "@/componentes/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/componentes/ui/dialog";
import { Switch } from "@/componentes/ui/switch";
import { CAMPO, Campo, Escolha } from "@/modulos/admin/comum";

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
  if (consulta.isLoading) {
    return <p className="py-6 text-center text-[13px] text-muted-foreground">Carregando…</p>;
  }
  if (consulta.error) {
    return <MensagemErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} />;
  }
  const alteracoes = consulta.data?.alteracoes ?? [];
  if (alteracoes.length === 0) return <EstadoVazio mensagem="Sem alterações registradas." />;
  return (
    <ol className="rolagem-fina max-h-[320px] space-y-2 overflow-auto text-[13px]">
      {alteracoes.map((a) => (
        <li key={a.id} className="border-l-2 border-brand/40 pl-3">
          <span className="text-muted-foreground">
            {formatarDataHora(a.criadoEm, fuso)} · {a.autorNome ?? "sistema"} ·{" "}
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
  const [erro, setErro] = useState<{ campo: "codigo" | "descricao"; texto: string } | null>(null);
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
      setErro({ campo: "codigo", texto: "Código de 0 a 99." });
      return;
    }
    if (descricao.trim().length < 3) {
      setErro({ campo: "descricao", texto: "Descrição (mín. 3 caracteres)" });
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
        <DialogTitle className="text-[17px] font-bold">
          {editando ? `Código ${String(editando.codigo)}` : "Novo código de ocorrência"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Classificação do código: responsável e se penaliza.
        </DialogDescription>
        {editando && (
          <Abas
            abas={[
              { valor: "dados", rotulo: "Dados" },
              { valor: "historico", rotulo: "Histórico" },
            ]}
            valor={aba}
            aoMudar={setAba}
            className="w-fit"
          />
        )}
        {aba === "historico" && editando ? (
          <HistoricoDoCodigo codigo={editando.codigo} fuso={fuso} />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
              <Campo rotulo="Código" erro={erro?.campo === "codigo" ? erro.texto : null}>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={codigo}
                  disabled={editando !== null}
                  onChange={(e) => {
                    setCodigo(e.target.value);
                  }}
                  className={`${CAMPO} tabular-nums`}
                />
              </Campo>
              <Campo rotulo="Responsável">
                <Escolha
                  opcoes={LETRAS_DE_RESPONSAVEL.map((l) => ({
                    valor: l,
                    rotulo: `${l} — ${rotulos[l]}`,
                  }))}
                  valor={letra}
                  aoMudar={(v) => {
                    if (ehLetra(v)) setLetra(v);
                  }}
                />
              </Campo>
            </div>
            <Campo rotulo="Descrição" erro={erro?.campo === "descricao" ? erro.texto : null}>
              <input
                value={descricao}
                maxLength={500}
                onChange={(e) => {
                  setDescricao(e.target.value);
                }}
                className={CAMPO}
              />
            </Campo>
            <div className="flex flex-wrap gap-6 text-[13px] font-medium">
              <label className="flex items-center gap-2">
                <Switch checked={penaliza} onCheckedChange={setPenaliza} aria-label="Penaliza" />
                Penaliza
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={ativo} onCheckedChange={setAtivo} aria-label="Ativo" />
                Ativo
              </label>
            </div>
            <Campo rotulo="Notas">
              <textarea
                value={notas}
                maxLength={2000}
                rows={3}
                onChange={(e) => {
                  setNotas(e.target.value);
                }}
                placeholder="Ex.: aparece muito em entregas para SP capital"
                className={`${CAMPO} h-auto py-2`}
              />
            </Campo>
            {editando && (
              <Aviso tom="alerta">
                A classificação nova vale para todas as ocorrências deste código, inclusive as
                antigas.
              </Aviso>
            )}
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
