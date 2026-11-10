import { ehAdminDaEmpresa } from "@erp/shared/acesso/papeis";
import {
  type Anotacao,
  contratosHistorico as c,
  type DadosDaAnotacao,
  ROTULO_DO_TIPO_DE_ANOTACAO,
  type TipoAnotacao,
  TIPOS_ANOTACAO,
} from "@erp/shared/contratos/historico";
import { diaDaSemana, hojeNoFuso, somarDias } from "@erp/shared/datas";
import { formatarData, formatarInteiro } from "@erp/shared/formatacao";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bookmark, CalendarDays, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { consultaAcesso } from "@/acesso/sessao";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { etiquetasQueLimpam, FiltrandoPor } from "@/componentes/comum/FiltrosAvancados";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Button } from "@/componentes/ui/button";
import { useFiltrosNaUrl } from "@/hooks/use-filtros-na-url";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { CHAVE_DO_HISTORICO, consultaHistorico } from "./api";
import {
  type DiaDoHistorico,
  diasDoHistorico,
  esquemaDaBusca,
  etiquetasDaBusca,
  intervaloDoPeriodo,
  PERIODOS,
  podeAlterar,
  PRESENCAS,
  ROTULO_DA_PRESENCA,
  ROTULO_DO_PERIODO,
} from "./busca";
import { type AberturaDoModal, ModalDeAnotacao } from "./ModalDeAnotacao";

const COR_DO_TIPO: Record<TipoAnotacao, string> = {
  clima: "bg-sky-50 border-sky-200 text-sky-900",
  operacional: "bg-slate-50 border-slate-200 text-slate-900",
  feriado: "bg-amber-50 border-amber-200 text-amber-900",
  outro: "bg-zinc-50 border-zinc-200 text-zinc-900",
};
const PONTO_DO_TIPO: Record<TipoAnotacao, string> = {
  clima: "bg-sky-500",
  operacional: "bg-slate-500",
  feriado: "bg-amber-500",
  outro: "bg-zinc-500",
};

function diaPorExtenso(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** "N" abre uma anotação nova (fora de campos de texto e sem Ctrl/Alt/Cmd). */
function useAtalhoNovaAnotacao(abrir: () => void) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const alvo = e.target;
      if (
        alvo instanceof HTMLElement &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName) || alvo.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      abrir();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [abrir]);
}

function CartaoTotal({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-lg border border-l-[5px] border-border/60 border-l-kpi-positive bg-card p-4">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{rotulo}</p>
      <p className="mt-1 text-[24px] font-semibold text-kpi-positive tabular-nums">
        {formatarInteiro(valor)}
      </p>
    </div>
  );
}

function ItemDeAnotacao({ a, aoEditar }: { a: Anotacao; aoEditar: (() => void) | null }) {
  const conteudo = (
    <>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PONTO_DO_TIPO[a.tipo]}`} />
      <span className="flex-1">
        <span className="block whitespace-pre-line">{a.texto}</span>
        <span className="text-[11px] opacity-70">
          {ROTULO_DO_TIPO_DE_ANOTACAO[a.tipo]}
          {a.unidadeNome && ` · ${a.unidadeNome}`}
          {a.autorNome && ` · ${a.autorNome}`}
        </span>
      </span>
    </>
  );
  const classe = `flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-[13px] ${COR_DO_TIPO[a.tipo]}`;
  return aoEditar ? (
    <button type="button" onClick={aoEditar} className={`${classe} hover:brightness-95`}>
      {conteudo}
    </button>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

function Linha({
  dias,
  editavel,
  aoEditar,
}: {
  dias: readonly DiaDoHistorico[];
  editavel: (a: Anotacao) => boolean;
  aoEditar: (a: Anotacao) => void;
}) {
  const [limite, setLimite] = useState(30);
  return (
    <div className="space-y-6">
      {dias.slice(0, limite).map((d) => (
        <section key={d.dia} className="space-y-2">
          <h3 className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
            {diaPorExtenso(d.dia)}
          </h3>
          {d.feriados.map((f) => (
            <div
              key={f.id}
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[13px] ${COR_DO_TIPO.feriado}`}
            >
              <CalendarDays className="mt-0.5 h-4 w-4" />
              <div className="flex-1">
                <div className="font-medium">{f.descricao}</div>
                <div className="text-[11px] opacity-70">
                  {f.tipo === "nacional"
                    ? "Nacional"
                    : [f.cidade, f.uf].filter(Boolean).join("/") || "Municipal"}
                </div>
              </div>
            </div>
          ))}
          {d.anotacoes.map((a) => (
            <ItemDeAnotacao
              key={a.id}
              a={a}
              aoEditar={
                editavel(a)
                  ? () => {
                      aoEditar(a);
                    }
                  : null
              }
            />
          ))}
        </section>
      ))}
      {dias.length > limite && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLimite(limite + 30);
          }}
        >
          Mostrar mais dias
        </Button>
      )}
    </div>
  );
}

