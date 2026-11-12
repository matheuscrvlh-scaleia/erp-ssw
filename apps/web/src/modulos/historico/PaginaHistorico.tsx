import { ehAdminDaEmpresa } from "@erp/shared/acesso/papeis";
import { type Feriado } from "@erp/shared/contratos/calendario";
import {
  type Anotacao,
  contratosHistorico as c,
  type DadosDaAnotacao,
  ROTULO_DO_TIPO_DE_ANOTACAO,
  TIPOS_ANOTACAO,
} from "@erp/shared/contratos/historico";
import { diaDaSemana, hojeNoFuso, somarDias } from "@erp/shared/datas";
import { formatarData, formatarInteiro } from "@erp/shared/formatacao";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  CalendarCheck,
  CalendarDays,
  NotebookPen,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { pode } from "@/acesso/permissao";
import { consultaAcesso } from "@/acesso/sessao";
import { Abas } from "@/componentes/comum/Abas";
import { Alternador } from "@/componentes/comum/Alternador";
import { Aviso } from "@/componentes/comum/Aviso";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import {
  etiquetasQueLimpam,
  FiltrandoPor,
  FiltrosAvancados,
} from "@/componentes/comum/FiltrosAvancados";
import { FiltroUnico } from "@/componentes/comum/FiltroUnico";
import { KpiCard } from "@/componentes/comum/KpiCard";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Skeleton } from "@/componentes/ui/skeleton";
import { useFiltrosNaUrl } from "@/hooks/use-filtros-na-url";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";
import { corDoTipo } from "@/modulos/calendario/calendario";

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
import { COR_DO_TIPO, ICONE_DO_TIPO } from "./tipos";

function diaPorExtenso(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** "N" abre uma anotação nova (só com Criar/Editar) (fora de campos de texto e sem Ctrl/Alt/Cmd). */
function useAtalhoNovaAnotacao(abrir: () => void, ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
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
  }, [abrir, ativo]);
}

function ItemDeAnotacao({ a, aoEditar }: { a: Anotacao; aoEditar: (() => void) | null }) {
  const Icone = ICONE_DO_TIPO[a.tipo];
  const conteudo = (
    <>
      <span
        aria-hidden
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          COR_DO_TIPO[a.tipo].icone,
        )}
      >
        <Icone className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block whitespace-pre-line text-foreground">{a.texto}</span>
        <span className="mt-1 block text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {ROTULO_DO_TIPO_DE_ANOTACAO[a.tipo]}
          </span>
          {a.unidadeNome && ` · ${a.unidadeNome}`}
          {a.autorNome && ` · ${a.autorNome}`}
        </span>
      </span>
      {aoEditar && (
        <Pencil
          className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      )}
    </>
  );
  const classe =
    "group flex w-full items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left text-[13px] shadow-cartao";
  return aoEditar ? (
    <button
      type="button"
      onClick={aoEditar}
      className={cn(
        classe,
        "transition-[border-color,box-shadow] hover:border-brand/40 hover:shadow-flutuante",
      )}
    >
      {conteudo}
    </button>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

function ItemDeFeriado({ f }: { f: Feriado }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-[13px]",
        corDoTipo(f.tipo),
      )}
    >
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card/70"
      >
        <CalendarDays className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{f.descricao}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {f.tipo === "nacional"
            ? "Nacional"
            : [f.cidade, f.uf].filter(Boolean).join("/") || "Municipal"}
        </div>
      </div>
    </div>
  );
}

