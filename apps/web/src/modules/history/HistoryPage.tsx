import { ehAdminDaEmpresa } from "@erp/shared/access/roles";
import { type Anotacao, type DadosDaAnotacao } from "@erp/shared/contracts/history";
import { hojeNoFuso } from "@erp/shared/dates";
import { formatarData, formatarInteiro } from "@erp/shared/formatting";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bookmark, CalendarCheck, CalendarDays, NotebookPen, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { pode } from "@/access/permission";
import { consultaAcesso } from "@/access/session";
import { EstadoVazio } from "@/components/common/EmptyState";
import { MensagemErro } from "@/components/common/ErrorMessage";
import { ExportMenu } from "@/components/common/ExportMenu";
import { KpiCard } from "@/components/common/KpiCard";
import { Aviso } from "@/components/common/Notice";
import { Painel } from "@/components/common/Panel";
import { Abas } from "@/components/common/Tabs";
import { Pagina } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFusoDaEmpresa } from "@/hooks/use-company-timezone";
import { useGravacao } from "@/hooks/use-save";
import { useFiltrosNaUrl } from "@/hooks/use-url-filters";

import {
  consultaHistorico,
  mutacaoAlterarAnotacao,
  mutacaoCriarAnotacao,
  mutacaoExcluirAnotacao,
} from "./api";
import { FiltrosHistorico } from "./components/HistoryFilters";
import { type AberturaDoModal, ModalDeAnotacao } from "./components/NoteModal";
import { CalendarioDoPeriodo } from "./components/PeriodCalendar";
import { LinhaDoTempo } from "./components/Timeline";
import { COLUNAS_DA_EXPORTACAO, linhasDaExportacao } from "./export";
import { diasDoHistorico, intervaloDoPeriodo, podeAlterar } from "./rules";
import { esquemaDaBusca } from "./search";

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
  const criar = useGravacao({
    mutacao: mutacaoCriarAnotacao(queryClient),
    sucesso: "Anotação registrada",
  });
  const alterar = useGravacao({
    mutacao: mutacaoAlterarAnotacao(queryClient),
    sucesso: "Anotação atualizada",
  });
  const apagar = useGravacao({
    mutacao: mutacaoExcluirAnotacao(queryClient),
    sucesso: "Anotação excluída",
  });
  const gravar = (dados: DadosDaAnotacao, id: string | null) =>
    id ? alterar.gravar({ id, dados }) : criar.gravar(dados);

  const textoDoPeriodo = `${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}`;

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
            colunas={COLUNAS_DA_EXPORTACAO}
            linhas={linhasDaExportacao(dias)}
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
        <FiltrosHistorico
          busca={busca}
          definir={definir}
          aoLimpar={() => {
            limpar(["periodo", "visao"]);
          }}
          autores={d?.autores ?? []}
          unidades={d?.unidades ?? []}
        />
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
          <CalendarioDoPeriodo
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
          <LinhaDoTempo
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
        aoExcluir={apagar.gravar}
      />
    </Pagina>
  );
}