const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Calendário do período: semanas inteiras; dia vazio abre anotação nova naquela data. */
function Calendario({
  dias,
  inicio,
  fim,
  editavel,
  aoEditar,
  aoCriar,
}: {
  dias: readonly DiaDoHistorico[];
  inicio: string;
  fim: string;
  editavel: (a: Anotacao) => boolean;
  aoEditar: (a: Anotacao) => void;
  aoCriar: (dia: string) => void;
}) {
  const porDia = new Map(dias.map((d) => [d.dia, d]));
  const primeiro = somarDias(inicio, -diaDaSemana(inicio));
  const celulas: string[] = [];
  for (let d = primeiro; d <= fim || diaDaSemana(d) !== 0; d = somarDias(d, 1)) celulas.push(d);
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[700px] grid-cols-7 gap-1 text-[12px]">
        {DIAS_DA_SEMANA.map((d) => (
          <div key={d} className="px-1 font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
        {celulas.map((dia) => {
          const noPeriodo = dia >= inicio && dia <= fim;
          const d = porDia.get(dia);
          return (
            <div
              key={dia}
              className={`min-h-[84px] rounded border p-1 ${noPeriodo ? "border-border/60 bg-card" : "border-transparent opacity-40"}`}
            >
              <button
                type="button"
                disabled={!noPeriodo}
                onClick={() => {
                  aoCriar(dia);
                }}
                title="Nova anotação neste dia"
                className="w-full text-left font-semibold tabular-nums hover:text-primary"
              >
                {dia.slice(8)}/{dia.slice(5, 7)}
              </button>
              {d?.feriados.map((f) => (
                <div key={f.id} className="truncate rounded bg-amber-100 px-1 text-amber-900">
                  {f.descricao}
                </div>
              ))}
              {d?.anotacoes.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={!editavel(a)}
                  onClick={() => {
                    aoEditar(a);
                  }}
                  title={a.texto}
                  className={`mt-0.5 flex w-full items-center gap-1 truncate rounded border px-1 text-left ${COR_DO_TIPO[a.tipo]}`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PONTO_DO_TIPO[a.tipo]}`} />
                  <span className="truncate">{a.texto}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PaginaHistorico() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const fuso = useFusoDaEmpresa();
  const hoje = hojeNoFuso(fuso);
  const admin = ehAdminDaEmpresa(acesso.papel);
  const { filtros: busca, definir } = useFiltrosNaUrl(esquemaDaBusca);
  const periodo = intervaloDoPeriodo(busca.periodo, hoje);
  const queryClient = useQueryClient();
  const consulta = useQuery(consultaHistorico(periodo.inicio, periodo.fim, busca.unidades));
  const d = consulta.data;
  const dias = diasDoHistorico(d?.anotacoes ?? [], d?.feriados ?? [], busca);

  const [modalAberto, setModalAberto] = useState(false);
  const [abertura, setAbertura] = useState<AberturaDoModal>({});
  const abrir = (a: AberturaDoModal = {}) => {
    setAbertura(a);
    setModalAberto(true);
  };
  const [abrirNova] = useState(() => () => {
    setAbertura({});
    setModalAberto(true);
  });
  useAtalhoNovaAnotacao(abrirNova);

  const editavel = (a: Anotacao) => podeAlterar(a, acesso.usuario.id, admin);
  const atualizar = () => queryClient.invalidateQueries({ queryKey: CHAVE_DO_HISTORICO });

  const gravar = async (dados: DadosDaAnotacao, id: string | null) => {
    try {
      if (id) {
        await chamar(c.alterarAnotacao, { parametros: { id }, entrada: dados });
        toast.success("Anotação atualizada");
      } else {
        await chamar(c.criarAnotacao, { entrada: dados });
        toast.success("Anotação registrada");
      }
      await atualizar();
      return true;
    } catch (e) {
      toast.error(mensagemAmigavel(e));
      return false;
    }
  };
  const excluir = async (id: string) => {
    try {
      await chamar(c.excluirAnotacao, { parametros: { id } });
      toast.success("Anotação excluída");
      await atualizar();
      return true;
    } catch (e) {
      toast.error(mensagemAmigavel(e));
      return false;
    }
  };

  const linhasDaExportacao = dias.flatMap((dia) => [
    ...dia.anotacoes.map((a) => ({
      data: dia.dia,
      tipo: ROTULO_DO_TIPO_DE_ANOTACAO[a.tipo],
      texto: a.texto,
      local: a.unidadeNome ?? "",
      autor: a.autorNome ?? "",
      origem: "Anotação",
    })),
    ...dia.feriados.map((f) => ({
      data: dia.dia,
      tipo: f.tipo === "nacional" ? "Feriado nacional" : "Feriado municipal",
      texto: f.descricao,
      local: [f.cidade, f.uf].filter(Boolean).join("/"),
      autor: "",
      origem: "Feriado",
    })),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[20px] font-semibold">
            <Bookmark className="h-5 w-5 text-primary" /> Histórico contextual
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Anotações e feriados que explicam variações na operação
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {acesso.telas.includes("admin_historico") && (
            <Link
              to="/historico/feriados"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-[13px] hover:bg-muted"
            >
              <CalendarDays className="h-4 w-4" /> Feriados
            </Link>
          )}
          <ExportMenu
            arquivo={`historico-${periodo.inicio}_a_${periodo.fim}`}
            titulo="Histórico"
            subtitulo={`Período: ${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}`}
            colunas={[
              { chave: "data", titulo: "Data", formato: "data" },
              { chave: "tipo", titulo: "Tipo" },
              { chave: "texto", titulo: "Texto" },
              { chave: "local", titulo: "Unidade" },
              { chave: "autor", titulo: "Autor" },
              { chave: "origem", titulo: "Origem" },
            ]}
            linhas={linhasDaExportacao}
          />
          <Button
            size="sm"
            onClick={() => {
              abrir();
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Nova anotação
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CartaoTotal rotulo="Anotações no período" valor={d?.totais.anotacoes ?? 0} />
        <CartaoTotal rotulo="Feriados no período" valor={d?.totais.feriados ?? 0} />
        <CartaoTotal rotulo="Dias com contexto" valor={d?.totais.diasComContexto ?? 0} />
      </div>
      {d?.truncado && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          O período tem mais registros do que a tela mostra de uma vez. Reduza o período para ver
          todos.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/40 p-3 text-[12px]">
        <div role="group" aria-label="Período" className="flex items-center gap-1">
          {PERIODOS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={busca.periodo === p}
              onClick={() => {
                definir({ periodo: p });
              }}
              className={`rounded px-2 py-1 ${busca.periodo === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {ROTULO_DO_PERIODO[p]}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-border" />
        <div role="group" aria-label="Visão" className="flex items-center gap-1">
          {(["timeline", "calendario"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={busca.visao === v}
              onClick={() => {
                definir({ visao: v });
              }}
              className={`rounded px-2 py-1 ${busca.visao === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              {v === "timeline" ? "Linha do tempo" : "Calendário"}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-border" />
        <div role="group" aria-label="Tipo" className="flex flex-wrap items-center gap-1">
          {TIPOS_ANOTACAO.map((t) => {
            const ativo = busca.tipos.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={ativo}
                onClick={() => {
                  definir({
                    tipos: ativo ? busca.tipos.filter((x) => x !== t) : [...busca.tipos, t],
                  });
                }}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${ativo ? COR_DO_TIPO[t] : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${PONTO_DO_TIPO[t]}`} />
                {ROTULO_DO_TIPO_DE_ANOTACAO[t]}
              </button>
            );
          })}
        </div>
        <div className="h-4 w-px bg-border" />
        <select
          aria-label="Dias"
          value={busca.presenca}
          onChange={(e) => {
            definir({ presenca: PRESENCAS.find((p) => p === e.target.value) ?? "todos" });
          }}
          className="rounded border border-border bg-background px-2 py-1"
        >
          {PRESENCAS.map((p) => (
            <option key={p} value={p}>
              {ROTULO_DA_PRESENCA[p]}
            </option>
          ))}
        </select>
        <select
          aria-label="Autor"
          value={busca.autor}
          onChange={(e) => {
            definir({ autor: e.target.value });
          }}
          className="rounded border border-border bg-background px-2 py-1"
        >
          <option value="">Todos autores</option>
          {d?.autores.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
        <select
          aria-label="Unidade"
          value={busca.unidades[0] ?? ""}
          onChange={(e) => {
            definir({ unidades: e.target.value ? [e.target.value] : [] });
          }}
          className="rounded border border-border bg-background px-2 py-1"
        >
          <option value="">Todas as unidades</option>
          {d?.unidades.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 rounded border border-border bg-background px-2 py-1">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            aria-label="Buscar no texto"
            placeholder="Buscar no texto…"
            value={busca.q}
            onChange={(e) => {
              definir({ q: e.target.value });
            }}
            className="w-40 bg-transparent outline-none"
          />
        </label>
      </div>
      <FiltrandoPor
        etiquetas={etiquetasQueLimpam(
          etiquetasDaBusca(busca, {
            unidade: (id) => d?.unidades.find((u) => u.id === id)?.nome,
            autor: (id) => d?.autores.find((a) => a.id === id)?.nome,
          }),
          definir,
        )}
      />

      {consulta.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      ) : consulta.error ? (
        <MensagemErro
          erro={consulta.error}
          aoTentarDeNovo={() => {
            void consulta.refetch();
          }}
        />
      ) : busca.visao === "calendario" ? (
        <Calendario
          dias={dias}
          inicio={periodo.inicio}
          fim={periodo.fim}
          editavel={editavel}
          aoEditar={(a) => {
            abrir({ editando: a });
          }}
          aoCriar={(dia) => {
            abrir({ data: dia });
          }}
        />
      ) : dias.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-10 text-center">
          <Bookmark className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-[14px] text-foreground">Nenhuma anotação no período.</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Que tal registrar algo que aconteceu? Pressione{" "}
            <kbd className="rounded border px-1">N</kbd> a qualquer momento.
          </p>
        </div>
      ) : (
        <Linha
          dias={dias}
          editavel={editavel}
          aoEditar={(a) => {
            abrir({ editando: a });
          }}
        />
      )}

      <ModalDeAnotacao
        aberto={modalAberto}
        aoMudarAberto={setModalAberto}
        abertura={abertura}
        hoje={hoje}
        unidades={d?.unidades ?? []}
        podeExcluir={abertura.editando ? editavel(abertura.editando) : false}
        aoGravar={gravar}
        aoExcluir={excluir}
      />
    </div>
  );
}