/** Linha do tempo por dia, do mais recente ao mais antigo (30 dias por vez). */
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
  const visiveis = dias.slice(0, limite);
  return (
    <div className="space-y-4">
      <ol>
        {visiveis.map((d, i) => (
          <li key={d.dia} className="relative pb-6 pl-8 last:pb-0">
            {i < visiveis.length - 1 && (
              <span
                aria-hidden
                className="absolute top-5 -bottom-0.5 left-[8.5px] w-0.5 rounded-full bg-muted-foreground/35"
              />
            )}
            <span
              aria-hidden
              className="absolute top-1 left-[3px] h-[13px] w-[13px] rounded-full border-[3px] border-brand bg-card"
            />
            <h3 className="label-xs pt-0.5">{diaPorExtenso(d.dia)}</h3>
            <div className="mt-2.5 space-y-2">
              {d.feriados.map((f) => (
                <ItemDeFeriado key={f.id} f={f} />
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
            </div>
          </li>
        ))}
      </ol>
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
  hoje,
  editavel,
  aoEditar,
  aoCriar,
}: {
  dias: readonly DiaDoHistorico[];
  inicio: string;
  fim: string;
  hoje: string;
  editavel: (a: Anotacao) => boolean;
  aoEditar: (a: Anotacao) => void;
  aoCriar: (dia: string) => void;
}) {
  const porDia = new Map(dias.map((d) => [d.dia, d]));
  const primeiro = somarDias(inicio, -diaDaSemana(inicio));
  const celulas: string[] = [];
  for (let d = primeiro; d <= fim || diaDaSemana(d) !== 0; d = somarDias(d, 1)) celulas.push(d);
  return (
    <div className="rolagem-fina overflow-x-auto">
      <div className="grid min-w-[700px] grid-cols-7 gap-1.5 text-[12.5px]">
        {DIAS_DA_SEMANA.map((d) => (
          <div key={d} className="label-xs px-1.5 pb-1">
            {d}
          </div>
        ))}
        {celulas.map((dia) => {
          const noPeriodo = dia >= inicio && dia <= fim;
          const d = porDia.get(dia);
          return (
            <div
              key={dia}
              aria-current={dia === hoje ? "date" : undefined}
              className={cn(
                "flex min-h-24 flex-col gap-1 rounded-lg border p-1.5",
                noPeriodo ? "border-border bg-card" : "border-transparent bg-muted/50 opacity-50",
                dia === hoje && "border-brand ring-1 ring-brand",
              )}
            >
              <button
                type="button"
                disabled={!noPeriodo}
                onClick={() => {
                  aoCriar(dia);
                }}
                title="Nova anotação neste dia"
                className="group/novo flex w-full items-center justify-between rounded-md px-1 text-left font-semibold tabular-nums hover:bg-muted hover:text-brand disabled:hover:bg-transparent disabled:hover:text-inherit"
              >
                {dia.slice(8)}/{dia.slice(5, 7)}
                {noPeriodo && (
                  <Plus
                    className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover/novo:opacity-100"
                    aria-hidden
                  />
                )}
              </button>
              {d?.feriados.map((f) => (
                <div
                  key={f.id}
                  title={f.descricao}
                  className={cn("truncate rounded-md border px-1.5 py-0.5", corDoTipo(f.tipo))}
                >
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
                  className="flex w-full items-center gap-1.5 rounded-md border border-border bg-superficie px-1.5 py-0.5 text-left hover:border-brand/40 disabled:hover:border-border"
                >
                  <span
                    aria-hidden
                    className={cn("h-2 w-2 shrink-0 rounded-full", COR_DO_TIPO[a.tipo].ponto)}
                  />
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
  const podeAnotar = pode(acesso, "historico", "editar");
  const podeApagar = pode(acesso, "historico", "excluir");
  const { filtros: busca, definir, limpar } = useFiltrosNaUrl(esquemaDaBusca);
  const periodo = intervaloDoPeriodo(busca.periodo, hoje);
  const queryClient = useQueryClient();
  const consulta = useQuery(consultaHistorico(periodo.inicio, periodo.fim, busca.unidades));
  const d = consulta.data;
  const dias = diasDoHistorico(d?.anotacoes ?? [], d?.feriados ?? [], busca);
  const filtrosLigados =
    busca.tipos.length > 0 ||
    busca.presenca !== "todos" ||
    busca.autor !== "" ||
    busca.q !== "" ||
    busca.unidades.length > 0;

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
  useAtalhoNovaAnotacao(abrirNova, podeAnotar);

  // Anotação de outra pessoa: só o admin (regra do domínio); e sempre com a ação do cargo.
  const editavel = (a: Anotacao) => podeAnotar && podeAlterar(a, acesso.usuario.id, admin);
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

  const textoDoPeriodo = `${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}`;
  const nomeDaUnidade = (id: string) => d?.unidades.find((u) => u.id === id)?.nome;

  return (
    <Pagina
      titulo="Histórico contextual"
      descricao="Anotações e feriados que explicam variações na operação"
      acoes={
        <>
          {acesso.telas.includes("admin_historico") && (
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/configuracoes" search={{ aba: "feriados" }}>
                <CalendarDays aria-hidden /> Feriados
              </Link>
            </Button>
          )}
          <ExportMenu
            arquivo={`historico-${periodo.inicio}_a_${periodo.fim}`}
            titulo="Histórico"
            subtitulo={`Período: ${textoDoPeriodo}`}
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
          {podeAnotar && (
            <Button
              size="sm"
              onClick={() => {
                abrir();
              }}
            >
              <Plus aria-hidden /> Nova anotação
            </Button>
          )}
        </>
      }
      abas={
        <Abas
          abas={[
            { valor: "timeline", rotulo: "Linha do tempo" },
            { valor: "calendario", rotulo: "Calendário" },
          ]}
          valor={busca.visao}
          aoMudar={(visao) => {
            definir({ visao });
          }}
          rotulo="Visão"
        />
      }
      filtros={
        <>
          <FiltrosAvancados
            ativos={filtrosLigados}
            aoLimpar={() => {
              limpar(["periodo", "visao"]);
            }}
          >
            <Alternador
              rotulo="Período"
              opcoes={PERIODOS.map((p) => ({ valor: p, rotulo: ROTULO_DO_PERIODO[p] }))}
              valor={busca.periodo}
              aoMudar={(p) => {
                definir({ periodo: p });
              }}
            />
            <FiltroMultiplo
              rotulo="Tipo"
              opcoes={TIPOS_ANOTACAO.map((t) => ({
                valor: t,
                rotulo: ROTULO_DO_TIPO_DE_ANOTACAO[t],
              }))}
              selecionados={busca.tipos}
              aoMudar={(tipos) => {
                definir({ tipos: TIPOS_ANOTACAO.filter((t) => tipos.includes(t)) });
              }}
              textoVazio="todos"
            />
            <FiltroUnico
              rotulo="Dias"
              valor={busca.presenca === "todos" ? "" : busca.presenca}
              todos={ROTULO_DA_PRESENCA.todos}
              opcoes={PRESENCAS.filter((p) => p !== "todos").map((p) => ({
                valor: p,
                rotulo: ROTULO_DA_PRESENCA[p],
              }))}
              aoMudar={(v) => {
                definir({ presenca: PRESENCAS.find((p) => p === v) ?? "todos" });
              }}
            />
            <FiltroUnico
              rotulo="Autor"
              valor={busca.autor}
              todos="Todos autores"
              opcoes={(d?.autores ?? []).map((a) => ({ valor: a.id, rotulo: a.nome }))}
              aoMudar={(autor) => {
                definir({ autor });
              }}
            />
            <FiltroUnico
              rotulo="Unidade"
              valor={busca.unidades[0] ?? ""}
              todos="Todas as unidades"
              opcoes={(d?.unidades ?? []).map((u) => ({ valor: u.id, rotulo: u.nome }))}
              aoMudar={(u) => {
                definir({ unidades: u ? [u] : [] });
              }}
            />
            <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px] shadow-cartao focus-within:border-ring">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                aria-label="Buscar no texto"
                placeholder="Buscar no texto…"
                value={busca.q}
                onChange={(e) => {
                  definir({ q: e.target.value });
                }}
                className="w-44 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </label>
          </FiltrosAvancados>
          <FiltrandoPor
            etiquetas={etiquetasQueLimpam(
              etiquetasDaBusca(busca, {
                unidade: nomeDaUnidade,
                autor: (id) => d?.autores.find((a) => a.id === id)?.nome,
              }),
              definir,
            )}
          />
        </>
      }
    >
      {d?.truncado && (
        <Aviso tom="alerta">
          O período tem mais registros do que a tela mostra de uma vez. Reduza o período para ver
          todos.
        </Aviso>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          rotulo="Anotações no período"
          valor={formatarInteiro(d?.totais.anotacoes ?? 0)}
          status="bom"
          neutro
          icone={NotebookPen}
          detalhe={textoDoPeriodo}
        />
        <KpiCard
          rotulo="Feriados no período"
          valor={formatarInteiro(d?.totais.feriados ?? 0)}
          status="bom"
          neutro
          icone={CalendarDays}
          detalhe={textoDoPeriodo}
        />
        <KpiCard
          rotulo="Dias com contexto"
          valor={formatarInteiro(d?.totais.diasComContexto ?? 0)}
          status="bom"
          neutro
          icone={CalendarCheck}
          detalhe={textoDoPeriodo}
        />
      </div>

      <Painel classeDoCorpo="p-4 sm:p-5">
        {consulta.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl bg-muted" />
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
            hoje={hoje}
            editavel={editavel}
            aoEditar={(a) => {
              abrir({ editando: a });
            }}
            aoCriar={(dia) => {
              if (podeAnotar) abrir({ data: dia });
            }}
          />
        ) : dias.length === 0 ? (
          <EstadoVazio
            icone={Bookmark}
            mensagem="Nenhuma anotação no período."
            acao={
              <p className="text-[12.5px]">
                Que tal registrar algo que aconteceu? Pressione{" "}
                <kbd className="rounded-md border border-border bg-muted px-1.5 font-sans text-xs font-semibold text-foreground">
                  N
                </kbd>{" "}
                a qualquer momento.
              </p>
            }
          />
        ) : (
          <Linha
            dias={dias}
            editavel={editavel}
            aoEditar={(a) => {
              abrir({ editando: a });
            }}
          />
        )}
      </Painel>

      <ModalDeAnotacao
        aberto={modalAberto}
        aoMudarAberto={setModalAberto}
        abertura={abertura}
        hoje={hoje}
        unidades={d?.unidades ?? []}
        podeExcluir={abertura.editando ? podeApagar && editavel(abertura.editando) : false}
        aoGravar={gravar}
        aoExcluir={excluir}
      />
    </Pagina>
  );
}
