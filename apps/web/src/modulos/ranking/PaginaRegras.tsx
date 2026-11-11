import { type SaidaDe } from "@erp/shared/contrato";
import {
  contratosRanking as c,
  type CriterioDeRegra,
  CRITERIOS_DE_REGRA,
} from "@erp/shared/contratos/ranking";
import { hojeNoFuso } from "@erp/shared/datas";
import { formatarMoeda } from "@erp/shared/formatacao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarRange,
  Copy,
  Edit,
  ListChecks,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ModalDetalhe } from "@/componentes/comum/Detalhe";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Checkbox } from "@/componentes/ui/checkbox";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/componentes/ui/select";
import { Skeleton } from "@/componentes/ui/skeleton";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
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
  const hoje = hojeNoFuso(useFusoDaEmpresa());
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const regras = useQuery(consultaRegras);

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
        await chamar(c.simularRegra, { parametros: { id }, entrada: mesAnterior(hoje) }),
      );
    } catch (e) {
      toast.error(mensagemAmigavel(e));
    } finally {
      setSimulando(null);
    }
  }

  const lista = regras.data ?? [];

  return (
    <Pagina
      titulo="Regras de bonificação"
      descricao="Defina critérios e simule antes de ativar"
      largura="estreita"
      acoes={
        <>
          <Button asChild size="sm" variant="ghost">
            <Link to="/admin/equipes" aria-label="Voltar para Equipes" title="Voltar para Equipes">
              <ArrowLeft aria-hidden /> Voltar
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditando(rascunhoVazio(hoje));
            }}
          >
            <Plus aria-hidden /> Nova regra
          </Button>
        </>
      }
    >
      {regras.isPending ? (
        <div className="space-y-4" aria-busy>
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl bg-muted" />
          ))}
        </div>
      ) : regras.error ? (
        <Painel>
          <MensagemErro erro={regras.error} aoTentarDeNovo={() => void regras.refetch()} />
        </Painel>
      ) : lista.length === 0 ? (
        <Painel>
          <EstadoVazio
            icone={ListChecks}
            mensagem="Nenhuma regra cadastrada ainda."
            detalhe="Crie a primeira em “Nova regra”."
          />
        </Painel>
      ) : (
        <div className="space-y-4">
          {lista.map((r) => {
            const sim = simulacao?.regraId === r.id ? simulacao : null;
            return (
              <Painel
                key={r.id}
                titulo={
                  <span className="flex flex-wrap items-center gap-2">
                    {r.nome}
                    <SeloStatus tom={r.ativo ? "sucesso" : "neutro"}>
                      {r.ativo ? "Ativa" : "Inativa"}
                    </SeloStatus>
                  </span>
                }
                descricao={r.descricao}
                acoes={
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void simular(r.id)}
                      disabled={simulando === r.id}
                    >
                      <Sparkles aria-hidden /> Simular
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="Editar regra"
                      title="Editar regra"
                      onClick={() => {
                        setEditando(rascunhoDaRegra(r));
                      }}
                    >
                      <Edit aria-hidden />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="Copiar regra"
                      title="Copiar regra"
                      onClick={() => {
                        setEditando({
                          ...rascunhoDaRegra(r),
                          id: undefined,
                          nome: `${r.nome} (cópia)`,
                        });
                      }}
                    >
                      <Copy aria-hidden />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-status-bad-fg hover:text-status-bad-fg"
                      aria-label="Remover regra"
                      title="Remover regra"
                      onClick={() => {
                        if (window.confirm("Remover regra?")) excluir.mutate(r.id);
                      }}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </>
                }
                classeDoCorpo="space-y-3 px-5 py-4"
              >
                <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <CalendarRange className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="tabular-nums">
                    Vigência: {r.vigenciaInicio} {r.vigenciaFim ? `→ ${r.vigenciaFim}` : "→ aberta"}
                  </span>
                </p>
                {r.criterios.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {r.criterios.map((k) => (
                      <span
                        key={k.id}
                        className="inline-flex h-6 items-center rounded-full border border-border bg-muted px-2.5 text-xs font-medium text-foreground"
                      >
                        {ROTULO_DO_CRITERIO[k.criterio]}
                      </span>
                    ))}
                  </div>
                )}

                {sim && (
                  <div className="rounded-xl border border-brand/30 bg-brand-suave p-3 text-[13px]">
                    <div className="font-semibold text-brand">Simulação (mês anterior)</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {sim.equipes.length} equipe(s) · Total estimado:{" "}
                      <span className="font-bold text-foreground tabular-nums">
                        {formatarMoeda(sim.equipes.reduce((s, e) => s + e.valorCalculado, 0))}
                      </span>
                    </div>
                    <div className="mt-2 divide-y divide-border">
                      {sim.equipes.slice(0, 5).map((e) => (
                        <div key={e.equipeId} className="flex justify-between gap-3 py-1.5 text-xs">
                          <span>{e.nome}</span>
                          <span className="font-semibold tabular-nums">
                            {formatarMoeda(e.valorCalculado)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Painel>
            );
          })}
        </div>
      )}

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
    </Pagina>
  );
}

const CAMPO_TEXTO =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-[13px] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none";

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
    <ModalDetalhe
      aberto
      aoFechar={aoCancelar}
      titulo={d.id ? "Editar regra" : "Nova regra"}
      largura="larga"
    >
      <div className="space-y-4 text-[13px]">
        <div className="space-y-1.5">
          <Label htmlFor="regra-nome">Nome</Label>
          <Input
            id="regra-nome"
            placeholder="Nome (ex.: Regra Q3 2026)"
            value={d.nome}
            onChange={(e) => {
              setD({ ...d, nome: e.target.value });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="regra-descricao">Descrição</Label>
          <textarea
            id="regra-descricao"
            className={CAMPO_TEXTO}
            placeholder="Descrição (opcional)"
            rows={2}
            value={d.descricao}
            onChange={(e) => {
              setD({ ...d, descricao: e.target.value });
            }}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="regra-inicio">Vigência início</Label>
            <Input
              id="regra-inicio"
              type="date"
              value={d.vigenciaInicio}
              onChange={(e) => {
                setD({ ...d, vigenciaInicio: e.target.value });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="regra-fim">Vigência fim (opcional)</Label>
            <Input
              id="regra-fim"
              type="date"
              value={d.vigenciaFim}
              onChange={(e) => {
                setD({ ...d, vigenciaFim: e.target.value });
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="regra-ativa"
            checked={d.ativo}
            onCheckedChange={(v) => {
              setD({ ...d, ativo: v === true });
            }}
          />
          <Label htmlFor="regra-ativa">Ativa</Label>
        </div>

        <div className="space-y-2">
          <div className="label-xs">Critérios</div>
          {d.criterios.map((k, i) => (
            <div key={i} className="rounded-xl border border-border bg-superficie p-3">
              <div className="flex items-center justify-between gap-2">
                <Select
                  value={k.criterio}
                  onValueChange={(v) => {
                    const novo = CRITERIOS_DE_REGRA.find((x) => x === v);
                    if (novo) trocarCriterio(i, novo);
                  }}
                >
                  <SelectTrigger className="w-64 text-[13px]" aria-label="Critério">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRITERIOS_DE_REGRA.map((x) => (
                      <SelectItem key={x} value={x}>
                        {ROTULO_DO_CRITERIO[x]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label="Remover critério"
                  title="Remover critério"
                  onClick={() => {
                    setD({ ...d, criterios: d.criterios.filter((_, j) => j !== i) });
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {Object.keys(PARAMETROS_PADRAO[k.criterio]).map((chave) => (
                  <div key={chave} className="space-y-1">
                    <Label htmlFor={`criterio-${String(i)}-${chave}`} className="text-xs">
                      {chave}
                    </Label>
                    <Input
                      id={`criterio-${String(i)}-${chave}`}
                      value={k.parametros[chave] ?? ""}
                      onChange={(e) => {
                        trocarParametro(i, chave, e.target.value);
                      }}
                    />
                  </div>
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
            <Plus aria-hidden /> Adicionar critério
          </Button>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
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
    </ModalDetalhe>
  );
}
