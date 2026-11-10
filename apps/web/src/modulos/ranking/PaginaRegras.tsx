import { type SaidaDe } from "@erp/shared/contrato";
import {
  contratosRanking as c,
  type CriterioDeRegra,
  CRITERIOS_DE_REGRA,
} from "@erp/shared/contratos/ranking";
import { formatarMoeda } from "@erp/shared/formatacao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Copy, Edit, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/componentes/ui/button";
import { chamar } from "@/lib/api";
import { ErroDoOperador, mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { CHAVE_DAS_REGRAS, consultaRegras } from "./api";
import { mesAnterior } from "./periodo";
import {
  PARAMETROS_PADRAO,
  type Rascunho,
  rascunhoDaRegra,
  rascunhoVazio,
  regraParaSalvar,
  ROTULO_DO_CRITERIO,
} from "./regras-tela";

type Simulacao = SaidaDe<typeof c.simularRegra>;

/** origem: routes/_authenticated/ranking.regras.tsx (sistema atual) */
export function PaginaRegras() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const { data: regras } = useQuery(consultaRegras);

  const salvar = useMutation({
    mutationFn: (d: Rascunho) => {
      const r = regraParaSalvar(d);
      if (!r.ok) throw new ErroDoOperador(r.erro);
      return chamar(c.salvarRegra, { entrada: r.valor });
    },
    onSuccess: () => {
      toast.success("Regra salva");
      void qc.invalidateQueries({ queryKey: CHAVE_DAS_REGRAS });
      setEditando(null);
    },
    onError: (e) => toast.error(mensagemAmigavel(e)),
  });
  const excluir = useMutation({
    mutationFn: (id: string) => chamar(c.excluirRegra, { parametros: { id } }),
    onSuccess: () => {
      toast.success("Regra removida");
      void qc.invalidateQueries({ queryKey: CHAVE_DAS_REGRAS });
    },
    onError: (e) => toast.error(mensagemAmigavel(e)),
  });

  const [simulando, setSimulando] = useState<string | null>(null);
  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);

  async function simular(id: string) {
    setSimulando(id);
    setSimulacao(null);
    try {
      setSimulacao(
        await chamar(c.simularRegra, { parametros: { id }, entrada: mesAnterior(new Date()) }),
      );
    } catch (e) {
      toast.error(mensagemAmigavel(e));
    } finally {
      setSimulando(null);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild size="sm" variant="ghost">
            <Link to="/admin/equipes" aria-label="Voltar para Equipes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Regras de bonificação</h1>
            <p className="text-sm text-muted-foreground">
              Defina critérios e simule antes de ativar
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditando(rascunhoVazio(new Date()));
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Nova regra
        </Button>
      </header>

      <div className="space-y-3">
        {(regras ?? []).map((r) => {
          const sim = simulacao?.regraId === r.id ? simulacao : null;
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.nome}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        r.ativo
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                  {r.descricao && (
                    <p className="mt-1 text-sm text-muted-foreground">{r.descricao}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Vigência: {r.vigenciaInicio} {r.vigenciaFim ? `→ ${r.vigenciaFim}` : "→ aberta"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.criterios.map((k) => (
                      <span key={k.id} className="rounded bg-muted px-2 py-0.5 text-xs">
                        {ROTULO_DO_CRITERIO[k.criterio]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void simular(r.id)}
                    disabled={simulando === r.id}
                  >
                    <Sparkles className="mr-1.5 h-4 w-4" /> Simular
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Editar regra"
                    onClick={() => {
                      setEditando(rascunhoDaRegra(r));
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Copiar regra"
                    onClick={() => {
                      setEditando({
                        ...rascunhoDaRegra(r),
                        id: undefined,
                        nome: `${r.nome} (cópia)`,
                      });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Remover regra"
                    onClick={() => {
                      if (window.confirm("Remover regra?")) excluir.mutate(r.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-rose-400" />
                  </Button>
                </div>
              </div>

              {sim && (
                <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                  <div className="font-medium text-emerald-300">Simulação (mês anterior)</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {sim.equipes.length} equipe(s) · Total estimado:{" "}
                    <span className="font-medium text-emerald-300">
                      {formatarMoeda(sim.equipes.reduce((s, e) => s + e.valorCalculado, 0))}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {sim.equipes.slice(0, 5).map((e) => (
                      <div key={e.equipeId} className="flex justify-between text-xs">
                        <span>{e.nome}</span>
                        <span className="font-medium">{formatarMoeda(e.valorCalculado)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {(!regras || regras.length === 0) && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhuma regra cadastrada ainda.
          </div>
        )}
      </div>

      {editando && (
        <ModalDaRegra
          inicial={editando}
          salvando={salvar.isPending}
          aoCancelar={() => {
            setEditando(null);
          }}
          aoSalvar={(d) => {
            salvar.mutate(d);
          }}
        />
      )}
    </div>
  );
}

const CAMPO = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

function ModalDaRegra({
  inicial,
  salvando,
  aoCancelar,
  aoSalvar,
}: {
  inicial: Rascunho;
  salvando: boolean;
  aoCancelar: () => void;
  aoSalvar: (d: Rascunho) => void;
}) {
  const [d, setD] = useState<Rascunho>(inicial);
  const trocarCriterio = (i: number, criterio: CriterioDeRegra) => {
    setD({
      ...d,
      criterios: d.criterios.map((x, j) =>
        j === i ? { criterio, parametros: { ...PARAMETROS_PADRAO[criterio] } } : x,
      ),
    });
  };
  const trocarParametro = (i: number, chave: string, valor: string) => {
    setD({
      ...d,
      criterios: d.criterios.map((x, j) =>
        j === i ? { ...x, parametros: { ...x.parametros, [chave]: valor } } : x,
      ),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={d.id ? "Editar regra" : "Nova regra"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-border bg-card p-5 shadow-xl">
        <h2 className="text-lg font-semibold">{d.id ? "Editar" : "Nova"} regra</h2>
        <div className="mt-4 space-y-3">
          <input
            className={CAMPO}
            placeholder="Nome (ex.: Regra Q3 2026)"
            value={d.nome}
            onChange={(e) => {
              setD({ ...d, nome: e.target.value });
            }}
          />
          <textarea
            className={CAMPO}
            placeholder="Descrição (opcional)"
            rows={2}
            value={d.descricao}
            onChange={(e) => {
              setD({ ...d, descricao: e.target.value });
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs">
              <div className="mb-1 text-muted-foreground">Vigência início</div>
              <input
                type="date"
                className={CAMPO}
                value={d.vigenciaInicio}
                onChange={(e) => {
                  setD({ ...d, vigenciaInicio: e.target.value });
                }}
              />
            </label>
            <label className="text-xs">
              <div className="mb-1 text-muted-foreground">Vigência fim (opcional)</div>
              <input
                type="date"
                className={CAMPO}
                value={d.vigenciaFim}
                onChange={(e) => {
                  setD({ ...d, vigenciaFim: e.target.value });
                }}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={d.ativo}
              onChange={(e) => {
                setD({ ...d, ativo: e.target.checked });
              }}
            />
            Ativa
          </label>

          <div>
            <div className="mb-2 text-sm font-medium">Critérios</div>
            <div className="space-y-2">
              {d.criterios.map((k, i) => (
                <div key={i} className="rounded-md border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <select
                      aria-label="Critério"
                      value={k.criterio}
                      onChange={(e) => {
                        const novo = CRITERIOS_DE_REGRA.find((x) => x === e.target.value);
                        if (novo) trocarCriterio(i, novo);
                      }}
                      className="rounded-md border border-border bg-card px-2 py-1 text-sm"
                    >
                      {CRITERIOS_DE_REGRA.map((x) => (
                        <option key={x} value={x}>
                          {ROTULO_DO_CRITERIO[x]}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Remover critério"
                      onClick={() => {
                        setD({ ...d, criterios: d.criterios.filter((_, j) => j !== i) });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    {Object.keys(PARAMETROS_PADRAO[k.criterio]).map((chave) => (
                      <label key={chave}>
                        <div className="mb-1 text-muted-foreground">{chave}</div>
                        <input
                          className="w-full rounded-md border border-border bg-card px-2 py-1"
                          value={k.parametros[chave] ?? ""}
                          onChange={(e) => {
                            trocarParametro(i, chave, e.target.value);
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setD({
                    ...d,
                    criterios: [
                      ...d.criterios,
                      {
                        criterio: "entregas_prazo",
                        parametros: { ...PARAMETROS_PADRAO.entregas_prazo },
                      },
                    ],
                  });
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Adicionar critério
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={aoCancelar}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              aoSalvar(d);
            }}
            disabled={!d.nome.trim() || salvando}
          >
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
